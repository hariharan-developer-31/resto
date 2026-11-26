<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Addon;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\DiningTable;
use App\Models\MenuItem;
use App\Models\MenuVariant;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAddon;
use App\Models\Payment;
use App\Models\Restaurant;
use App\Services\InventoryDeductionService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    use ApiResponse;

    /**
     * List orders with tenant scoping and status filters.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Order::with(['table', 'waiter:id,name,email', 'items.addons', 'payments']);

        // Tenant Isolation
        $restaurantId = $request->header('X-Restaurant-ID') 
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if ($restaurantId) {
            $query->where('restaurant_id', $restaurantId);
        } elseif (!$user->isSuperAdmin()) {
            $allowedRestaurantIds = $user->restaurants()->pluck('restaurants.id');
            $query->whereIn('restaurant_id', $allowedRestaurantIds);
        }

        $branchId = $request->header('X-Branch-ID') 
            ?? $request->input('branch_id')
            ?? $user->branches()->first()?->id;

        if ($branchId) {
            $query->where('branch_id', $branchId);
        } elseif (!$user->isSuperAdmin()) {
            $allowedBranchIds = $user->branches()->pluck('branches.id');
            if ($allowedBranchIds->isNotEmpty()) {
                $query->whereIn('branch_id', $allowedBranchIds);
            }
        }

        // Filters
        if ($request->filled('order_status')) {
            $query->where('order_status', $request->input('order_status'));
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->input('payment_status'));
        }

        if ($request->filled('order_type')) {
            $query->where('order_type', $request->input('order_type'));
        }

        if ($request->filled('table_id')) {
            $query->where('table_id', $request->input('table_id'));
        }

        if ($request->filled('waiter_id')) {
            $query->where('waiter_id', $request->input('waiter_id'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                  ->orWhere('invoice_number', 'like', "%{$search}%")
                  ->orWhere('customer_name', 'like', "%{$search}%")
                  ->orWhere('customer_phone', 'like', "%{$search}%");
            });
        }

        if ($request->boolean('active_only')) {
            $query->whereIn('order_status', ['pending', 'preparing', 'ready']);
        }

        $orders = $query->latest()->paginate($request->integer('per_page', 25));

        return $this->successResponse($orders, 'Orders retrieved successfully.');
    }

    /**
     * Create an order or append a new round to an existing table order.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'restaurant_id' => 'nullable|exists:restaurants,id',
            'branch_id' => 'nullable|exists:branches,id',
            'table_id' => 'nullable|exists:dining_tables,id',
            'order_type' => 'required|in:dine_in,takeaway,delivery',
            'customer_name' => 'nullable|string|max:100',
            'customer_phone' => 'nullable|string|max:30',
            'guest_count' => 'nullable|integer|min:1|max:100',
            'special_instructions' => 'nullable|string',
            'discount_amount' => 'nullable|numeric|min:0',
            'service_charge' => 'nullable|numeric|min:0',
            'packaging_charge' => 'nullable|numeric|min:0',
            'items' => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|exists:menu_items,id',
            'items.*.menu_variant_id' => 'nullable|exists:menu_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.special_instructions' => 'nullable|string|max:255',
            'items.*.addon_ids' => 'nullable|array',
            'items.*.addon_ids.*' => 'exists:addons,id',
        ]);

        $restaurantId = $request->header('X-Restaurant-ID')
            ?? $validated['restaurant_id']
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Restaurant::first()?->id;
        }

        $branchId = $request->header('X-Branch-ID')
            ?? $validated['branch_id']
            ?? $user->branches()->first()?->id;

        if (!$branchId && $user->isSuperAdmin()) {
            $branchId = Branch::where('restaurant_id', $restaurantId)->first()?->id;
        }

        if (!$restaurantId || !$branchId) {
            return $this->errorResponse('Valid restaurant and branch context required.', 422);
        }

        $branch = Branch::find($branchId);
        if (!$branch || (int) $branch->restaurant_id !== (int) $restaurantId) {
            return $this->errorResponse('Valid restaurant and branch context required.', 422);
        }

        // Pre-validate items, addons, and table ownership before entering transaction
        if ($validated['order_type'] === 'dine_in' && !empty($validated['table_id'])) {
            $checkTable = DiningTable::find($validated['table_id']);
            if (!$checkTable || (int) $checkTable->branch_id !== (int) $branchId) {
                return $this->errorResponse('Selected table does not belong to the active branch.', 422);
            }
            if ($checkTable->status === 'out_of_service') {
                return $this->errorResponse('Selected table is currently out of service.', 422);
            }
        }

        foreach ($validated['items'] as $itemData) {
            $menuItemCheck = MenuItem::find($itemData['menu_item_id']);
            if (!$menuItemCheck || (int) $menuItemCheck->restaurant_id !== (int) $restaurantId) {
                return $this->errorResponse('One or more selected menu items do not belong to this restaurant.', 422);
            }
            if (!$menuItemCheck->is_available) {
                return $this->errorResponse("Menu item [{$menuItemCheck->name}] is currently unavailable.", 422);
            }
            if (!empty($itemData['addon_ids'])) {
                $invalidAddon = Addon::whereIn('id', $itemData['addon_ids'])
                    ->where(function ($q) use ($restaurantId) {
                        $q->where('restaurant_id', '!=', $restaurantId)->orWhere('is_active', false);
                    })
                    ->exists();
                if ($invalidAddon) {
                    return $this->errorResponse('One or more selected addons are unavailable or do not belong to this restaurant.', 422);
                }
            }
        }

        return DB::transaction(function () use ($validated, $restaurantId, $branchId, $branch, $user) {
            $table = null;
            $order = null;
            $isNewOrder = true;
            $roundNumber = 1;

            // Dine-in order resolution: lock table row to prevent duplicate concurrent orders
            if ($validated['order_type'] === 'dine_in' && !empty($validated['table_id'])) {
                $table = DiningTable::where('id', $validated['table_id'])->lockForUpdate()->first();

                // Look for existing active order on this table
                $existingOrder = Order::where('table_id', $table->id)
                    ->whereIn('order_status', ['pending', 'preparing', 'ready'])
                    ->where('payment_status', '!=', 'paid')
                    ->lockForUpdate()
                    ->latest()
                    ->first();

                if ($existingOrder) {
                    $order = $existingOrder;
                    $isNewOrder = false;
                    $order->increment('round_count');
                    $roundNumber = $order->round_count;

                    if ($order->order_status === 'ready') {
                        $order->update(['order_status' => 'preparing']);
                    }
                }
            }

            // Create new order if none active
            if (!$order) {
                $orderNumber = Order::generateOrderNumber((int) $branchId);
                $waiterId = $table?->waiter_id ?? ($user->hasRole('Waiter') ? $user->id : null);

                $order = Order::create([
                    'restaurant_id' => $restaurantId,
                    'branch_id' => $branchId,
                    'table_id' => $table?->id,
                    'waiter_id' => $waiterId,
                    'customer_name' => $validated['customer_name'] ?? null,
                    'customer_phone' => $validated['customer_phone'] ?? null,
                    'guest_count' => $validated['guest_count'] ?? ($table?->seating_capacity),
                    'order_number' => $orderNumber,
                    'order_type' => $validated['order_type'],
                    'order_status' => 'pending',
                    'payment_status' => 'unpaid',
                    'subtotal' => 0.00,
                    'tax_amount' => 0.00,
                    'discount_amount' => $validated['discount_amount'] ?? 0.00,
                    'service_charge' => $validated['service_charge'] ?? 0.00,
                    'packaging_charge' => $validated['packaging_charge'] ?? 0.00,
                    'total_amount' => 0.00,
                    'round_count' => 1,
                    'special_instructions' => $validated['special_instructions'] ?? null,
                ]);

                if ($table && $table->status !== 'occupied') {
                    $table->update(['status' => 'occupied']);
                }
            }

            // Generate KOT ticket number for this batch of items
            $kotNumber = Order::generateKotNumber((int) $branchId);
            $newOrderItems = [];

            // Process order items
            foreach ($validated['items'] as $itemData) {
                $menuItem = MenuItem::findOrFail($itemData['menu_item_id']);
                
                $unitPrice = $menuItem->base_price;
                $variantName = null;

                if (!empty($itemData['menu_variant_id'])) {
                    $variant = MenuVariant::where('menu_item_id', $menuItem->id)
                        ->find($itemData['menu_variant_id']);
                    if ($variant) {
                        $unitPrice = $variant->price;
                        $variantName = $variant->name;
                    }
                }

                $quantity = $itemData['quantity'];
                $itemSubtotal = $unitPrice * $quantity;

                // Process Addons
                $addonTotal = 0.00;
                $selectedAddons = [];
                if (!empty($itemData['addon_ids'])) {
                    $addons = Addon::whereIn('id', $itemData['addon_ids'])->get();
                    foreach ($addons as $addon) {
                        $addonPrice = $addon->price * $quantity;
                        $addonTotal += $addonPrice;
                        $selectedAddons[] = [
                            'addon_id' => $addon->id,
                            'addon_name' => $addon->name,
                            'unit_price' => $addon->price,
                            'quantity' => $quantity,
                            'total_price' => $addonPrice,
                        ];
                    }
                }

                $itemSubtotalWithAddons = $itemSubtotal + $addonTotal;
                $taxRate = $menuItem->tax_rate ?? $branch->tax_rate ?? 5.00;
                $taxAmount = round($itemSubtotalWithAddons * ($taxRate / 100), 2);
                $itemTotalPrice = $itemSubtotalWithAddons + $taxAmount;

                $orderItem = OrderItem::create([
                    'order_id' => $order->id,
                    'menu_item_id' => $menuItem->id,
                    'menu_variant_id' => $itemData['menu_variant_id'] ?? null,
                    'round_number' => $roundNumber,
                    'kot_number' => $kotNumber,
                    'item_name' => $menuItem->name,
                    'variant_name' => $variantName,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'subtotal' => $itemSubtotalWithAddons,
                    'tax_rate' => $taxRate,
                    'tax_amount' => $taxAmount,
                    'total_price' => $itemTotalPrice,
                    'status' => 'pending',
                    'kitchen_station' => $menuItem->kitchen_station ?? 'main',
                    'special_instructions' => $itemData['special_instructions'] ?? null,
                ]);

                foreach ($selectedAddons as $addonRecord) {
                    $addonRecord['order_item_id'] = $orderItem->id;
                    OrderItemAddon::create($addonRecord);
                }

                $newOrderItems[] = $orderItem;
            }

            // Recalculate Order Totals
            $discount = $validated['discount_amount'] ?? $order->discount_amount;
            $serviceCharge = $validated['service_charge'] ?? $order->service_charge;
            $packagingCharge = $validated['packaging_charge'] ?? $order->packaging_charge;

            $order->recalculateTotals($discount, $serviceCharge, $packagingCharge);

            // Auto-deduct raw materials via Recipe BOM
            InventoryDeductionService::deductForOrderItems($order, $newOrderItems, $user->id);

            // Audit log
            AuditLog::log(
                $isNewOrder ? 'order.created' : 'order.round_added',
                $order,
                null,
                [
                    'order_number' => $order->order_number,
                    'round_number' => $roundNumber,
                    'kot_number' => $kotNumber,
                    'total_amount' => $order->total_amount,
                ],
                $restaurantId,
                $branchId,
                $user->id
            );

            $order->load(['table', 'waiter:id,name,email', 'items.addons', 'payments']);

            return $this->successResponse([
                'order' => $order,
                'kot_number' => $kotNumber,
                'round_number' => $roundNumber,
                'new_items' => $newOrderItems,
            ], $isNewOrder ? 'Order created successfully.' : 'New round added to table order.', 201);
        });
    }

    /**
     * Show single order with items grouped by round and KOT tickets.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $order = Order::with(['table', 'waiter:id,name,email', 'items.addons', 'payments.receiver:id,name'])
            ->find($id);

        if (!$order) {
            return $this->errorResponse('Order not found.', 404);
        }

        if (!$request->user()->hasRestaurantAccess($order->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this order.', 403);
        }

        // Group items by round for clarity
        $itemsByRound = $order->items->groupBy('round_number');

        return $this->successResponse([
            'order' => $order,
            'rounds' => $itemsByRound,
        ], 'Order details retrieved successfully.');
    }

    /**
     * Update individual item preparation / served status.
     */
    public function updateItemStatus(Request $request, int $itemId): JsonResponse
    {
        $item = OrderItem::with('order')->find($itemId);
        if (!$item) {
            return $this->errorResponse('Order item not found.', 404);
        }

        if (!$request->user()->hasRestaurantAccess($item->order->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this order item.', 403);
        }

        $validated = $request->validate([
            'status' => 'required|in:pending,preparing,ready,served,cancelled',
        ]);

        $previousStatus = $item->status;
        $updateData = ['status' => $validated['status']];
        if ($validated['status'] === 'served') {
            $updateData['served_at'] = now();
        }

        $item->update($updateData);

        $order = $item->order;

        // Recalculate order totals if item was cancelled or restored
        if ($previousStatus === 'cancelled' || $validated['status'] === 'cancelled') {
            $order->recalculateTotals(
                (float) $order->discount_amount,
                (float) $order->service_charge,
                (float) $order->packaging_charge
            );
        }

        // Update overall order status (excluding cancelled items)
        $activeStatuses = $order->items()->where('status', '!=', 'cancelled')->pluck('status');
        if ($activeStatuses->isNotEmpty()) {
            if ($activeStatuses->every(fn($s) => $s === 'served' || $s === 'ready')) {
                $order->update(['order_status' => 'ready']);
            } elseif ($activeStatuses->contains('preparing')) {
                $order->update(['order_status' => 'preparing']);
            }
        }

        return $this->successResponse($item, "Item status updated to {$validated['status']}.");
    }

    /**
     * Settle bill, process payments (single or split), and close order.
     */
    public function settleBill(Request $request, int $orderId): JsonResponse
    {
        $order = Order::with(['items', 'table'])->find($orderId);
        if (!$order) {
            return $this->errorResponse('Order not found.', 404);
        }

        if (!$request->user()->hasRestaurantAccess($order->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this order.', 403);
        }

        if ($order->order_status === 'cancelled') {
            return $this->errorResponse('Cannot settle a cancelled order.', 422);
        }

        if ($order->payment_status === 'paid') {
            return $this->errorResponse('Order has already been fully paid and settled.', 422);
        }

        $validated = $request->validate([
            'payment_method' => 'nullable|string|in:cash,card,upi,split',
            'paid_amount' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'service_charge' => 'nullable|numeric|min:0',
            'packaging_charge' => 'nullable|numeric|min:0',
            'table_status_after' => 'nullable|string|in:cleaning,available,occupied',
            'payments' => 'nullable|array|min:1',
            'payments.*.payment_method' => 'required|in:cash,card,upi',
            'payments.*.amount' => 'required|numeric|min:0.01',
            'payments.*.transaction_reference' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
        ]);

        if (($validated['payment_method'] ?? null) === 'split' && empty($validated['payments'])) {
            return $this->errorResponse('Split payment requires at least one payment breakdown entry.', 422);
        }

        return DB::transaction(function () use ($validated, $order, $request) {
            $user = $request->user();

            // Apply any final discount / service / packaging charge adjustment
            if (
                array_key_exists('discount_amount', $validated) ||
                array_key_exists('service_charge', $validated) ||
                array_key_exists('packaging_charge', $validated)
            ) {
                $order->recalculateTotals(
                    $validated['discount_amount'] ?? (float) $order->discount_amount,
                    $validated['service_charge'] ?? (float) $order->service_charge,
                    $validated['packaging_charge'] ?? (float) $order->packaging_charge
                );
            }

            $totalAmount = (float) $order->total_amount;
            $paymentEntries = [];
            $totalPaid = 0.00;

            if (!empty($validated['payments'])) {
                // Split payment mode
                foreach ($validated['payments'] as $p) {
                    $paymentEntries[] = [
                        'method' => $p['payment_method'],
                        'amount' => (float) $p['amount'],
                        'reference' => $p['transaction_reference'] ?? null,
                    ];
                    $totalPaid += (float) $p['amount'];
                }
            } else {
                // Single payment mode
                $method = $validated['payment_method'] ?? 'cash';
                $amount = isset($validated['paid_amount']) ? (float) $validated['paid_amount'] : $totalAmount;
                $paymentEntries[] = [
                    'method' => $method,
                    'amount' => $amount,
                    'reference' => null,
                ];
                $totalPaid = $amount;
            }

            if ($totalPaid + 0.001 < $totalAmount) {
                return $this->errorResponse(
                    "Total paid amount (₹{$totalPaid}) cannot be less than order total (₹{$totalAmount}).",
                    422
                );
            }

            $changeAmount = round(max(0.00, $totalPaid - $totalAmount), 2);
            $invoiceNumber = Order::generateInvoiceNumber((int) $order->branch_id);

            // Record net applied payment amounts (so cash change does not inflate tender drawer reports)
            $remainingDue = $totalAmount;
            foreach ($paymentEntries as $entry) {
                $appliedAmount = round(min($entry['amount'], $remainingDue), 2);
                $remainingDue = max(0.00, round($remainingDue - $appliedAmount, 2));

                Payment::create([
                    'restaurant_id' => $order->restaurant_id,
                    'branch_id' => $order->branch_id,
                    'order_id' => $order->id,
                    'payment_method' => $entry['method'],
                    'amount' => $appliedAmount > 0 ? $appliedAmount : $entry['amount'],
                    'transaction_reference' => $entry['reference'],
                    'status' => 'success',
                    'received_by' => $user->id,
                    'notes' => $validated['notes'] ?? null,
                    'paid_at' => now(),
                ]);
            }

            // Update Order as Paid & Completed
            $order->update([
                'payment_status' => 'paid',
                'order_status' => 'completed',
                'paid_amount' => $totalPaid,
                'change_amount' => $changeAmount,
                'invoice_number' => $invoiceNumber,
                'settled_at' => now(),
            ]);

            // Release table
            if ($order->table) {
                $tableStatus = $validated['table_status_after'] ?? 'cleaning';
                $order->table->update(['status' => $tableStatus]);
            }

            // Audit Log
            AuditLog::log(
                'bill.settled',
                $order,
                null,
                [
                    'invoice_number' => $invoiceNumber,
                    'total_amount' => $totalAmount,
                    'total_paid' => $totalPaid,
                    'change_amount' => $changeAmount,
                    'payments_count' => count($paymentEntries),
                ],
                $order->restaurant_id,
                $order->branch_id,
                $user->id
            );

            $order->load(['table', 'waiter:id,name', 'payments', 'items.addons']);

            return $this->successResponse([
                'order' => $order,
                'invoice_number' => $invoiceNumber,
                'change_amount' => $changeAmount,
            ], 'Bill settled and invoice generated successfully.');
        });
    }

    /**
     * Cancel order with reason.
     */
    public function cancel(Request $request, int $orderId): JsonResponse
    {
        $order = Order::with('table')->find($orderId);
        if (!$order) {
            return $this->errorResponse('Order not found.', 404);
        }

        if (!$request->user()->hasRestaurantAccess($order->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this order.', 403);
        }

        if ($order->payment_status === 'paid') {
            return $this->errorResponse('Cannot cancel an order that has already been settled.', 422);
        }

        $validated = $request->validate([
            'cancellation_reason' => 'required|string|max:500',
        ]);

        $order->update([
            'order_status' => 'cancelled',
            'cancellation_reason' => $validated['cancellation_reason'],
            'cancelled_at' => now(),
        ]);

        // Cancel items
        $order->items()->update(['status' => 'cancelled']);

        // Free table if no other active orders
        if ($order->table) {
            $hasOtherActive = Order::where('table_id', $order->table_id)
                ->where('id', '!=', $order->id)
                ->whereIn('order_status', ['pending', 'preparing', 'ready'])
                ->exists();

            if (!$hasOtherActive) {
                $order->table->update(['status' => 'available']);
            }
        }

        AuditLog::log(
            'order.cancelled',
            $order,
            null,
            [
                'reason' => $validated['cancellation_reason'],
            ],
            $order->restaurant_id,
            $order->branch_id,
            $request->user()->id
        );

        return $this->successResponse($order, 'Order cancelled successfully.');
    }
}
