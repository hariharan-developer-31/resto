<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Reservation extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'restaurant_id',
        'branch_id',
        'table_id',
        'customer_name',
        'customer_phone',
        'customer_email',
        'guest_count',
        'reservation_date',
        'reservation_time',
        'checked_in_at',
        'seated_at',
        'status', // pending, confirmed, checked_in, seated, completed, cancelled, no_show
        'special_requests',
        'cancellation_reason',
    ];

    protected function casts(): array
    {
        return [
            'guest_count' => 'integer',
            'reservation_date' => 'date',
            'checked_in_at' => 'datetime',
            'seated_at' => 'datetime',
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

    /**
     * Check if a dining table has a conflicting active reservation at the requested time slot (+/- 90 mins).
     * Midnight-safe using Carbon minute difference instead of string BETWEEN.
     */
    public static function hasTableConflict(
        int $tableId,
        string $date,
        string $time,
        ?int $ignoreReservationId = null,
        int $bufferMinutes = 90
    ): bool {
        $requestedDateTime = Carbon::parse("{$date} {$time}");

        $query = static::where('table_id', $tableId)
            ->whereDate('reservation_date', $date)
            ->whereIn('status', ['pending', 'confirmed', 'checked_in', 'seated']);

        if ($ignoreReservationId) {
            $query->where('id', '!=', $ignoreReservationId);
        }

        $existingReservations = $query->get(['id', 'reservation_date', 'reservation_time']);

        foreach ($existingReservations as $existing) {
            $existingDate = $existing->reservation_date instanceof \DateTimeInterface
                ? $existing->reservation_date->format('Y-m-d')
                : (string) $existing->reservation_date;
            try {
                $existingDateTime = Carbon::parse("{$existingDate} {$existing->reservation_time}");
                if (abs($requestedDateTime->diffInMinutes($existingDateTime)) < $bufferMinutes) {
                    return true;
                }
            } catch (\Throwable) {
                continue;
            }
        }

        return false;
    }

    /**
     * Seat the guest at an assigned table
     */
    public function seatGuest(?int $tableId = null): void
    {
        $targetTableId = $tableId ?? $this->table_id;

        if ($targetTableId) {
            $this->table_id = $targetTableId;
            $table = DiningTable::find($targetTableId);
            if ($table) {
                $table->update(['status' => 'occupied']);
            }
        }

        $this->update([
            'status' => 'seated',
            'seated_at' => now(),
            'checked_in_at' => $this->checked_in_at ?? now(),
        ]);
    }

    /**
     * Mark reservation as checked in
     */
    public function checkInGuest(): void
    {
        $this->update([
            'status' => 'checked_in',
            'checked_in_at' => now(),
        ]);
    }

    /**
     * Mark reservation completed and free table if assigned and has no active unpaid order
     */
    public function completeReservation(): void
    {
        $this->update(['status' => 'completed']);

        if ($this->table_id) {
            $table = DiningTable::find($this->table_id);
            if ($table && in_array($table->status, ['occupied', 'reserved'], true)) {
                $hasActiveOrder = Order::where('table_id', $table->id)
                    ->whereIn('order_status', ['pending', 'preparing', 'ready'])
                    ->where('payment_status', '!=', 'paid')
                    ->exists();
                if (!$hasActiveOrder) {
                    $table->update(['status' => 'available']);
                }
            }
        }
    }

    /**
     * Cancel reservation with reason
     */
    public function cancelReservation(string $reason): void
    {
        $this->update([
            'status' => 'cancelled',
            'cancellation_reason' => $reason,
        ]);
    }
}
