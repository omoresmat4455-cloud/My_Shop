<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Services\PaymobService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class PaymentController extends Controller
{
    public function availableMethods(PaymobService $paymob)
    {
        $recipientNumber = config('services.wallets.recipient_number');
        $walletsAvailable = is_string($recipientNumber) &&
            preg_match('/\A01[0-9]{9}\z/', $recipientNumber) === 1;
        $cardAvailable = $paymob->isCardCheckoutConfigured();

        return response()->json([
            'methods' => [
                ['id' => 'cod', 'enabled' => true],
                ['id' => 'vodafone', 'enabled' => $walletsAvailable],
                ['id' => 'orange', 'enabled' => $walletsAvailable],
                ['id' => 'etisalat', 'enabled' => $walletsAvailable],
                [
                    'id' => 'card',
                    'enabled' => $cardAvailable,
                    'message' => $cardAvailable
                        ? null
                        : 'الدفع بالبطاقة غير متاح حاليًا. يرجى استخدام طريقة دفع أخرى.',
                ],
            ],
        ]);
    }

    public function submitWalletTransfer(Request $request, Order $order)
    {
        abort_if($order->user_id !== $request->user()->id, 403);
        $data = $request->validate([
            'wallet_sender_phone' => ['required', 'string', 'regex:/^01[0-9]{9}$/'],
            'transaction_reference' => [
                'required_without:receipt',
                'nullable',
                'string',
                'max:255',
                'unique:payment_attempts,transaction_reference',
            ],
            'receipt' => [
                'required_without:transaction_reference',
                'nullable',
                'file',
                'mimes:jpg,jpeg,png,pdf',
                'mimetypes:image/jpeg,image/png,application/pdf',
                'max:5120',
            ],
        ]);

        abort_unless(
            in_array($order->payment_method, ['vodafone', 'orange', 'etisalat'], true),
            422,
            'This order does not use a mobile wallet.'
        );

        $receiptPath = isset($data['receipt'])
            ? $data['receipt']->store('wallet-receipts', 'local')
            : null;

        try {
            $attempt = DB::transaction(function () use ($order, $data, $receiptPath) {
                $lockedOrder = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
                abort_if(
                    $lockedOrder->status === 'cancelled' ||
                    $lockedOrder->payment_status === 'paid',
                    422,
                    'This order cannot accept another payment submission.'
                );
                abort_if(
                    $lockedOrder->paymentAttempts()
                        ->where('status', 'awaiting_verification')
                        ->exists(),
                    409,
                    'تم استلام بيانات تحويل لهذا الطلب وهي قيد المراجعة.'
                );

                $attempt = $lockedOrder->paymentAttempts()->create([
                    'method' => $lockedOrder->payment_method,
                    'status' => 'awaiting_verification',
                    'transaction_reference' => $data['transaction_reference'] ?? null,
                    'wallet_sender_phone' => $data['wallet_sender_phone'],
                    'receipt_path' => $receiptPath,
                    'submitted_at' => now(),
                ]);
                $lockedOrder->update([
                    'payment_status' => 'awaiting_payment_confirmation',
                ]);

                return $attempt;
            }, 3);
        } catch (\Throwable $exception) {
            if ($receiptPath !== null) {
                Storage::disk('local')->delete($receiptPath);
            }

            throw $exception;
        }

        return response()->json([
            'order' => $order->fresh(),
            'payment_attempt' => $attempt,
            'message' => 'تم إرسال بيانات التحويل للمراجعة. لم يتم تأكيد الدفع بعد.',
        ], 201);
    }

    public function pendingWalletTransfers()
    {
        return PaymentAttempt::with(['order.user'])
            ->where('status', 'awaiting_verification')
            ->whereIn('method', ['vodafone', 'orange', 'etisalat'])
            ->oldest()
            ->get()
            ->map(fn (PaymentAttempt $attempt) => [
                'id' => $attempt->id,
                'order_reference' => (string) $attempt->order->id,
                'customer' => [
                    'id' => $attempt->order->user->id,
                    'name' => $attempt->order->user->name,
                    'email' => $attempt->order->user->email,
                ],
                'amount_egp' => $attempt->order->total,
                'wallet_method' => $attempt->method,
                'wallet_sender_phone' => $attempt->wallet_sender_phone,
                'transaction_reference' => $attempt->transaction_reference,
                'submitted_at' => $attempt->submitted_at,
                'receipt_url' => $attempt->receipt_path
                    ? url('/api/admin/wallet-transfers/'.$attempt->id.'/receipt')
                    : null,
            ]);
    }

    public function reviewWalletTransfer(Request $request, PaymentAttempt $attempt)
    {
        $data = $request->validate([
            'decision' => 'required|in:approved,rejected',
            'reason' => 'nullable|string|max:1000',
        ]);

        $attempt = DB::transaction(function () use ($attempt, $data, $request) {
            $lockedAttempt = PaymentAttempt::whereKey($attempt->id)
                ->lockForUpdate()
                ->firstOrFail();
            abort_unless(
                in_array($lockedAttempt->method, ['vodafone', 'orange', 'etisalat'], true) &&
                $lockedAttempt->status === 'awaiting_verification',
                409,
                'This transfer has already been reviewed or is not a wallet transfer.'
            );

            $order = Order::whereKey($lockedAttempt->order_id)
                ->lockForUpdate()
                ->firstOrFail();
            abort_if(
                $order->status === 'cancelled' ||
                $order->payment_status === 'paid' ||
                $order->payment_method !== $lockedAttempt->method ||
                $order->payment_status !== 'awaiting_payment_confirmation',
                409,
                'The order payment state changed and must be reconciled before review.'
            );

            $lockedAttempt->update([
                'status' => $data['decision'],
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
                'review_reason' => $data['reason'] ?? null,
            ]);

            if ($data['decision'] === 'approved') {
                $order->update([
                    'payment_status' => 'paid',
                    'paid_at' => now(),
                    'payment_verified_by' => $request->user()->id,
                    'status' => $order->status === 'pending' ? 'processing' : $order->status,
                ]);
            } else {
                $order->update(['payment_status' => 'failed']);
            }

            return $lockedAttempt->load('order');
        }, 3);

        return response()->json([
            'payment_attempt' => $attempt,
            'order' => $attempt->order,
            'message' => $data['decision'] === 'approved'
                ? 'تم التحقق من التحويل وتأكيد الدفع.'
                : 'تم رفض التحويل. يمكن للعميل إرسال بيانات تحويل جديدة.',
        ]);
    }

    public function walletReceipt(PaymentAttempt $attempt)
    {
        abort_unless(
            in_array($attempt->method, ['vodafone', 'orange', 'etisalat'], true) &&
            is_string($attempt->receipt_path) &&
            Storage::disk('local')->exists($attempt->receipt_path),
            404
        );

        return Storage::disk('local')->download($attempt->receipt_path);
    }

    public function markCodCollected(Request $request, Order $order)
    {
        $data = $request->validate([
            'collected' => 'required|accepted',
        ]);

        $order = DB::transaction(function () use ($request, $order) {
            $order = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            abort_if(
                $order->payment_method !== 'cod' ||
                $order->status !== 'delivered' ||
                $order->payment_status === 'paid' ||
                $order->status === 'cancelled',
                409,
                'COD can only be marked collected for a delivered, unpaid order.'
            );

            $order->update([
                'payment_status' => 'paid',
                'paid_at' => now(),
                'payment_verified_by' => $request->user()->id,
            ]);

            return $order;
        }, 3);

        return response()->json([
            'order' => $order,
            'message' => 'تم تسجيل تحصيل قيمة الطلب نقدًا.',
        ]);
    }

    public function webhook(Request $request, PaymobService $paymob)
    {
        $data = $request->input('obj');
        if (! is_array($data)) {
            return response()->json(['message' => 'Invalid webhook payload'], 400);
        }

        // 1) Make sure the request really comes from Paymob
        if (! $paymob->validHmac($data, (string) $request->query('hmac'))) {
            return response()->json(['message' => 'Invalid HMAC'], 403);
        }
        // The provider HMAC does not cover merchant_order_id, so verify our own
        // signature before using it to select a local order.
        $reference = (string) data_get($data, 'order.merchant_order_id');
        $orderId = $paymob->orderIdFromMerchantReference($reference);
        $attempt = PaymentAttempt::where('merchant_reference', $reference)->first();
        if (! $orderId || ! $attempt || $attempt->order_id !== $orderId) {
            Log::warning('Paymob webhook: invalid merchant reference');

            return response()->json(['message' => 'Invalid merchant reference'], 403);
        }

        $order = Order::find($orderId);
        if (! $order) {
            Log::warning('Paymob webhook: order not found', ['reference' => $reference]);

            return response()->json(['message' => 'Order not found'], 404);
        }
        if (data_get($data, 'currency') !== 'EGP') {
            Log::warning('Paymob webhook: currency mismatch', ['order' => $order->id]);

            return response()->json(['message' => 'Invalid payment currency'], 403);
        }

        $paymentMethod = $paymob->paymentMethodForIntegrationId(
            (int) data_get($data, 'integration_id')
        );
        if (
            $paymentMethod !== 'card' ||
            $attempt->method !== 'card' ||
            $order->payment_method !== 'card'
        ) {
            Log::warning('Paymob webhook: integration mismatch', ['order' => $order->id]);

            return response()->json(['message' => 'Invalid payment integration'], 403);
        }
        $paid = filter_var(data_get($data, 'success'), FILTER_VALIDATE_BOOLEAN)
            && ! filter_var(data_get($data, 'pending'), FILTER_VALIDATE_BOOLEAN)
            && ! filter_var(data_get($data, 'error_occured'), FILTER_VALIDATE_BOOLEAN)
            && ! filter_var(data_get($data, 'is_refunded'), FILTER_VALIDATE_BOOLEAN)
            && ! filter_var(data_get($data, 'is_voided'), FILTER_VALIDATE_BOOLEAN);
        if ((int) data_get($data, 'amount_cents') !== (int) round($order->total * 100)) {
            Log::warning('Paymob webhook: amount mismatch', ['order' => $order->id]);

            return response()->json(['message' => 'Invalid payment amount'], 403);
        }
        $transactionId = data_get($data, 'id');
        if (! is_numeric($transactionId) || (int) $transactionId < 1) {
            return response()->json(['message' => 'Invalid transaction identifier'], 403);
        }

        try {
            $result = DB::transaction(function () use ($order, $attempt, $paid, $transactionId, $data) {
                $lockedOrder = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
                $lockedAttempt = PaymentAttempt::whereKey($attempt->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (
                    $lockedOrder->payment_status === 'paid' ||
                    $lockedOrder->status === 'cancelled' ||
                    $lockedAttempt->status === 'paid'
                ) {
                    return 'duplicate';
                }

                $usedTransaction = PaymentAttempt::where('provider_transaction_id', (string) $transactionId)
                    ->where('id', '!=', $lockedAttempt->id)
                    ->exists();
                if ($usedTransaction) {
                    return 'transaction_conflict';
                }

                if (! $paid) {
                    if (! filter_var(data_get($data, 'pending'), FILTER_VALIDATE_BOOLEAN)) {
                        $lockedAttempt->update([
                            'status' => 'failed',
                            'provider_transaction_id' => (string) $transactionId,
                        ]);
                        $lockedOrder->update(['payment_status' => 'failed']);
                    }

                    return 'updated';
                }

                $lockedAttempt->update([
                    'status' => 'paid',
                    'provider_transaction_id' => (string) $transactionId,
                ]);
                $lockedOrder->update([
                    'payment_status' => 'paid',
                    'paymob_transaction_id' => (string) $transactionId,
                    'paid_at' => now(),
                    'status' => $lockedOrder->status === 'pending'
                        ? 'processing'
                        : $lockedOrder->status,
                ]);

                return 'updated';
            }, 3);
        } catch (QueryException $exception) {
            Log::warning('Paymob webhook: transaction could not be recorded', [
                'order_id' => $order->id,
                'exception' => $exception::class,
            ]);

            return response()->json(['message' => 'Payment transaction conflict'], 409);
        }

        if ($result === 'transaction_conflict') {
            return response()->json(['message' => 'Payment transaction conflict'], 409);
        }

        return response()->json([
            'ok' => true,
            'payment_status' => Order::findOrFail($order->id)->payment_status,
        ]);
    }
}
