<?php

namespace App\Http\Controllers;

use App\Models\CartItem;
use App\Models\Product;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function index(Request $request)
    {
        return $this->cart($request);
    }
    public function store(Request $request)
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|integer|min:1|max:100',
        ]);

        $product = Product::where('is_active', true)->findOrFail($data['product_id']);

        abort_if($product->stock < 1, 422, 'This product is out of stock');

        $existingQuantity = CartItem::where('user_id', $request->user()->id)
            ->where('product_id', $product->id)
            ->value('quantity') ?? 0;

        $requestedTotal = $existingQuantity + $data['quantity'];

        abort_if(
            $requestedTotal > $product->stock,
            422,
            'Requested quantity exceeds available stock. Available stock: ' . $product->stock
        );

        $item = CartItem::firstOrNew([
            'user_id' => $request->user()->id,
            'product_id' => $product->id,
        ]);

        $item->quantity = $requestedTotal;
        $item->save();

        return $this->cart($request);
    }
    public function update(Request $request, CartItem $cartItem)
    {
        abort_if($cartItem->user_id !== $request->user()->id, 403);

        $data = $request->validate(['quantity' => 'required|integer|min:1|max:100']);

        abort_if(
            $data['quantity'] > $cartItem->product->stock,
            422,
            'Requested quantity exceeds available stock. Available stock: ' . $cartItem->product->stock
        );

        $cartItem->update([
            'quantity' => $data['quantity'],
        ]);

        return $this->cart($request);
    }
    public function destroy(Request $request, CartItem $cartItem)
    {
        abort_if($cartItem->user_id !== $request->user()->id, 403);
        $cartItem->delete();
        return $this->cart($request);
    }
    public function clear(Request $request)
    {
        CartItem::where('user_id', $request->user()->id)->delete();
        return $this->cart($request);
    }
    private function cart(Request $request)
    {
        $items = CartItem::with('product')
            ->where('user_id', $request->user()->id)
            ->get();
        $total = $items->sum(fn($item) => $item->product->price * $item->quantity);
        return response()->json([
            'items' => $items,
            'total' => round($total, 2),
        ]);
    }
}
