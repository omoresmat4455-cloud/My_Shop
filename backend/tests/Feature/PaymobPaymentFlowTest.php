<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\CartItem;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaymobPaymentFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_is_redirected_to_paymob_for_the_card_integration(): void
    {
        config([
            'services.paymob.secret_key' => 'test-secret-key',
            'services.paymob.public_key' => 'test-public-key',
            'services.paymob.hmac' => 'test-hmac-secret',
            'services.paymob.integration_ids.card' => 101,
            'services.paymob.integration_ids.vodafone' => 202,
            'app.frontend_url' => 'https://shop.example.test/',
            'app.url' => 'https://api.example.test',
        ]);
        Http::fake([
            'https://accept.paymob.com/v1/intention/' => Http::response([
                'client_secret' => 'checkout-client-secret',
            ]),
        ]);

        $user = $this->createUser();
        $order = $this->createOrder($user);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/orders/{$order->id}/pay", [
                'payment_method' => 'card',
            ])
            ->assertOk()
            ->assertJsonPath('order.payment_method', 'card')
            ->assertJsonPath(
                'payment_url',
                'https://accept.paymob.com/unifiedcheckout/?publicKey=test-public-key&clientSecret=checkout-client-secret'
            );

        Http::assertSent(fn (Request $request) => $request->url() === 'https://accept.paymob.com/v1/intention/'
            && $request['amount'] === 1250
            && $request['currency'] === 'EGP'
            && $request['payment_methods'] === [101]
            && $request['redirection_url'] === 'https://shop.example.test/payment/result?order_id='.$order->id
            && ! array_key_exists('card_number', $request->data())
            && ! array_key_exists('wallet_pin', $request->data()));
    }

    public function test_unconfigured_card_integration_returns_an_error_without_changing_order_method(): void
    {
        config([
            'services.paymob.secret_key' => 'test-secret-key',
            'services.paymob.public_key' => 'test-public-key',
            'services.paymob.hmac' => 'test-hmac-secret',
            'services.paymob.integration_ids.card' => null,
        ]);
        Http::fake();

        $user = $this->createUser('unconfigured-wallet@example.com');
        $order = $this->createOrder($user);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/orders/{$order->id}/pay", [
                'payment_method' => 'card',
            ])
            ->assertStatus(503)
            ->assertJsonPath('message', 'Card payment is not configured yet. Please try another payment method.');

        $this->assertSame('card', $order->fresh()->payment_method);
        $this->assertDatabaseCount('payment_attempts', 0);
        Http::assertNothingSent();
    }

    public function test_public_payment_method_endpoint_disables_card_without_exposing_credentials(): void
    {
        config([
            'services.paymob.secret_key' => null,
            'services.paymob.public_key' => null,
            'services.paymob.hmac' => null,
            'services.paymob.integration_ids.card' => null,
        ]);

        $this->getJson('/api/payment-methods')
            ->assertOk()
            ->assertJsonPath('methods.0.id', 'cod')
            ->assertJsonPath('methods.0.enabled', true)
            ->assertJsonPath('methods.1.enabled', true)
            ->assertJsonPath('methods.2.enabled', true)
            ->assertJsonPath('methods.3.enabled', true)
            ->assertJsonPath('methods.4.id', 'card')
            ->assertJsonPath('methods.4.enabled', false)
            ->assertJsonMissingPath('secret_key')
            ->assertJsonMissingPath('public_key')
            ->assertJsonMissingPath('hmac');
    }

    public function test_card_checkout_requires_a_public_https_api_url(): void
    {
        config([
            'services.paymob.secret_key' => 'test-secret-key',
            'services.paymob.public_key' => 'test-public-key',
            'services.paymob.hmac' => 'test-hmac-secret',
            'services.paymob.integration_ids.card' => 101,
            'app.frontend_url' => 'https://shop.example.test',
            'app.url' => 'http://localhost:8000',
        ]);

        $this->getJson('/api/payment-methods')
            ->assertOk()
            ->assertJsonPath('methods.4.enabled', false);

        config(['app.url' => 'https://api.example.test']);

        $this->getJson('/api/payment-methods')
            ->assertOk()
            ->assertJsonPath('methods.4.enabled', true);
    }

    public function test_order_cannot_be_created_with_card_when_gateway_is_unconfigured(): void
    {
        config([
            'services.paymob.secret_key' => null,
            'services.paymob.public_key' => null,
            'services.paymob.hmac' => null,
            'services.paymob.integration_ids.card' => null,
        ]);
        $user = $this->createUser('disabled-card@example.com');
        $category = Category::create([
            'name' => 'Card Test',
            'slug' => 'card-test',
        ]);
        $product = Product::create([
            'name' => 'Card Test Item',
            'slug' => 'card-test-item',
            'price' => 10,
            'stock' => 2,
            'is_active' => true,
            'category_id' => $category->id,
        ]);
        CartItem::create([
            'user_id' => $user->id,
            'product_id' => $product->id,
            'quantity' => 1,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/orders', [
                'address' => '1 Example Street',
                'city' => 'Cairo',
                'phone' => '01012345678',
                'payment_method' => 'card',
            ])
            ->assertStatus(503);

        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(2, $product->fresh()->stock);
    }

    public function test_customer_cannot_open_a_second_live_card_checkout(): void
    {
        config([
            'services.paymob.secret_key' => 'test-secret-key',
            'services.paymob.public_key' => 'test-public-key',
            'services.paymob.hmac' => 'test-hmac-secret',
            'services.paymob.integration_ids.card' => 101,
            'app.frontend_url' => 'https://shop.example.test/',
            'app.url' => 'https://api.example.test',
        ]);
        Http::fake([
            'https://accept.paymob.com/v1/intention/' => Http::response([
                'client_secret' => 'checkout-client-secret',
            ]),
        ]);

        $user = $this->createUser('single-card-session@example.com');
        $order = $this->createOrder($user);
        $this->actingAs($user, 'sanctum');

        $this->postJson("/api/orders/{$order->id}/pay", ['payment_method' => 'card'])
            ->assertOk();
        $this->postJson("/api/orders/{$order->id}/pay", ['payment_method' => 'card'])
            ->assertStatus(409);

        $this->assertDatabaseCount('payment_attempts', 1);
    }

    private function createUser(string $email = 'paymob-customer@example.com'): User
    {
        return User::create([
            'name' => 'Customer',
            'email' => $email,
            'password' => 'password123',
            'is_active' => true,
        ]);
    }

    private function createOrder(User $user): Order
    {
        return Order::create([
            'user_id' => $user->id,
            'total' => 12.50,
            'status' => 'pending',
            'payment_method' => 'card',
            'payment_status' => 'unpaid',
            'address' => '1 Example Street',
            'city' => 'Cairo',
            'phone' => '01012345678',
        ]);
    }
}
