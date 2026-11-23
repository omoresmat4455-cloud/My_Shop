<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('idempotency_key', 128)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('payment_verified_by')->nullable()
                ->constrained('users')->nullOnDelete();
            $table->unique(['user_id', 'idempotency_key'], 'orders_user_idempotency_unique');
        });

        Schema::create('payment_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('method');
            $table->string('status');
            $table->string('merchant_reference')->nullable()->unique();
            $table->string('provider_transaction_id')->nullable()->unique();
            $table->string('transaction_reference')->nullable()->unique();
            $table->string('receipt_path')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()
                ->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_reason')->nullable();
            $table->timestamps();
            $table->index(['method', 'status', 'created_at'], 'payment_attempts_review_queue_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_attempts');

        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique('orders_user_idempotency_unique');
            $table->dropConstrainedForeignId('payment_verified_by');
            $table->dropColumn(['idempotency_key', 'paid_at']);
        });
    }
};
