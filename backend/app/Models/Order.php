<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $fillable = [
        'user_id',
        'total',
        'status',
        'payment_method',
        'payment_status',
        'paymob_transaction_id',
        'idempotency_key',
        'paid_at',
        'payment_verified_by',
        'address',
        'city',
        'phone',
    ];

    protected $casts = ['total' => 'decimal:2'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function paymentAttempts()
    {
        return $this->hasMany(PaymentAttempt::class);
    }

    public function paymentVerifier()
    {
        return $this->belongsTo(User::class, 'payment_verified_by');
    }
}
