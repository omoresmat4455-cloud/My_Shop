<?php

namespace App\Http\Controllers;

use App\Models\CartItem;
use App\Models\Order;
use App\Models\Product;
use App\Services\PaymobService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

class OrderController extends Controller
{
    /**
     * Get all orders belonging to the authenticated user.
     */
    public function index(Request $request)
    {
        return Order::with('items.product')
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get()
            ->map(function (Order $order) {
                $order->setAttribute(
                    'latest_payment_attempt',
                    $order->paymentAttempts()
                        ->select([
                            'id',
                            'order_id',
                            'method',
                            'status',
                            'transaction_reference',
                            'wallet_sender_phone',
                            'submitted_at',
                            'review_reason',
                        ])
                        ->latest()
                        ->first()
                );

                return $order;
            });
    }

    /**
     * Get details of a specific order.
     */
    public function show(Request $request, Order $order)
    {
        abort_if(
            $order->user_id !== $request->user()->id,
            403,
            'You are not authorized to view this order.'
        );

        $order->load('items.product');
        $order->setAttribute(
            'latest_payment_attempt',
            $order->paymentAttempts()->latest()->first()
        );
        $order->setAttribute('payment_instructions', $this->walletInstructions($order));

        return $order;
    }

    /**
     * Create a new order from the user's cart.
     */
    public function store(Request $request, PaymobService $paymob)
    {
        $data = $request->validate([
            'address' => 'required|string|max:255',
            'city' => 'required|string|max:100',
            'phone' => ['required', 'regex:/^01[0-9]{9}$/'],
            'payment_method' => 'required|in:card,cod,vodafone,orange,etisalat',
        ]);
        abort_if(
            $data['payment_method'] === 'card' && ! $paymob->isCardCheckoutConfigured(),
            503,
            'Card payment is not configured yet. Please select another payment method.'
        );
        if (in_array($data['payment_method'], ['vodafone', 'orange', 'etisalat'], true)) {
            $recipientNumber = config('services.wallets.recipient_number');
            abort_unless(
                is_string($recipientNumber) && preg_match('/\A01[0-9]{9}\z/', $recipientNumber),
                503,
                'The mobile wallet recipient number is not configured correctly.'
            );
        }

        $user = $request->user();
        $idempotencyKey = $request->header('Idempotency-Key');
        Validator::make(
            ['idempotency_key' => $idempotencyKey],
            ['idempotency_key' => 'nullable|string|max:128']
        )->validate();

        if ($idempotencyKey !== null) {
            $existingOrder = Order::where('user_id', $user->id)
                ->where('idempotency_key', $idempotencyKey)
                ->first();
            if ($existingOrder) {
                return $this->orderCreatedResponse($existingOrder, 200);
            }
        }

        $order = DB::transaction(function () use ($data, $user, $idempotencyKey) {
            $user->newQuery()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            if ($idempotencyKey !== null) {
                $existingOrder = Order::where('user_id', $user->id)
                    ->where('idempotency_key', $idempotencyKey)
                    ->first();
                if ($existingOrder) {
                    return $existingOrder;
                }
            }

            $cartItems = CartItem::where('user_id', $user->id)
                ->orderBy('product_id')
                ->lockForUpdate()
                ->get();

            abort_if(
                $cartItems->isEmpty(),
                422,
                'Your cart is empty.'
            );

            $order = Order::create([
                'user_id' => $user->id,
                'total' => 0,
                'status' => 'pending',
                'payment_method' => $data['payment_method'],
                'payment_status' => in_array(
                    $data['payment_method'],
                    ['vodafone', 'orange', 'etisalat'],
                    true
                ) ? 'awaiting_payment_confirmation' : 'unpaid',
                'idempotency_key' => $idempotencyKey,
                'address' => $data['address'],
                'city' => $data['city'],
                'phone' => $data['phone'],
            ]);

            $totalCents = 0;

            foreach ($cartItems as $item) {
                // Lock the product row while checking and updating stock.
                $product = Product::whereKey($item->product_id)
                    ->lockForUpdate()
                    ->first();

                if (
                    ! $product ||
                    ! $product->is_active ||
                    $product->stock < $item->quantity
                ) {
                    abort(
                        422,
                        'Not enough stock for: '.
                        ($product->name ?? 'a product')
                    );
                }

                // Create the order item using the database price.
                $order->items()->create([
                    'product_id' => $product->id,
                    'quantity' => $item->quantity,
                    'price' => $product->price,
                ]);

                // Decrease available stock.
                $product->decrement('stock', $item->quantity);

                // Calculate the order total.
                $totalCents += (int) round((float) $product->price * 100) * $item->quantity;
            }

            // Save the final order total.
            $order->update([
                'total' => number_format($totalCents / 100, 2, '.', ''),
            ]);

            // Clear the user's cart after creating the order.
            CartItem::where('user_id', $user->id)->delete();

            return $order;
        });

        return $this->orderCreatedResponse(
            $order,
            $order->wasRecentlyCreated ? 201 : 200
        );
    }

