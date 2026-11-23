<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\User;
use App\Services\PaymobService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymobWebhookTest extends TestCase
{
    use RefreshDatabase;

    public function test_webhook_rejects_a_valid_provider_hmac_with_a_tampered_merchant_reference(): void
    {
        config(['services.paymob.hmac' => 'test-paymob-hmac-secret']);

        $user = User::create([
            'name' => 'Customer',
            'email' => 'paymob@example.com',
            'password' => 'password123',
            'is_active' => true,
        ]);
        $attackerOrder = $this->createOrder($user, 12.50);
        $targetOrder = $this->createOrder($user, 12.50);
        $paymob = app(PaymobService::class);
        $reference = $paymob->merchantOrderReference($attackerOrder);
        $tamperedReference = preg_replace(
            '/\A'.$attackerOrder->id.'/',
            (string) $targetOrder->id,
            $reference
        );
        $payload = $this->signedSuccessPayload($tamperedReference);

        $this->postJson('/api/paymob/webhook?hmac='.$payload['hmac'], [
            'obj' => $payload['data'],
        ])->assertForbidden()
            ->assertJsonPath('message', 'Invalid merchant reference');

        $this->assertSame('unpaid', $targetOrder->fresh()->payment_status);
    }

    public function test_webhook_accepts_a_valid_signed_reference_and_provider_hmac(): void
    {
        config([
            'services.paymob.hmac' => 'test-paymob-hmac-secret',
            'services.paymob.integration_ids.card' => 123,
        ]);

        $user = User::create([
            'name' => 'Customer',
            'email' => 'valid-paymob@example.com',
            'password' => 'password123',
            'is_active' => true,
        ]);
        $order = $this->createOrder($user, 12.50);
        $reference = app(PaymobService::class)->merchantOrderReference($order);
        $this->createCardAttempt($order, $reference);
        $payload = $this->signedSuccessPayload($reference);

        $this->postJson('/api/paymob/webhook?hmac='.$payload['hmac'], [
            'obj' => $payload['data'],
        ])->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_duplicate_paymob_success_callback_is_idempotent(): void
    {
        config([
            'services.paymob.hmac' => 'test-paymob-hmac-secret',
            'services.paymob.integration_ids.card' => 123,
        ]);
        $user = User::create([
            'name' => 'Customer',
            'email' => 'duplicate-webhook@example.com',
            'password' => 'password123',
            'is_active' => true,
        ]);
        $order = $this->createOrder($user, 12.50);
        $reference = app(PaymobService::class)->merchantOrderReference($order);
        $attempt = $this->createCardAttempt($order, $reference);
        $payload = $this->signedSuccessPayload($reference);

        foreach ([1, 2] as $_) {
            $this->postJson('/api/paymob/webhook?hmac='.$payload['hmac'], [
                'obj' => $payload['data'],
            ])->assertOk()->assertJsonPath('payment_status', 'paid');
        }

        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertSame('paid', $attempt->fresh()->status);
        $this->assertDatabaseCount('payment_attempts', 1);
    }

    public function test_webhook_rejects_incorrect_amount_without_marking_paid(): void
    {
        config([
            'services.paymob.hmac' => 'test-paymob-hmac-secret',
            'services.paymob.integration_ids.card' => 123,
        ]);
        $user = User::create([
            'name' => 'Customer',
            'email' => 'wrong-amount@example.com',
            'password' => 'password123',
            'is_active' => true,
        ]);
        $order = $this->createOrder($user, 12.50);
        $reference = app(PaymobService::class)->merchantOrderReference($order);
        $this->createCardAttempt($order, $reference);
        $payload = $this->signedSuccessPayload($reference, amountCents: 1251);

        $this->postJson('/api/paymob/webhook?hmac='.$payload['hmac'], [
            'obj' => $payload['data'],
        ])->assertForbidden()
            ->assertJsonPath('message', 'Invalid payment amount');

        $this->assertSame('unpaid', $order->fresh()->payment_status);
    }

    public function test_webhook_rejects_a_valid_hmac_from_an_unconfigured_integration(): void
    {
        config([
            'services.paymob.hmac' => 'test-paymob-hmac-secret',
            'services.paymob.integration_ids.card' => 123,
        ]);

        $user = User::create([
            'name' => 'Customer',
            'email' => 'wrong-integration@example.com',
            'password' => 'password123',
            'is_active' => true,
        ]);
        $order = $this->createOrder($user, 12.50);
        $reference = app(PaymobService::class)->merchantOrderReference($order);
        $this->createCardAttempt($order, $reference);
        $payload = $this->signedSuccessPayload($reference, 456);

        $this->postJson('/api/paymob/webhook?hmac='.$payload['hmac'], [
            'obj' => $payload['data'],
        ])->assertForbidden()
            ->assertJsonPath('message', 'Invalid payment integration');

        $this->assertSame('unpaid', $order->fresh()->payment_status);
    }

    public function test_paymob_webhook_cannot_approve_a_manual_wallet_transfer(): void
    {
        config([
            'services.paymob.hmac' => 'test-paymob-hmac-secret',
            'services.paymob.integration_ids.card' => 123,
            'services.paymob.integration_ids.vodafone' => 456,
        ]);

        $user = User::create([
            'name' => 'Customer',
            'email' => 'wallet-webhook@example.com',
            'password' => 'password123',
            'is_active' => true,
        ]);
        $order = $this->createOrder($user, 12.50, 'vodafone');
        $reference = app(PaymobService::class)->merchantOrderReference($order);
        $order->paymentAttempts()->create([
            'method' => 'vodafone',
            'status' => 'awaiting_verification',
            'merchant_reference' => $reference,
        ]);
        $payload = $this->signedSuccessPayload($reference, 456);

        $this->postJson('/api/paymob/webhook?hmac='.$payload['hmac'], [
            'obj' => $payload['data'],
        ])->assertForbidden()
            ->assertJsonPath('message', 'Invalid payment integration');

        $this->assertSame('awaiting_payment_confirmation', $order->fresh()->payment_status);
    }

    private function createOrder(User $user, float $total, string $method = 'card'): Order
    {
        return Order::create([
            'user_id' => $user->id,
            'total' => $total,
            'status' => 'pending',
            'payment_method' => $method,
            'payment_status' => $method === 'card' ? 'unpaid' : 'awaiting_payment_confirmation',
            'address' => '1 Example Street',
            'city' => 'Cairo',
            'phone' => '01012345678',
        ]);
    }

    private function createCardAttempt(Order $order, string $reference): PaymentAttempt
    {
        return $order->paymentAttempts()->create([
            'method' => 'card',
            'status' => 'pending',
            'merchant_reference' => $reference,
        ]);
    }

    private function signedSuccessPayload(
        string $merchantOrderId,
        int $integrationId = 123,
        int $amountCents = 1250
    ): array {
        $data = [
            'amount_cents' => $amountCents,
            'created_at' => '2026-10-14T12:00:00Z',
            'currency' => 'EGP',
            'error_occured' => false,
            'has_parent_transaction' => false,
            'id' => 987654,
            'integration_id' => $integrationId,
            'is_3d_secure' => true,
            'is_auth' => true,
            'is_capture' => false,
            'is_refunded' => false,
            'is_standalone_payment' => true,
            'is_voided' => false,
            'order' => [
                'id' => 987,
                'merchant_order_id' => $merchantOrderId,
            ],
            'owner' => 123,
            'pending' => false,
            'source_data' => [
                'pan' => '2346',
                'sub_type' => 'VISA',
                'type' => 'card',
            ],
            'success' => true,
        ];
        $keys = [
            'amount_cents',
            'created_at',
            'currency',
            'error_occured',
            'has_parent_transaction',
            'id',
            'integration_id',
            'is_3d_secure',
            'is_auth',
            'is_capture',
            'is_refunded',
            'is_standalone_payment',
            'is_voided',
            'order.id',
            'owner',
            'pending',
            'source_data.pan',
            'source_data.sub_type',
            'source_data.type',
            'success',
        ];
        $hmacContent = '';
        foreach ($keys as $key) {
            $value = data_get($data, $key);
            $hmacContent .= is_bool($value) ? ($value ? 'true' : 'false') : $value;
        }

        return [
            'data' => $data,
            'hmac' => hash_hmac('sha512', $hmacContent, config('services.paymob.hmac')),
        ];
    }
}
