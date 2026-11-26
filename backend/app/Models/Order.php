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
     * Generate unique sequential order number for branch
     */
    public static function generateOrderNumber(int $branchId): string
    {
        $today = date('Ymd');
        $count = static::where('branch_id', $branchId)
            ->whereDate('created_at', today())
            ->count() + 1;

        return sprintf('ORD-%s-%04d', $today, $count);
    }

    /**
     * Generate unique sequential KOT ticket number
     */
    public static function generateKotNumber(int $branchId): string
    {
        $today = date('Ymd');
        $count = OrderItem::whereHas('order', function ($q) use ($branchId) {
            $q->where('branch_id', $branchId);
        })->whereDate('created_at', today())
            ->distinct('kot_number')
            ->count('kot_number') + 1;

        return sprintf('KOT-%s-%03d', $today, $count);
    }

    /**
     * Generate unique tax invoice number upon settlement
     */
    public static function generateInvoiceNumber(int $branchId): string
    {
        $today = date('Ymd');
        $count = static::where('branch_id', $branchId)
            ->whereNotNull('invoice_number')
            ->whereDate('created_at', today())
            ->count() + 1;

        return sprintf('INV-%s-%04d', $today, $count);
    }

    /**
     * Recalculate order subtotal, tax and grand total
     */
    public function recalculateTotals(float $discount = 0.00, float $serviceCharge = 0.00, float $packagingCharge = 0.00): void
    {
        $subtotal = $this->items()->where('status', '!=', 'cancelled')->sum('total_price');
        $taxAmount = $this->items()->where('status', '!=', 'cancelled')->sum('tax_amount');
        
        $total = max(0.00, $subtotal + $taxAmount + $serviceCharge + $packagingCharge - $discount);

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
