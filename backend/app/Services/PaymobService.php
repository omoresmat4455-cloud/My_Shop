<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class PaymobService
{
    public function isCardCheckoutConfigured(): bool
    {
        $integrationId = filter_var(
            config('services.paymob.integration_ids.card'),
            FILTER_VALIDATE_INT
        );
        $frontendUrl = config('app.frontend_url');
        $apiUrl = config('app.url');

        return is_string(config('services.paymob.secret_key')) &&
            config('services.paymob.secret_key') !== '' &&
            is_string(config('services.paymob.public_key')) &&
            config('services.paymob.public_key') !== '' &&
            is_string(config('services.paymob.hmac')) &&
            config('services.paymob.hmac') !== '' &&
            $integrationId !== false &&
            $integrationId > 0 &&
            is_string($frontendUrl) &&
            in_array(parse_url($frontendUrl, PHP_URL_SCHEME), ['http', 'https'], true) &&
            is_string(parse_url($frontendUrl, PHP_URL_HOST)) &&
            is_string($apiUrl) &&
            parse_url($apiUrl, PHP_URL_SCHEME) === 'https' &&
            is_string(parse_url($apiUrl, PHP_URL_HOST));
    }

    public function createPaymentUrl(
        Order $order,
        ?string $paymentMethod = null,
        ?string $merchantReference = null
    ): string {
        if (! $this->isCardCheckoutConfigured()) {
            throw new RuntimeException('Paymob card checkout is not configured.');
        }

        $paymentMethod ??= $order->payment_method;
        $integrationId = $this->integrationIdFor($paymentMethod);
        $secretKey = config('services.paymob.secret_key');
        $publicKey = config('services.paymob.public_key');
        $frontendUrl = config('app.frontend_url');

        if (! is_string($secretKey) || $secretKey === '' ||
            ! is_string($publicKey) || $publicKey === '' ||
            ! is_string($frontendUrl) || ! in_array(parse_url($frontendUrl, PHP_URL_SCHEME), ['http', 'https'], true)) {
            throw new RuntimeException('Paymob checkout is not fully configured.');
        }

        $user = $order->user;
        $nameParts = preg_split('/\s+/', trim($user->name), 2);
        $response = Http::withHeaders([
            'Authorization' => 'Token '.$secretKey,
        ])->connectTimeout(5)->timeout(20)->post('https://accept.paymob.com/v1/intention/', [
            // amounts are in piasters (1 EGP = 100)
            'amount' => (int) round($order->total * 100),
            'currency' => 'EGP',
            'payment_methods' => [$integrationId],
            'items' => $order->items->map(fn ($item) => [
                'name' => $item->product->name,
                'amount' => (int) round($item->price * 100),
                'description' => $item->product->name,
                'quantity' => $item->quantity,
            ])->values()->all(),
            'billing_data' => [
                'first_name' => $nameParts[0],
                'last_name' => $nameParts[1] ?? 'NA',
                'email' => $user->email,
                'phone_number' => $order->phone,
            ],
            'special_reference' => $merchantReference ?? $this->merchantOrderReference($order),
            'notification_url' => url('/api/paymob/webhook'),
            'redirection_url' => rtrim($frontendUrl, '/').'/payment/result?'.http_build_query([
                'order_id' => $order->id,
            ], '', '&', PHP_QUERY_RFC3986),
        ])->throw()->json();

        $clientSecret = data_get($response, 'client_secret');
        if (! is_string($clientSecret) || $clientSecret === '') {
            throw new RuntimeException('Paymob did not return a checkout session.');
        }

        return 'https://accept.paymob.com/unifiedcheckout/?'.http_build_query([
            'publicKey' => $publicKey,
            'clientSecret' => $clientSecret,
        ], '', '&', PHP_QUERY_RFC3986);
    }

    public function integrationIdFor(string $paymentMethod): int
    {
        $integrationId = config('services.paymob.integration_ids.'.$paymentMethod);
        $validatedIntegrationId = filter_var($integrationId, FILTER_VALIDATE_INT);
        if ($validatedIntegrationId === false || $validatedIntegrationId < 1) {
            throw new RuntimeException('Paymob integration is not configured for the selected payment method.');
        }

        return $validatedIntegrationId;
    }

    public function paymentMethodForIntegrationId(int $integrationId): ?string
    {
        $matches = [];
        foreach (config('services.paymob.integration_ids', []) as $method => $configuredId) {
            $validatedId = filter_var($configuredId, FILTER_VALIDATE_INT);
            if ($validatedId !== false && $validatedId === $integrationId) {
                $matches[] = $method;
            }
        }

        return count($matches) === 1 ? $matches[0] : null;
    }

    public function validHmac(array $data, string $hmac): bool
    {
        $secret = config('services.paymob.hmac');
        if (! is_string($secret) || $secret === '' || ! preg_match('/\A[a-f0-9]{128}\z/i', $hmac)) {
            return false;
        }

        // Fields must be concatenated in this exact (alphabetical) order
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
        $string = '';
        foreach ($keys as $key) {
            $value = data_get($data, $key);
            $string .= is_bool($value) ? ($value ? 'true' : 'false') : $value;
        }
        $calculated = hash_hmac('sha512', $string, $secret);

        return hash_equals($calculated, strtolower($hmac));
    }

    public function merchantOrderReference(Order $order): string
    {
        $secret = config('services.paymob.hmac');
        if (! is_string($secret) || $secret === '') {
            throw new RuntimeException('Paymob HMAC secret is not configured.');
        }

        $payload = $order->id.'-'.time().'-'.bin2hex(random_bytes(16));

        return $payload.'-'.hash_hmac('sha256', $payload, $secret);
    }

    public function orderIdFromMerchantReference(string $reference): ?int
    {
        if (! preg_match('/\A([1-9][0-9]*)-([0-9]{10,})-([a-f0-9]{32})-([a-f0-9]{64})\z/i', $reference, $matches)) {
            return null;
        }

        $payload = $matches[1].'-'.$matches[2].'-'.strtolower($matches[3]);
        $secret = config('services.paymob.hmac');
        if (! is_string($secret) || $secret === '') {
            return null;
        }

        $expected = hash_hmac('sha256', $payload, $secret);
        if (! hash_equals($expected, strtolower($matches[4]))) {
            return null;
        }

        return (int) $matches[1];
    }
}
