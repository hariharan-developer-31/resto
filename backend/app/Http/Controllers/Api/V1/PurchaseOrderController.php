<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\InventoryItem;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Restaurant;
use App\Models\Supplier;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PurchaseOrderController extends Controller
{
    use ApiResponse;

    /**
     * Display a listing of purchase orders.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $restaurantId = $request->header('X-Restaurant-ID')
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Restaurant::first()?->id;
        }

        if (!$restaurantId) {
            return $this->errorResponse('Please specify an active restaurant context.', 400);
        }

        $query = PurchaseOrder::where('restaurant_id', $restaurantId)
            ->with(['supplier:id,name,phone,email', 'branch:id,name', 'creator:id,name', 'items.inventoryItem:id,name,unit,sku']);

        // Filter by branch
        if ($branchId = $request->header('X-Branch-ID') ?? $request->input('branch_id')) {
            $query->where('branch_id', $branchId);
        }

        // Filter by supplier
        if ($supplierId = $request->input('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }

        // Filter by status
        if ($status = $request->input('status')) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        $orders = $query->latest('order_date')->paginate($request->input('per_page', 25));

        return $this->successResponse($orders, 'Purchase orders retrieved successfully.');
    }

    /**
     * Create a new purchase order with line items.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'restaurant_id' => 'nullable|exists:restaurants,id',
            'branch_id' => 'required|exists:branches,id',
            'supplier_id' => 'required|exists:suppliers,id',
            'order_date' => 'required|date',
            'expected_delivery_date' => 'nullable|date|after_or_equal:order_date',
            'notes' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.inventory_item_id' => 'required|exists:inventory_items,id',
            'items.*.quantity_ordered' => 'required|numeric|gt:0',
            'items.*.unit_cost' => 'required|numeric|min:0',
        ]);

        $branch = Branch::findOrFail($validated['branch_id']);
        $restaurantId = $validated['restaurant_id'] ?? $branch->restaurant_id;

        $supplier = Supplier::where('id', $validated['supplier_id'])
            ->where('restaurant_id', $restaurantId)
            ->first();
        if (!$supplier) {
            return $this->errorResponse('Selected supplier does not belong to this restaurant.', 422);
        }

        foreach ($validated['items'] as $item) {
            $invExists = InventoryItem::where('id', $item['inventory_item_id'])
                ->where('branch_id', $branch->id)
                ->exists();
            if (!$invExists) {
                return $this->errorResponse('One or more selected inventory items do not belong to the active branch.', 422);
            }
        }

        $po = DB::transaction(function () use ($validated, $restaurantId, $branch, $user) {
            $poNumber = PurchaseOrder::generatePoNumber();

            $purchaseOrder = PurchaseOrder::create([
                'restaurant_id' => $restaurantId,
                'branch_id' => $branch->id,
                'supplier_id' => $validated['supplier_id'],
                'po_number' => $poNumber,
                'order_date' => $validated['order_date'],
                'expected_delivery_date' => $validated['expected_delivery_date'] ?? null,
                'status' => 'ordered',
                'notes' => $validated['notes'] ?? null,
                'created_by' => $user->id,
            ]);

            $subtotal = 0.00;
            foreach ($validated['items'] as $item) {
                $qty = (float) $item['quantity_ordered'];
                $cost = (float) $item['unit_cost'];
                $lineTotal = round($qty * $cost, 2);
                $subtotal += $lineTotal;

                PurchaseOrderItem::create([
                    'purchase_order_id' => $purchaseOrder->id,
                    'inventory_item_id' => $item['inventory_item_id'],
                    'quantity_ordered' => $qty,
                    'quantity_received' => 0.000,
                    'unit_cost' => $cost,
                    'total_price' => $lineTotal,
                ]);
            }

            $tax = round($subtotal * 0.05, 2); // 5% GST
            $purchaseOrder->update([
                'subtotal' => $subtotal,
                'tax_amount' => $tax,
                'total_amount' => $subtotal + $tax,
            ]);

            return $purchaseOrder;
        });

        AuditLog::log(
            'purchase_order.created',
            $po,
            null,
            ['po_number' => $po->po_number, 'total_amount' => $po->total_amount],
            $user
        );

        return $this->successResponse($po->load(['items.inventoryItem', 'supplier', 'branch']), 'Purchase order created successfully.', 201);
    }

    /**
     * Display a specific purchase order with items.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $po = PurchaseOrder::with([
            'items.inventoryItem',
            'supplier',
            'branch',
            'creator:id,name',
            'receiver:id,name',
        ])->findOrFail($id);

        if (!$request->user()->hasRestaurantAccess($po->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this purchase order.', 403);
        }

        return $this->successResponse($po, 'Purchase order retrieved.');
    }

    /**
     * Receive shipment against a purchase order.
     * Automatically increments inventory stock and creates purchase_in stock movements.
     */
    public function receive(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $po = PurchaseOrder::with('items.inventoryItem')->findOrFail($id);

        if (!$user->hasRestaurantAccess($po->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this purchase order.', 403);
        }

        if ($po->status === 'received') {
            return $this->errorResponse('This purchase order has already been completely received.', 400);
        }

        if (in_array($po->status, ['cancelled', 'draft'], true)) {
            return $this->errorResponse("Cannot receive goods against a {$po->status} purchase order.", 422);
        }

        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.item_id' => 'required|exists:purchase_order_items,id',
            'items.*.quantity_received' => 'required|numeric|min:0',
        ]);

        // Pre-validate no over-receiving
        foreach ($validated['items'] as $receipt) {
            $poItem = $po->items->firstWhere('id', $receipt['item_id']);
            if (!$poItem) {
                return $this->errorResponse('One or more line items do not belong to this purchase order.', 422);
            }
            $qtyNow = (float) $receipt['quantity_received'];
            $newTotal = round((float) $poItem->quantity_received + $qtyNow, 3);
            if ($newTotal > (float) $poItem->quantity_ordered + 0.001) {
                return $this->errorResponse(
                    "Received quantity ({$newTotal}) exceeds ordered quantity ({$poItem->quantity_ordered}) for item #{$poItem->id}.",
                    422
                );
            }
        }

        DB::transaction(function () use ($po, $validated, $user) {
            foreach ($validated['items'] as $receipt) {
                $poItem = $po->items->firstWhere('id', $receipt['item_id']);
                if (!$poItem) continue;

                $qtyReceivedNow = (float) $receipt['quantity_received'];
                if ($qtyReceivedNow <= 0) continue;

                $newTotalReceived = round((float) $poItem->quantity_received + $qtyReceivedNow, 3);
                $poItem->update(['quantity_received' => $newTotalReceived]);

                // Increment stock level for the inventory item
                $inventoryItem = $poItem->inventoryItem;
                if ($inventoryItem) {
                    $inventoryItem->adjustStock(
                        $qtyReceivedNow,
                        'purchase_in',
                        $user->id,
                        "Received against {$po->po_number}",
                        'purchase_order',
                        $po->id,
                        "Supplier delivery accepted"
                    );
                }
            }

            // Check ALL line items on the PO (fixes partial-receipt lockout bug)
            $allReceived = $po->items()->get()->every(
                fn($item) => (float) $item->quantity_received + 0.001 >= (float) $item->quantity_ordered
            );

            $po->update([
                'status' => $allReceived ? 'received' : 'partially_received',
                'received_date' => now(),
                'received_by' => $user->id,
            ]);
        });

        AuditLog::log(
            'purchase_order.received',
            $po,
            null,
            ['po_number' => $po->po_number, 'status' => $po->status],
            $user
        );

        return $this->successResponse($po->fresh(['items.inventoryItem', 'supplier', 'branch']), "Purchase order marked as {$po->status}.");
    }
}
