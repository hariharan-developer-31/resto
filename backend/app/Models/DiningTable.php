<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class DiningTable extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'restaurant_id',
        'branch_id',
        'waiter_id',
        'table_number',
        'seating_capacity',
        'location',
        'status',
        'qr_token',
        'qr_generated_at',
    ];

    protected function casts(): array
    {
        return [
            'seating_capacity' => 'integer',
            'qr_generated_at' => 'datetime',
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

    public function waiter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'waiter_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'table_id');
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class, 'table_id');
    }

    /**
     * Regenerate an unpredictable, secure random QR token.
     */
    public function generateQrToken(): string
    {
        $token = 'tbl_' . Str::random(32);
        $this->update([
            'qr_token' => $token,
            'qr_generated_at' => now(),
        ]);

        return $token;
    }
}