    /**
     * Retry payment for an unpaid card order.
     */
    public function pay(
        Request $request,
        Order $order,
        PaymobService $paymob
    ) {
        abort_if(
            $order->user_id !== $request->user()->id,
            403,
            'You are not authorized to pay for this order.'
        );

        $data = $request->validate([
            'payment_method' => 'required|in:card',
        ]);

        abort_if(
            ! $paymob->isCardCheckoutConfigured(),
            503,
            'Card payment is not configured yet. Please try another payment method.'
        );

        abort_if(
            $order->payment_method !== 'card' ||
            $order->payment_status === 'paid' ||
            in_array($order->status, ['cancelled', 'delivered'], true),
            422,
            'This order cannot be paid online.'
        );

        abort_if(
            $order->paymentAttempts()
                ->whereIn('status', ['initiating', 'pending'])
                ->exists(),
            409,
            'A card payment is already being processed for this order.'
        );

        return $this->respondWithPayment($order, $paymob, $data['payment_method']);
    }

    /**
     * Return the order and payment URL when applicable.
     */
    private function respondWithPayment(
        Order $order,
        PaymobService $paymob,
        string $paymentMethod
    ) {
        $order->load('items.product', 'user');
        $attempt = null;

        try {
            $attempt = DB::transaction(function () use ($order, $paymentMethod, $paymob) {
                $lockedOrder = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
                abort_if(
                    $lockedOrder->payment_status === 'paid' ||
                    $lockedOrder->status === 'cancelled' ||
                    $lockedOrder->paymentAttempts()
                        ->whereIn('status', ['initiating', 'pending'])
                        ->exists(),
                    409,
                    'This order cannot start another card payment.'
                );

                $reference = $paymob->merchantOrderReference($lockedOrder);

                return $lockedOrder->paymentAttempts()->create([
                    'method' => $paymentMethod,
                    'status' => 'initiating',
                    'merchant_reference' => $reference,
                ]);
            }, 3);

            $url = $paymob->createPaymentUrl(
                $order,
                $paymentMethod,
                $attempt->merchant_reference
            );
            $attempt->update(['status' => 'pending']);
        } catch (ConnectionException|RequestException|RuntimeException $e) {
            $attempt?->update(['status' => 'failed']);
            Log::error('Paymob payment initialization failed.', [
                'order_id' => $order->id,
                'exception' => $e::class,
            ]);

            return response()->json([
                'order' => $order,
                'message' => 'Payment could not be started. Please try again later.',
            ], 502);
        }

        return response()->json([
            'order' => $order->fresh()->load('items.product'),
            'payment_url' => $url,
            'message' => 'سيتم تأكيد الدفع بعد التحقق من بوابة الدفع.',
        ]);
    }

    private function orderCreatedResponse(Order $order, int $status)
    {
        $order->load('items.product');
        $walletInstructions = $this->walletInstructions($order);
        $message = match ($order->payment_method) {
            'cod' => 'تم استلام طلبك. سيتم تحصيل قيمة الطلب عند التسليم.',
            'vodafone', 'orange', 'etisalat' => 'تم إنشاء الطلب. أكمل التحويل إلى المحفظة وأرسل بيانات التحويل للتحقق.',
            default => 'تم إنشاء الطلب. أكمل الدفع بالبطاقة من صفحة الطلب.',
        };

        return response()->json([
            'order' => $order,
            'message' => $message,
            'payment_instructions' => $walletInstructions,
        ], $status);
    }

    private function walletInstructions(Order $order): ?array
    {
        $labels = [
            'vodafone' => 'Vodafone Cash',
            'orange' => 'Orange Cash',
            'etisalat' => 'Etisalat Cash',
        ];
        if (! isset($labels[$order->payment_method])) {
            return null;
        }
        $recipientNumber = config('services.wallets.recipient_number');
        abort_unless(
            is_string($recipientNumber) && preg_match('/\A01[0-9]{9}\z/', $recipientNumber),
            503,
            'The mobile wallet recipient number is not configured correctly.'
        );

        return [
            'wallet' => $labels[$order->payment_method],
            'recipient_number' => $recipientNumber,
            'amount_egp' => $order->total,
            'order_reference' => (string) $order->id,
            'message' => 'أرسل المبلغ من تطبيق محفظتك، ثم أرسل رقم العملية للتحقق. لا تشارك الرقم السري أو رمز OTP.',
        ];
    }
}
