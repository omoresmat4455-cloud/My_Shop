<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    /**
     * Get all orders with pagination.
     */
    public function index(Request $request)
    {
        $limit = $request->integer('limit', 20);

        $limit = max(1, min($limit, 100));

        return Order::with('user', 'items.product')
            ->latest()
            ->paginate($limit);
    }

    /**
     * Update order status.
     */
    public function updateStatus(Request $request, Order $order)
    {
        $data = $request->validate([
            'status' => 'required|in:pending,processing,shipped,delivered,cancelled',
        ]);

        $order = DB::transaction(function () use ($order, $data) {
            $order = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            abort_if(
                $order->status === 'cancelled',
                422,
                'Cancelled orders cannot be changed'
            );
            abort_if(
                $data['status'] === 'cancelled' &&
                $order->payment_status === 'paid',
                422,
                'Paid orders require a refund before they can be cancelled.'
            );
            abort_if(
                $order->payment_method !== 'cod' &&
                $order->payment_status !== 'paid' &&
                in_array($data['status'], ['processing', 'shipped', 'delivered'], true),
                422,
                'Online orders must be paid before fulfillment.'
            );

            if ($data['status'] === 'cancelled') {
                foreach ($order->items as $item) {
                    Product::where('id', $item->product_id)
                        ->increment('stock', $item->quantity);
                }
            }

            $order->update(['status' => $data['status']]);

            return $order->load('user', 'items.product');
        }, 3);

        return $order;
    }

    /**
     * Get dashboard statistics.
     */
    public function stats()
    {
        $orders = Order::query()
            ->selectRaw('COUNT(*) AS total_orders')
            ->selectRaw(
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS pending_orders',
                ['pending']
            )
            ->selectRaw(
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS processing_orders',
                ['processing']
            )
            ->selectRaw(
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS shipped_orders',
                ['shipped']
            )
            ->selectRaw(
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS delivered_orders',
                ['delivered']
            )
            ->selectRaw(
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS cancelled_orders',
                ['cancelled']
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN payment_status = ? THEN total ELSE 0 END), 0) AS revenue',
                ['paid']
            )
            ->first();

        return [
            'orders' => (int) $orders->total_orders,
            'pending_orders' => (int) $orders->pending_orders,
            'processing_orders' => (int) $orders->processing_orders,
            'shipped_orders' => (int) $orders->shipped_orders,
            'delivered_orders' => (int) $orders->delivered_orders,
            'cancelled_orders' => (int) $orders->cancelled_orders,
            'revenue' => (float) $orders->revenue,

            'products' => Product::count(),

            'customers' => User::where(
                'role',
                'customer'
            )->count(),
        ];
    }

    /**
     * Get revenue for the last 7 days.
     */
    public function revenueChart()
    {
        $startDate = now()->subDays(6)->startOfDay();
        $endDate = now()->endOfDay();

        $revenueByDate = DB::table('orders')
            ->selectRaw('DATE(created_at) as date')
            ->selectRaw('SUM(total) as revenue')
            ->where('payment_status', 'paid')
            ->where('created_at', '>=', $startDate)
            ->where('created_at', '<=', $endDate)
            ->groupByRaw('DATE(created_at)')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        return collect(range(0, 6))
            ->map(function ($day) use ($startDate, $revenueByDate) {
                $date = $startDate->copy()->addDays($day)->toDateString();

                return [
                    'date' => $date,
                    'revenue' => (float) ($revenueByDate->get($date)->revenue ?? 0),
                ];
            });
    }

    /**
     * Get the top 5 best-selling products.
     */
    public function topProducts()
    {
        return DB::table('order_items')
            ->join(
                'products',
                'order_items.product_id',
                '=',
                'products.id'
            )
            ->join(
                'orders',
                'order_items.order_id',
                '=',
                'orders.id'
            )
            ->where('orders.status', '!=', 'cancelled')
            ->select('products.id', 'products.name')
            ->selectRaw('SUM(order_items.quantity) as sold')
            ->groupBy('products.id', 'products.name')
            ->orderByDesc('sold')
            ->limit(5)
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'sold' => (int) $item->sold,
                ];
            });
    }
}
