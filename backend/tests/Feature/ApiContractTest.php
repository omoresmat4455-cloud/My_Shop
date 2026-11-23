<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ApiContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_register_and_fetch_current_user(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Alice Example',
            'email' => 'alice@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('user.email', 'alice@example.com')
            ->assertJsonStructure(['user', 'token']);

        $token = $response->json('token');

        $this->withToken($token)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('email', 'alice@example.com');

        $this->travel(31)->days();

        $storedToken = User::where('email', 'alice@example.com')->firstOrFail()
            ->tokens()
            ->firstOrFail();

        $this->assertSame(43200, config('sanctum.expiration'));
        $this->assertTrue(
            $storedToken->created_at->lt(now()->subMinutes(config('sanctum.expiration')))
        );

        Auth::forgetGuards();

        $this->withToken($token)
            ->getJson('/api/me')
            ->assertUnauthorized();
    }

    public function test_login_is_rate_limited_after_repeated_failed_attempts(): void
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/login', [
                'email' => 'unknown@example.com',
                'password' => 'incorrect-password',
            ])->assertUnprocessable();
        }

        $this->postJson('/api/login', [
            'email' => 'unknown@example.com',
            'password' => 'incorrect-password',
        ])->assertTooManyRequests();
    }

    public function test_login_is_rate_limited_across_email_addresses_from_one_ip(): void
    {
        for ($attempt = 0; $attempt < 60; $attempt++) {
        $this->postJson('/api/login', [
            'email' => "unknown-{$attempt}@example.com",
            'password' => 'incorrect-password',
        ])->assertUnprocessable();
        }

        $this->postJson('/api/login', [
        'email' => 'another-address@example.com',
        'password' => 'incorrect-password',
        ])->assertTooManyRequests();
    }

    public function test_api_routes_have_global_rate_limiting_enabled(): void
    {
        $this->assertContains(
            'throttle:api',
            app('router')->getMiddlewareGroups()['api']
        );
    }

    public function test_frontend_development_origin_can_preflight_registration(): void
    {
        $this->call('OPTIONS', '/api/register', [], [], [], [
            'HTTP_ORIGIN' => 'http://localhost:5176',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type',
        ])
            ->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5176')
            ->assertHeader('Access-Control-Allow-Methods');
    }

    public function test_react_vite_origins_can_preflight_api_requests(): void
    {
        foreach (['http://localhost:5173', 'http://127.0.0.1:5173'] as $origin) {
            $this->call('OPTIONS', '/api/register', [], [], [], [
                'HTTP_ORIGIN' => $origin,
                'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
                'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type',
            ])
                ->assertNoContent()
                ->assertHeader('Access-Control-Allow-Origin', $origin)
                ->assertHeader('Access-Control-Allow-Methods');
        }
    }

    public function test_cart_rejects_quantity_above_available_stock(): void
    {
        $user = User::create([
            'name' => 'Customer',
            'email' => 'customer@example.com',
            'password' => 'password123',
            'is_active' => true,
        ]);

        $category = Category::create([
            'name' => 'Electronics',
            'slug' => 'electronics',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Wireless Mouse',
            'slug' => 'wireless-mouse',
            'description' => 'Ergonomic mouse',
            'price' => 29.99,
            'stock' => 3,
            'is_active' => true,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/cart', [
                'product_id' => $product->id,
                'quantity' => 4,
            ])
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'Requested quantity exceeds available stock. Available stock: 3'
            );
    }

    public function test_admin_routes_require_admin_privileges(): void
    {
        $user = User::create([
            'name' => 'Customer',
            'email' => 'plain@example.com',
            'password' => 'password123',
            'role' => 'customer',
            'is_active' => true,
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/stats')
            ->assertStatus(403)
            ->assertJsonPath('message', 'Forbidden');
    }

    public function test_admin_dashboard_endpoints_return_frontend_response_shapes_when_empty(): void
    {
        $admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => 'password123',
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/stats')
            ->assertOk()
            ->assertJsonPath('orders', 0)
            ->assertJsonPath('products', 0)
            ->assertJsonPath('customers', 0)
            ->assertJsonPath('revenue', 0);

        $this->getJson('/api/admin/orders?limit=5')
            ->assertOk()
            ->assertJsonPath('data', []);

        $this->getJson('/api/admin/revenue-chart')
            ->assertOk()
            ->assertJsonCount(7)
            ->assertJsonPath('0.revenue', 0);

        $this->getJson('/api/admin/top-products')
            ->assertOk()
            ->assertExactJson([]);

        $customer = User::create([
            'name' => 'Customer',
            'email' => 'stats-customer@example.com',
            'password' => 'password123',
            'is_active' => true,
        ]);
        Order::create([
            'user_id' => $customer->id,
            'total' => 12.50,
            'status' => 'delivered',
            'payment_method' => 'cod',
            'payment_status' => 'paid',
            'address' => '1 Example Street',
            'city' => 'Cairo',
            'phone' => '01012345678',
        ]);
        Order::create([
            'user_id' => $customer->id,
            'total' => 20,
            'status' => 'cancelled',
            'payment_method' => 'cod',
            'payment_status' => 'unpaid',
            'address' => '1 Example Street',
            'city' => 'Cairo',
            'phone' => '01012345678',
        ]);

        $this->getJson('/api/admin/stats')
            ->assertOk()
            ->assertJsonPath('orders', 2)
            ->assertJsonPath('delivered_orders', 1)
            ->assertJsonPath('cancelled_orders', 1)
            ->assertJsonPath('revenue', 12.5);
    }

    public function test_admin_management_routes_match_frontend_fields_and_roles(): void
    {
        $admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => 'password123',
            'role' => 'admin',
            'is_active' => true,
        ]);
        $customer = User::create([
            'name' => 'Customer',
            'email' => 'customer@example.com',
            'password' => 'password123',
            'is_active' => true,
        ]);
        $category = Category::create([
            'name' => 'Electronics',
            'slug' => 'electronics',
        ]);
        Product::create([
            'category_id' => $category->id,
            'name' => 'Mouse',
            'slug' => 'mouse',
            'price' => 10,
            'stock' => 3,
        ]);
        Product::create([
            'category_id' => $category->id,
            'name' => 'Premium Keyboard',
            'slug' => 'premium-keyboard',
            'price' => 45,
            'stock' => 2,
        ]);
        $otherCategory = Category::create([
            'name' => 'Accessories',
            'slug' => 'accessories',
        ]);
        Product::create([
            'category_id' => $otherCategory->id,
            'name' => 'Mouse Pad',
            'slug' => 'mouse-pad',
            'price' => 30,
            'stock' => 5,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/users')
            ->assertOk()
            ->assertJsonPath('0.id', $customer->id)
            ->assertJsonPath('0.role', 'user')
            ->assertJsonPath('0.is_active', true)
            ->assertJsonPath('0.orders_count', 0);

        $this->getJson('/api/admin/categories')
            ->assertOk()
            ->assertJsonPath('0.products_count', 1);

        $this->postJson('/api/admin/categories', [
            'name' => 'Home Goods',
            'slug' => 'home-goods',
        ])
            ->assertCreated()
            ->assertJsonPath('slug', 'home-goods');

        $this->putJson("/api/admin/categories/{$category->id}", [
            'name' => 'Consumer Electronics',
            'slug' => 'consumer-electronics',
        ])
            ->assertOk()
            ->assertJsonPath('slug', 'consumer-electronics');

        $this->patchJson("/api/admin/users/{$customer->id}/role", ['role' => 'admin'])
            ->assertOk()
            ->assertJsonPath('role', 'admin');
    }

    public function test_deactivated_users_are_rejected_and_their_tokens_are_revoked(): void
    {
        $admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => 'password123',
            'role' => 'admin',
            'is_active' => true,
        ]);
        $customer = User::create([
            'name' => 'Customer',
            'email' => 'customer@example.com',
            'password' => 'password123',
            'is_active' => true,
        ]);
        $token = $customer->createToken('test')->plainTextToken;

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/users/{$customer->id}/status", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('is_active', false);

        auth()->forgetGuards();
        $this->withToken($token)
            ->getJson('/api/me')
            ->assertUnauthorized();

        $this->postJson('/api/login', [
            'email' => $customer->email,
            'password' => 'password123',
        ])->assertForbidden();
    }

    public function test_public_product_filters_and_admin_multipart_method_override_work(): void
    {
        $admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => 'password123',
            'role' => 'admin',
            'is_active' => true,
        ]);
        $category = Category::create([
            'name' => 'Electronics',
            'slug' => 'electronics',
        ]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Wireless Mouse',
            'slug' => 'wireless-mouse',
            'description' => 'Wireless pointing device',
            'price' => 29.99,
            'stock' => 3,
        ]);

        $this->getJson('/api/products?search=pointing&category=electronics&sort=price_asc&page=1')
            ->assertOk()
            ->assertJsonPath('data.0.id', $product->id)
            ->assertJsonPath('data.0.category.slug', 'electronics');

        $this->getJson('/api/products?category=electronics&min_price=25&max_price=35')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $product->id);

        $this->getJson('/api/products?min_price=35&max_price=25')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('max_price');

        Storage::fake('public');
        $this->actingAs($admin, 'sanctum')
            ->post("/api/admin/products/{$product->id}", [
                '_method' => 'PUT',
                'name' => 'Updated Mouse',
                'category_id' => $category->id,
                'price' => '34.50',
                'stock' => '4',
                'is_active' => '1',
                'image' => UploadedFile::fake()->create('mouse.jpg', 10, 'image/jpeg'),
            ])
            ->assertOk()
            ->assertJsonPath('name', 'Updated Mouse')
            ->assertJsonPath('image_url', fn ($url) => str_contains($url, 'products/'));
    }

    public function test_customer_cannot_access_another_customers_cart_item_or_order(): void
    {
        $owner = User::create([
            'name' => 'Owner',
            'email' => 'owner@example.com',
            'password' => 'password123',
            'is_active' => true,
        ]);
        $other = User::create([
            'name' => 'Other',
            'email' => 'other@example.com',
            'password' => 'password123',
            'is_active' => true,
        ]);
        $category = Category::create([
            'name' => 'Books',
            'slug' => 'books',
        ]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Book',
            'slug' => 'book',
            'price' => 10,
            'stock' => 2,
        ]);
        $cartItem = $owner->cartItems()->create([
            'product_id' => $product->id,
            'quantity' => 1,
        ]);
        $order = Order::create([
            'user_id' => $owner->id,
            'total' => 10,
            'status' => 'pending',
            'payment_method' => 'cod',
            'payment_status' => 'unpaid',
            'address' => '1 Example Street',
            'city' => 'Cairo',
            'phone' => '01012345678',
        ]);

        $this->actingAs($other, 'sanctum')
            ->putJson("/api/cart/{$cartItem->id}", ['quantity' => 2])
            ->assertForbidden();

        $this->getJson("/api/orders/{$order->id}")
            ->assertForbidden();
    }

    public function test_checkout_uses_database_prices_and_cancellation_restores_stock_once(): void
    {
        $customer = User::create([
            'name' => 'Customer',
            'email' => 'customer@example.com',
            'password' => 'password123',
            'is_active' => true,
        ]);
        $admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => 'password123',
            'role' => 'admin',
            'is_active' => true,
        ]);
        $category = Category::create([
            'name' => 'Books',
            'slug' => 'books',
        ]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Book',
            'slug' => 'book',
            'price' => 12.50,
            'stock' => 4,
        ]);
        $customer->cartItems()->create([
            'product_id' => $product->id,
            'quantity' => 2,
        ]);

        $response = $this->actingAs($customer, 'sanctum')
            ->postJson('/api/orders', [
                'address' => '1 Example Street',
                'city' => 'Cairo',
                'phone' => '01012345678',
                'payment_method' => 'cod',
                'total' => 0.01,
            ])
            ->assertCreated()
            ->assertJsonPath('order.total', '25.00');

        $orderId = $response->json('order.id');
        $this->assertSame(2, $response->json('order.items.0.quantity'));
        $this->assertSame('12.50', $response->json('order.items.0.price'));
        $this->assertSame(2, $product->fresh()->stock);
        $this->assertDatabaseMissing('cart_items', ['user_id' => $customer->id]);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/orders/{$orderId}/status", ['status' => 'cancelled'])
            ->assertOk()
            ->assertJsonPath('status', 'cancelled');

        $this->assertSame(4, $product->fresh()->stock);

        $this->patchJson("/api/admin/orders/{$orderId}/status", ['status' => 'cancelled'])
            ->assertStatus(422);

        $this->assertSame(4, $product->fresh()->stock);
    }
}
