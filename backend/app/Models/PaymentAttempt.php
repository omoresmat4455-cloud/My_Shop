<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentAttempt extends Model
{
    protected $fillable = [
        'order_id',
        'method',
        'status',
        'merchant_reference',
        'provider_transaction_id',
        'transaction_reference',
        'wallet_sender_phone',
        'receipt_path',
        'submitted_at',
        'reviewed_by',
        'reviewed_at',
        'review_reason',
    ];

    protected $hidden = ['receipt_path'];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
