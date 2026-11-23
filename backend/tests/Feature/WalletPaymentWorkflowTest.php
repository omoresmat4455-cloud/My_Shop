<?php

namespace Tests\Feature;

use App\Models\CartItem;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class WalletPaymentWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_wallet_order_uses_database_prices_and_returns_transfer_instructions(): void
    {
        $user = $this->createUser();
        $product = $this->createProduct(stock: 3);
        $this->actingAs($user, 'sanctum')
            ->postJson('/api/cart', [
                'product_id' => $product->id,
                'quantity' => 2,
            ])->assertOk();

        $this->postJson('/api/orders', [
            'payment_method' => 'vodafone',
            'address' => '1 Main Street',
            'city' => 'Cairo',
            'phone' => '01012345678',
            'total' => 0.01,
            'user_id' => 999,
            'payment_status' => 'paid',
        ], ['Idempotency-Key' => 'wallet-order-key-001'])
            ->assertCreated()
            ->assertJsonPath('order.payment_method', 'vodafone')
            ->assertJsonPath('order.payment_status', 'awaiting_payment_confirmation')
            ->assertJsonPath('order.total', '25.00')
            ->assertJsonPath('payment_instructions.recipient_number', '01018674258')
            ->assertJsonPath('payment_instructions.amount_egp', '25.00')
            ->assertJsonPath('message', 'تم إنشاء الطلب. أكمل التحويل إلى المحفظة وأرسل بيانات التحويل للتحقق.');

        $this->assertSame(1, $product->fresh()->stock);
        $this->assertDatabaseHas('orders', ['user_id' => $user->id, 'total' => 25]);
    }

    public function test_wallet_order_is_not_created_with_an_invalid_configured_recipient_number(): void
    {
        config(['services.wallets.recipient_number' => 'not-a-number']);
        $user = $this->createUser('invalid-wallet-number@example.com');
        $product = $this->createProduct(stock: 2);
        $this->actingAs($user, 'sanctum')
            ->postJson('/api/cart', [
                'product_id' => $product->id,
                'quantity' => 1,
            ])->assertOk();

        $this->postJson('/api/orders', [
            'payment_method' => 'vodafone',
            'address' => '1 Main Street',
            'city' => 'Cairo',
            'phone' => '01012345678',
        ])->assertStatus(503);

        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(2, $product->fresh()->stock);
    }

    public function test_order_creation_is_idempotent_and_does_not_reduce_stock_twice(): void
    {
        $user = $this->createUser('idempotent@example.com');
        $product = $this->createProduct(stock: 2);
        $this->actingAs($user, 'sanctum')
            ->postJson('/api/cart', [
                'product_id' => $product->id,
                'quantity' => 1,
            ])->assertOk();

        $payload = [
            'payment_method' => 'cod',
            'address' => '1 Main Street',
            'city' => 'Cairo',
            'phone' => '01012345678',
        ];
        $headers = ['Idempotency-Key' => 'repeat-order-key-001'];
        $first = $this->postJson('/api/orders', $payload, $headers)->assertCreated();
        $second = $this->postJson('/api/orders', $payload, $headers)->assertOk();

        $this->assertSame($first->json('order.id'), $second->json('order.id'));
        $this->assertDatabaseCount('orders', 1);
        $this->assertSame(1, $product->fresh()->stock);
    }

    public function test_order_creation_rechecks_stale_cart_stock_without_partial_order(): void
    {
        $user = $this->createUser('stale-cart@example.com');
        $product = $this->createProduct(stock: 1);
        CartItem::create([
            'user_id' => $user->id,
            'product_id' => $product->id,
            'quantity' => 2,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/orders', [
                'payment_method' => 'cod',
                'address' => '1 Main Street',
                'city' => 'Cairo',
                'phone' => '01012345678',
            ])->assertUnprocessable();

        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(1, $product->fresh()->stock);
        $this->assertDatabaseHas('cart_items', ['user_id' => $user->id, 'quantity' => 2]);
    }

    public function test_wallet_submission_is_pending_until_an_admin_approves_it(): void
    {
        $customer = $this->createUser('wallet-buyer@example.com');
        $order = $this->createOrder($customer, 'orange');
        $otherCustomer = $this->createUser('not-owner@example.com');
        $admin = $this->createUser('wallet-admin@example.com', 'admin');

        $this->actingAs($otherCustomer, 'sanctum')
            ->postJson("/api/orders/{$order->id}/wallet-transfer", [
                'transaction_reference' => 'ORANGE-REF-111',
                'wallet_sender_phone' => '01234567890',
            ])->assertForbidden();

        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/orders/{$order->id}/wallet-transfer", [
                'transaction_reference' => 'ORANGE-REF-111',
                'wallet_sender_phone' => '01234567890',
            ])
            ->assertCreated()
            ->assertJsonPath('order.payment_status', 'awaiting_payment_confirmation')
            ->assertJsonPath('payment_attempt.status', 'awaiting_verification')
            ->assertJsonPath('message', 'تم إرسال بيانات التحويل للمراجعة. لم يتم تأكيد الدفع بعد.');
        $this->postJson("/api/orders/{$order->id}/wallet-transfer", [
            'transaction_reference' => 'ORANGE-REF-112',
            'wallet_sender_phone' => '01234567890',
        ])->assertStatus(409);

        $this->assertSame('awaiting_payment_confirmation', $order->fresh()->payment_status);
        $this->assertDatabaseCount('payment_attempts', 1);
        $this->getJson('/api/orders')
            ->assertOk()
            ->assertJsonPath('0.latest_payment_attempt.status', 'awaiting_verification');
        $this->actingAs($customer, 'sanctum')
            ->getJson('/api/admin/wallet-transfers')
            ->assertForbidden();
        $this->postJson('/api/admin/wallet-transfers/1/review', [
            'decision' => 'approved',
        ])->assertForbidden();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/wallet-transfers')
            ->assertOk()
            ->assertJsonPath('0.order_reference', (string) $order->id)
            ->assertJsonPath('0.wallet_method', 'orange')
            ->assertJsonPath('0.wallet_sender_phone', '01234567890')
            ->assertJsonPath('0.transaction_reference', 'ORANGE-REF-111');

        $attempt = $order->paymentAttempts()->firstOrFail();
        $this->patchJson("/api/admin/orders/{$order->id}/status", [
            'status' => 'processing',
        ])->assertUnprocessable();
        $this->postJson("/api/admin/wallet-transfers/{$attempt->id}/review", [
            'decision' => 'approved',
        ])->assertOk()
            ->assertJsonPath('payment_attempt.status', 'approved')
            ->assertJsonPath('order.payment_status', 'paid')
            ->assertJsonPath('order.status', 'processing');

        $this->assertSame($admin->id, $order->fresh()->payment_verified_by);
        $this->assertSame($admin->id, $attempt->fresh()->reviewed_by);
        $this->patchJson("/api/admin/orders/{$order->id}/status", [
            'status' => 'cancelled',
        ])->assertUnprocessable();
        $this->postJson("/api/admin/wallet-transfers/{$attempt->id}/review", [
            'decision' => 'approved',
        ])->assertStatus(409);
    }

    public function test_wallet_transfer_requires_valid_proof_and_rejects_reused_references(): void
    {
        $customer = $this->createUser('wallet-proof@example.com');
        $firstOrder = $this->createOrder($customer, 'vodafone');
        $secondOrder = $this->createOrder($customer, 'vodafone');
        Storage::fake('local');

        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/orders/{$firstOrder->id}/wallet-transfer", [])
            ->assertUnprocessable();

        $this->postJson("/api/orders/{$firstOrder->id}/wallet-transfer", [
            'wallet_sender_phone' => '01234567890',
        ])->assertUnprocessable();

        $this->postJson("/api/orders/{$firstOrder->id}/wallet-transfer", [
            'receipt' => UploadedFile::fake()->create('receipt.txt', 1, 'text/plain'),
            'wallet_sender_phone' => '01234567890',
        ])->assertUnprocessable();

        $this->postJson("/api/orders/{$firstOrder->id}/wallet-transfer", [
            'receipt' => UploadedFile::fake()->create('receipt.png', 6000, 'image/png'),
            'wallet_sender_phone' => '01234567890',
        ])->assertUnprocessable();

        $this->postJson("/api/orders/{$firstOrder->id}/wallet-transfer", [
            'transaction_reference' => 'WALLET-UNIQUE-001',
            'wallet_sender_phone' => '01234567890',
        ])->assertCreated();

        $this->postJson("/api/orders/{$secondOrder->id}/wallet-transfer", [
            'transaction_reference' => 'WALLET-UNIQUE-001',
            'wallet_sender_phone' => '01123456789',
        ])->assertUnprocessable();
    }

    public function test_wallet_receipt_is_private_and_only_available_to_an_admin(): void
    {
        Storage::fake('local');
        $customer = $this->createUser('receipt-owner@example.com');
        $admin = $this->createUser('receipt-admin@example.com', 'admin');
        $order = $this->createOrder($customer, 'etisalat');
        $customerResponse = $this->actingAs($customer, 'sanctum')
            ->postJson("/api/orders/{$order->id}/wallet-transfer", [
                'receipt' => UploadedFile::fake()->create('receipt.png', 1, 'image/png'),
                'wallet_sender_phone' => '01234567890',
            ])->assertCreated();
        $attemptId = $customerResponse->json('payment_attempt.id');
        $attempt = $order->paymentAttempts()->findOrFail($attemptId);

        $this->actingAs($customer, 'sanctum')
            ->get("/api/admin/wallet-transfers/{$attemptId}/receipt")
            ->assertForbidden();
        $this->actingAs($admin, 'sanctum')
            ->get("/api/admin/wallet-transfers/{$attemptId}/receipt")
            ->assertOk();

        Storage::disk('local')->assertExists($attempt->receipt_path);
    }

    public function test_rejected_wallet_transfer_remains_unpaid_and_can_be_resubmitted(): void
    {
        $customer = $this->createUser('wallet-retry@example.com');
        $admin = $this->createUser('wallet-reviewer@example.com', 'admin');
        $order = $this->createOrder($customer, 'etisalat');
        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/orders/{$order->id}/wallet-transfer", [
                'transaction_reference' => 'ETISALAT-REF-1',
                'wallet_sender_phone' => '01123456789',
            ])->assertCreated();

        $firstAttempt = $order->paymentAttempts()->firstOrFail();
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/wallet-transfers/{$firstAttempt->id}/review", [
                'decision' => 'rejected',
                'reason' => 'Transaction not found in merchant statement.',
            ])->assertOk()
            ->assertJsonPath('order.payment_status', 'failed');

        $this->assertNull($order->fresh()->paid_at);
        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/orders/{$order->id}/wallet-transfer", [
                'transaction_reference' => 'ETISALAT-REF-2',
                'wallet_sender_phone' => '01123456789',
            ])->assertCreated()
            ->assertJsonPath('order.payment_status', 'awaiting_payment_confirmation');
        $this->assertDatabaseCount('payment_attempts', 2);
    }

    public function test_cod_is_not_marked_paid_on_delivery_until_an_admin_records_collection(): void
    {
        $customer = $this->createUser('cod-customer@example.com');
        $admin = $this->createUser('cod-admin@example.com', 'admin');
        $order = $this->createOrder($customer, 'cod');
        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertOk()
            ->assertJsonPath('payment_status', 'unpaid');

        $this->patchJson("/api/admin/orders/{$order->id}/cod-payment", ['collected' => true])
            ->assertOk()
            ->assertJsonPath('order.payment_status', 'paid');
        $this->assertSame($admin->id, $order->fresh()->payment_verified_by);
    }

    private function createUser(string $email = 'wallet-customer@example.com', string $role = 'customer'): User
    {
        return User::create([
            'name' => 'Test Customer',
            'email' => $email,
            'password' => 'password123',
            'role' => $role,
            'is_active' => true,
        ]);
    }

    private function createProduct(int $stock): Product
    {
        $category = Category::create(['name' => 'Food', 'slug' => 'food']);

        return Product::create([
            'category_id' => $category->id,
            'name' => 'Test Product',
            'slug' => 'test-product',
            'price' => 12.50,
            'stock' => $stock,
            'is_active' => true,
        ]);
    }

    private function createOrder(User $user, string $method): Order
    {
        return Order::create([
            'user_id' => $user->id,
            'total' => 25,
            'status' => 'pending',
            'payment_method' => $method,
            'payment_status' => in_array($method, ['vodafone', 'orange', 'etisalat'], true)
                ? 'awaiting_payment_confirmation'
                : 'unpaid',
            'address' => '1 Example Street',
            'city' => 'Cairo',
            'phone' => '01012345678',
        ]);
    }
}
