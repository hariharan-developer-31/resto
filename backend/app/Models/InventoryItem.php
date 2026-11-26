<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class InventoryItem extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'restaurant_id',
        'branch_id',
        'supplier_id',
        'name',
        'sku',
        'category',
        'unit',
        'current_stock',
        'minimum_stock',
        'unit_cost',
        'storage_location',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'current_stock' => 'decimal:3',
            'minimum_stock' => 'decimal:3',
            'unit_cost' => 'decimal:2',
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

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function recipeIngredients(): HasMany
    {
        return $this->hasMany(RecipeIngredient::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    /**
     * Update stock level and automatically record audited StockMovement
     */
    public function adjustStock(
        float $delta,
        string $movementType,
        ?int $userId = null,
        ?string $reason = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?string $notes = null
    ): StockMovement {
        return DB::transaction(function () use ($delta, $movementType, $userId, $reason, $referenceType, $referenceId, $notes) {
            $lockedItem = self::where('id', $this->id)->lockForUpdate()->firstOrFail();

            $oldStock = (float) $lockedItem->current_stock;
            $newStock = max(0.000, round($oldStock + $delta, 3));
            $actualDelta = round($newStock - $oldStock, 3);

            // Determine stock status
            $status = 'in_stock';
            if ($newStock <= 0.0001) {
                $status = 'out_of_stock';
            } elseif ($newStock <= (float) $lockedItem->minimum_stock) {
                $status = 'low_stock';
            }

            $lockedItem->update([
                'current_stock' => $newStock,
                'status' => $status,
            ]);

            $this->current_stock = $newStock;
            $this->status = $status;

            $unitCost = (float) $lockedItem->unit_cost;
            $totalCost = round(abs($actualDelta) * $unitCost, 2);

            return StockMovement::create([
                'restaurant_id' => $lockedItem->restaurant_id,
                'branch_id' => $lockedItem->branch_id,
                'inventory_item_id' => $lockedItem->id,
                'user_id' => $userId,
                'movement_type' => $movementType,
                'quantity' => $actualDelta,
                'balance_after' => $newStock,
                'unit_cost' => $unitCost,
                'total_cost' => $totalCost,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'reason' => $reason,
                'notes' => $notes,
            ]);
        });
    }
}
