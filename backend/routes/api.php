<?php

use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ProductController;
use Illuminate\Support\Facades\Route;

// ---------- Public ----------
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{product}', [ProductController::class, 'show']);
Route::get('/payment-methods', [PaymentController::class, 'availableMethods']);
// Called by Paymob servers, no auth
Route::post('/paymob/webhook', [PaymentController::class, 'webhook']);
// ---------- Logged in users ----------
Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/cart', [CartController::class, 'index']);
    Route::post('/cart', [CartController::class, 'store']);
    Route::delete('/cart', [CartController::class, 'clear']);
    Route::put('/cart/{cartItem}', [CartController::class, 'update']);
    Route::delete('/cart/{cartItem}', [CartController::class, 'destroy']);
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);
    Route::post('/orders/{order}/pay', [OrderController::class, 'pay']);
    Route::post('/orders/{order}/wallet-transfer', [PaymentController::class, 'submitWalletTransfer'])
        ->middleware('throttle:10,1');
    // ---------- Admin only ----------
    Route::prefix('admin')->middleware('admin')->group(function () {
        Route::get('/wallet-transfers', [PaymentController::class, 'pendingWalletTransfers']);
        Route::post('/wallet-transfers/{attempt}/review', [PaymentController::class, 'reviewWalletTransfer']);
        Route::get('/wallet-transfers/{attempt}/receipt', [PaymentController::class, 'walletReceipt']);
        Route::patch('/orders/{order}/cod-payment', [PaymentController::class, 'markCodCollected']);
        Route::get('/stats', [AdminOrderController::class, 'stats']);
        Route::get('/revenue-chart', [
            AdminOrderController::class,
            'revenueChart',
        ]);

        Route::get('/top-products', [
            AdminOrderController::class,
            'topProducts',
        ]);
        Route::get('/products', [ProductController::class, 'adminIndex']);
        Route::post('/products', [ProductController::class, 'store']);
        Route::put('/products/{product}', [ProductController::class, 'update']);
        Route::delete('/products/{product}', [ProductController::class, 'destroy']);
        Route::get('/categories', [CategoryController::class, 'adminIndex']);
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::put('/categories/{category}', [CategoryController::class, 'update']);
        Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);
        Route::get('/users', [AdminUserController::class, 'index']);
        Route::patch('/users/{user}/role', [AdminUserController::class, 'updateRole']);
        Route::patch('/users/{user}/status', [AdminUserController::class, 'updateStatus']);
        Route::get('/orders', [AdminOrderController::class, 'index']);
        Route::patch('/orders/{order}/status', [AdminOrderController::class, 'updateStatus']);
    });
});
