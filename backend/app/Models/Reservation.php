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
     * Check if a dining table has a conflicting active reservation at the requested time slot (+/- 90 mins)
     */
    public static function hasTableConflict(
        int $tableId,
        string $date,
        string $time,
        ?int $ignoreReservationId = null,
        int $bufferMinutes = 90
    ): bool {
        $requestedTime = Carbon::parse($time);
        $windowStart = $requestedTime->copy()->subMinutes($bufferMinutes)->format('H:i');
        $windowEnd = $requestedTime->copy()->addMinutes($bufferMinutes)->format('H:i');

        $query = static::where('table_id', $tableId)
            ->whereDate('reservation_date', $date)
            ->whereIn('status', ['confirmed', 'checked_in', 'seated'])
            ->whereBetween('reservation_time', [$windowStart, $windowEnd]);

        if ($ignoreReservationId) {
            $query->where('id', '!=', $ignoreReservationId);
        }

        return $query->exists();
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
     * Mark reservation completed and free table if assigned
     */
    public function completeReservation(): void
    {
        $this->update(['status' => 'completed']);
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
