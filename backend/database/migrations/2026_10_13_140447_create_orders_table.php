<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->decimal('total', 10, 2)->default(0);
            // pending | processing | shipped | delivered | cancelled
            $table->string('status')->default('pending');
            $table->string('payment_method')->default('cod'); // cod | card
            $table->string('payment_status')->default('unpaid'); // unpaid | paid | failed
            $table->string('paymob_transaction_id')->nullable();
            $table->string('address');
            $table->string('city');
            $table->string('phone');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
