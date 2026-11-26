<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Order extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'restaurant_id',
        'branch_id',
        'table_id',
        'waiter_id',
        'customer_name',
        'customer_phone',
        'guest_count',
        'order_number',
        'order_type',
        'order_status',
        'payment_status',
        'subtotal',
        'tax_amount',
        'discount_amount',
        'service_charge',
        'packaging_charge',
        'total_amount',
        'round_count',
        'paid_amount',
        'change_amount',
        'invoice_number',
        'settled_at',
        'special_instructions',
        'cancellation_reason',
        'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'service_charge' => 'decimal:2',
            'packaging_charge' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'change_amount' => 'decimal:2',
            'round_count' => 'integer',
            'guest_count' => 'integer',
            'settled_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function table(): BelongsTo
    {
        return $this->belongsTo(DiningTable::class, 'table_id');
    }

    public function waiter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'waiter_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Generate unique branch-prefixed sequential order number (safe across branches & concurrency).
     */
    public static function generateOrderNumber(int $branchId): string
    {
        $today = date('Ymd');
        $seq = static::withTrashed()
            ->where('branch_id', $branchId)
            ->whereDate('created_at', today())
            ->lockForUpdate()
            ->count() + 1;

        do {
            $candidate = sprintf('ORD-B%d-%s-%04d', $branchId, $today, $seq);
            $seq++;
        } while (static::withTrashed()->where('order_number', $candidate)->exists());

        return $candidate;
    }

    /**
     * Generate unique branch-prefixed sequential KOT ticket number.
     */
    public static function generateKotNumber(int $branchId): string
    {
        $today = date('Ymd');
        $seq = OrderItem::withTrashed()
            ->whereHas('order', function ($q) use ($branchId) {
                $q->withTrashed()->where('branch_id', $branchId);
            })
            ->whereDate('created_at', today())
            ->distinct('kot_number')
            ->count('kot_number') + 1;

        do {
            $candidate = sprintf('KOT-B%d-%s-%03d', $branchId, $today, $seq);
            $seq++;
        } while (OrderItem::withTrashed()->where('kot_number', $candidate)->exists());

        return $candidate;
    }

    /**
     * Generate unique branch-prefixed tax invoice number upon settlement.
     */
    public static function generateInvoiceNumber(int $branchId): string
    {
        $today = date('Ymd');
        $seq = static::withTrashed()
            ->where('branch_id', $branchId)
            ->whereNotNull('invoice_number')
            ->where(function ($q) {
                $q->whereDate('settled_at', today())
                  ->orWhere(function ($q2) {
                      $q2->whereNull('settled_at')->whereDate('updated_at', today());
                  });
            })
            ->lockForUpdate()
            ->count() + 1;

        do {
            $candidate = sprintf('INV-B%d-%s-%04d', $branchId, $today, $seq);
            $seq++;
        } while (static::withTrashed()->where('invoice_number', $candidate)->exists());

        return $candidate;
    }

    /**
     * Recalculate order pre-tax subtotal, tax, and grand total (no double-taxation).
     */
    public function recalculateTotals(?float $discount = 0.00, ?float $serviceCharge = 0.00, ?float $packagingCharge = 0.00): void
    {
        $discount = (float) ($discount ?? 0.00);
        $serviceCharge = (float) ($serviceCharge ?? 0.00);
        $packagingCharge = (float) ($packagingCharge ?? 0.00);

        $activeItems = $this->items()->where('status', '!=', 'cancelled');
        $subtotal = round((float) (clone $activeItems)->sum('subtotal'), 2);
        $taxAmount = round((float) (clone $activeItems)->sum('tax_amount'), 2);

        $total = max(0.00, round($subtotal + $taxAmount + $serviceCharge + $packagingCharge - $discount, 2));

        $this->update([
            'subtotal' => $subtotal,
            'tax_amount' => $taxAmount,
            'discount_amount' => $discount,
            'service_charge' => $serviceCharge,
            'packaging_charge' => $packagingCharge,
            'total_amount' => $total,
        ]);
    }
}
