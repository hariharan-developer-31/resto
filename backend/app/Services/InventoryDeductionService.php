<?php

namespace App\Services;

use App\Models\InventoryItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\RecipeIngredient;

class InventoryDeductionService
{
    /**
     * Automatically deduct raw material inventory based on each ordered dish's Recipe BOM.
     *
     * @param  Order  $order
     * @param  OrderItem[]  $orderItems
     * @param  int|null  $userId
     */
    public static function deductForOrderItems(Order $order, array $orderItems, ?int $userId = null): void
    {
        foreach ($orderItems as $orderItem) {
            if ($orderItem->status === 'cancelled') {
                continue;
            }

            // Prefer variant-specific recipe; fall back to base dish recipe (menu_variant_id = null)
            $ingredients = collect();
            if ($orderItem->menu_variant_id) {
                $ingredients = RecipeIngredient::with('inventoryItem')
                    ->where('menu_item_id', $orderItem->menu_item_id)
                    ->where('menu_variant_id', $orderItem->menu_variant_id)
                    ->get();
            }

            if ($ingredients->isEmpty()) {
                $ingredients = RecipeIngredient::with('inventoryItem')
                    ->where('menu_item_id', $orderItem->menu_item_id)
                    ->whereNull('menu_variant_id')
                    ->get();
            }

            foreach ($ingredients as $ingredient) {
                $sourceItem = $ingredient->inventoryItem;
                if (!$sourceItem) {
                    continue;
                }

                // Resolve branch-local inventory item for multi-branch restaurants
                $targetItem = (int) $sourceItem->branch_id === (int) $order->branch_id
                    ? $sourceItem
                    : InventoryItem::where('restaurant_id', $order->restaurant_id)
                        ->where('branch_id', $order->branch_id)
                        ->where(function ($q) use ($sourceItem) {
                            if ($sourceItem->sku) {
                                $q->where('sku', $sourceItem->sku)->orWhere('name', $sourceItem->name);
                            } else {
                                $q->where('name', $sourceItem->name);
                            }
                        })
                        ->first();

                if (!$targetItem) {
                    continue;
                }

                $rawQty = (float) $ingredient->quantity_required * (int) $orderItem->quantity;
                $convertedQty = self::convertUnit($rawQty, (string) $ingredient->unit, (string) $targetItem->unit);

                if ($convertedQty <= 0) {
                    continue;
                }

                $targetItem->adjustStock(
                    -$convertedQty,
                    'order_deduction',
                    $userId,
                    "Auto BOM deduction for {$order->order_number} ({$orderItem->item_name} x{$orderItem->quantity})",
                    'order',
                    $order->id
                );
            }
        }
    }

    /**
     * Convert common culinary units to the inventory item's storage unit.
     */
    private static function convertUnit(float $qty, string $fromUnit, string $toUnit): float
    {
        $from = strtolower(trim($fromUnit));
        $to = strtolower(trim($toUnit));

        if ($from === $to) {
            return round($qty, 3);
        }

        // Weight conversions
        if ($from === 'g' && $to === 'kg') {
            return round($qty / 1000, 3);
        }
        if ($from === 'kg' && $to === 'g') {
            return round($qty * 1000, 3);
        }

        // Volume conversions
        if ($from === 'ml' && ($to === 'l' || $to === 'ltr')) {
            return round($qty / 1000, 3);
        }
        if (($from === 'l' || $from === 'ltr') && $to === 'ml') {
            return round($qty * 1000, 3);
        }

        return round($qty, 3);
    }
}
