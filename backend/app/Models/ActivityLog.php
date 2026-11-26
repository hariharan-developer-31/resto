<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'restaurant_id',
        'branch_id',
        'user_id',
        'description',
        'properties',
    ];

    protected function casts(): array
    {
        return [
            'properties' => 'array',
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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function log(
        string $description,
        ?array $properties = null,
        ?int $restaurantId = null,
        ?int $branchId = null,
        ?int $userId = null
    ): self {
        return self::create([
            'restaurant_id' => $restaurantId ?? auth()->user()?->restaurants()->first()?->id,
            'branch_id' => $branchId ?? auth()->user()?->branches()->first()?->id,
            'user_id' => $userId ?? auth()->id(),
            'description' => $description,
            'properties' => $properties,
        ]);
    }
}
