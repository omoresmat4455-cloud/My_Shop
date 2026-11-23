<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    // ---------- Public ----------
    public function index(Request $request)
    {
        $filters = $request->validate([
            'search' => 'nullable|string|max:255',
            'category' => 'nullable|string|max:255',
            'min_price' => 'nullable|numeric|min:0',
            'max_price' => 'nullable|numeric|min:0|gte:min_price',
            'sort' => ['nullable', Rule::in(['price_asc', 'price_desc'])],
            'page' => 'nullable|integer|min:1',
        ]);
        $query = Product::with('category')->where('is_active', true);
        if ($search = $filters['search'] ?? null) {
            $query->where(function ($products) use ($search) {
                $products->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }
        if ($category = $filters['category'] ?? null) {
            $query->whereHas('category', fn ($q) => $q->where('slug', $category));
        }
        if (isset($filters['min_price'])) {
            $query->where('price', '>=', $filters['min_price']);
        }
        if (isset($filters['max_price'])) {
            $query->where('price', '<=', $filters['max_price']);
        }
        match ($filters['sort'] ?? null) {
            'price_asc' => $query->orderBy('price'),
            'price_desc' => $query->orderByDesc('price'),
            default => $query->latest(),
        };

        return $query->paginate(12)->withQueryString();
    }

    public function show(Product $product)
    {
        abort_if(! $product->is_active, 404);

        return $product->load('category');
    }

    // ---------- Admin ----------
    public function adminIndex()
    {
        // For very large catalogs switch this to paginate()
        return Product::with('category')->latest()->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        unset($data['image']); // the UploadedFile object, replaced by the stored path below
        $data['slug'] = Str::slug($data['name']).'-'.Str::lower(Str::random(5));
        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store('products', 'public');
        }
        $product = Product::create($data);

        return response()->json($product->load('category'), 201);
    }

    public function update(Request $request, Product $product)
    {
        $data = $this->validated($request);
        unset($data['image']);
        if ($request->hasFile('image')) {
            if ($product->image) {
                Storage::disk('public')->delete($product->image);
            }
            $data['image'] = $request->file('image')->store('products', 'public');
        }
        $product->update($data);

        return $product->load('category');
    }

    public function destroy(Product $product)
    {
        // Products that were ordered must stay for order history
        if ($product->orderItems()->exists()) {
            $product->update(['is_active' => false]);

            return response()->json(['message' => 'Product has orders, so it was deactivated instead of
 deleted']);
        }
        if ($product->image) {
            Storage::disk('public')->delete($product->image);
        }
        $product->delete();

        return response()->json(['message' => 'Deleted']);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'category_id' => 'required|exists:categories,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'stock' => 'required|integer|min:0',
            'is_active' => 'boolean',
            'image' => 'nullable|image|max:2048',
        ]);
    }
}
