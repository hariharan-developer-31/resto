<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Addon;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Category;
use App\Models\DiningTable;
use App\Models\MenuItem;
use App\Models\MenuVariant;
use App\Models\Notification;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAddon;
use App\Models\Reservation;
use App\Models\Restaurant;
use App\Services\InventoryDeductionService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PublicGuestController extends Controller
{
    use ApiResponse;

    /**
     * Public restaurant landing profile with branches and full active menu.
     */
    public function restaurantDetails(string $slug): JsonResponse
    {
        $restaurant = Restaurant::where('slug', $slug)
            ->where('is_active', true)
            ->first();

        if (!$restaurant) {
            return $this->errorResponse('Restaurant not found.', 404);
        }

        $branches = Branch::where('restaurant_id', $restaurant->id)
            ->where('is_active', true)
            ->get();

        $categories = Category::where('restaurant_id', $restaurant->id)
            ->where('is_active', true)
            ->with(['menuItems' => function ($q) {
                $q->where('is_available', true)->with(['variants', 'addons']);
            }])
            ->orderBy('sort_order')
            ->get();

        return $this->successResponse([
            'restaurant' => $restaurant,
            'branches' => $branches,
            'menu_catalog' => $categories,
        ], 'Public restaurant profile retrieved.');
    }

    /**
     * Resolve Table via QR Token, returning table status, active session, and digital menu.
     */
    public function resolveTable(string $qrToken): JsonResponse
    {
        $table = DiningTable::with(['restaurant', 'branch', 'waiter:id,name'])
            ->where('qr_token', $qrToken)
            ->first();

        if (!$table) {
            return $this->errorResponse('Invalid or expired table QR code. Please ask floor staff for assistance.', 404);
        }

        // Active order session on this table if any
        $activeOrder = Order::with(['items.addons'])
            ->where('table_id', $table->id)
            ->whereIn('order_status', ['pending', 'preparing', 'ready'])
            ->where('payment_status', '!=', 'paid')
            ->latest()
            ->first();

        // Digital menu catalog for this restaurant
        $categories = Category::where('restaurant_id', $table->restaurant_id)
            ->where('is_active', true)
            ->with(['menuItems' => function ($q) {
                $q->where('is_available', true)->with(['variants', 'addons']);
            }])
            ->orderBy('sort_order')
            ->get();

        return $this->successResponse([
            'table' => [
                'id' => $table->id,
                'table_number' => $table->table_number,
                'location' => $table->location,
                'seating_capacity' => $table->seating_capacity,
                'status' => $table->status,
                'qr_token' => $table->qr_token,
                'waiter_name' => $table->waiter?->name,
            ],
            'restaurant' => $table->restaurant,
            'branch' => $table->branch,
            'active_order' => $activeOrder,
            'categories' => $categories,
        ], 'Table resolved successfully.');
    }

    /**
     * Contactless order placement directly from table QR code.
     */
    public function placeTableOrder(Request $request, string $qrToken): JsonResponse
    {
        $table = DiningTable::with('branch')->where('qr_token', $qrToken)->first();
        if (!$table) {
            return $this->errorResponse('Invalid table QR token.', 404);
        }

        if ($table->status === 'out_of_service') {
            return $this->errorResponse('This table is currently unavailable for ordering.', 422);
        }

        $validated = $request->validate([
            'customer_name' => 'nullable|string|max:100',
            'customer_phone' => 'nullable|string|max:30',
            'special_instructions' => 'nullable|string|max:500',
            'items' => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|exists:menu_items,id',
            'items.*.menu_variant_id' => 'nullable|exists:menu_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.special_instructions' => 'nullable|string|max:255',
            'items.*.addon_ids' => 'nullable|array',
            'items.*.addon_ids.*' => 'exists:addons,id',
        ]);

        // Validate every item & addon belongs to this table's restaurant and is available
        foreach ($validated['items'] as $itemData) {
            $menuItemCheck = MenuItem::find($itemData['menu_item_id']);
            if (!$menuItemCheck || (int) $menuItemCheck->restaurant_id !== (int) $table->restaurant_id) {
                return $this->errorResponse('One or more selected items do not belong to this restaurant.', 422);
            }
            if (!$menuItemCheck->is_available) {
                return $this->errorResponse("Item [{$menuItemCheck->name}] is currently out of stock.", 422);
            }
            if (!empty($itemData['addon_ids'])) {
                $invalidAddon = Addon::whereIn('id', $itemData['addon_ids'])
                    ->where(function ($q) use ($table) {
                        $q->where('restaurant_id', '!=', $table->restaurant_id)->orWhere('is_active', false);
                    })
                    ->exists();
                if ($invalidAddon) {
                    return $this->errorResponse('One or more selected addons are unavailable for this restaurant.', 422);
                }
            }
        }

        return DB::transaction(function () use ($validated, $table) {
            $lockedTable = DiningTable::where('id', $table->id)->lockForUpdate()->firstOrFail();
            $restaurantId = $lockedTable->restaurant_id;
            $branchId = $lockedTable->branch_id;
            $branchTaxRate = $table->branch?->tax_rate ?? 5.00;

            // Check if table already has an active order
            $order = Order::where('table_id', $lockedTable->id)
                ->whereIn('order_status', ['pending', 'preparing', 'ready'])
                ->where('payment_status', '!=', 'paid')
                ->lockForUpdate()
                ->latest()
                ->first();

            $isNewOrder = false;
            $roundNumber = 1;

            if ($order) {
                // Additional Order Round
                $order->increment('round_count');
                $roundNumber = $order->round_count;

                if ($order->order_status === 'ready') {
                    $order->update(['order_status' => 'preparing']);
                }
            } else {
                $isNewOrder = true;
                $orderNumber = Order::generateOrderNumber((int) $branchId);

                $order = Order::create([
                    'restaurant_id' => $restaurantId,
                    'branch_id' => $branchId,
                    'table_id' => $lockedTable->id,
                    'waiter_id' => $lockedTable->waiter_id,
                    'customer_name' => $validated['customer_name'] ?? 'Table Guest',
                    'customer_phone' => $validated['customer_phone'] ?? null,
                    'guest_count' => $lockedTable->seating_capacity,
                    'order_number' => $orderNumber,
                    'order_type' => 'dine_in',
                    'order_status' => 'pending',
                    'payment_status' => 'unpaid',
                    'subtotal' => 0.00,
                    'tax_amount' => 0.00,
                    'discount_amount' => 0.00,
                    'total_amount' => 0.00,
                    'round_count' => 1,
                    'special_instructions' => $validated['special_instructions'] ?? null,
                ]);

                if ($lockedTable->status !== 'occupied') {
                    $lockedTable->update(['status' => 'occupied']);
                }
            }

            // Generate KOT Ticket
            $kotNumber = Order::generateKotNumber((int) $branchId);
            $newOrderItems = [];

            // Process Items
            foreach ($validated['items'] as $itemData) {
                $menuItem = MenuItem::findOrFail($itemData['menu_item_id']);
                $unitPrice = $menuItem->base_price;
                $variantName = null;

                if (!empty($itemData['menu_variant_id'])) {
                    $variant = MenuVariant::where('menu_item_id', $menuItem->id)->find($itemData['menu_variant_id']);
                    if ($variant) {
                        $unitPrice = $variant->price;
                        $variantName = $variant->name;
                    }
                }

                $quantity = $itemData['quantity'];
                $itemSubtotal = $unitPrice * $quantity;

                // Addons
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
                $taxRate = $menuItem->tax_rate ?? $branchTaxRate;
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

            // Recalculate Totals (preserving any existing staff discount/service/packaging charges)
            $order->recalculateTotals(
                (float) ($order->discount_amount ?? 0.00),
                (float) ($order->service_charge ?? 0.00),
                (float) ($order->packaging_charge ?? 0.00)
            );

            // Auto-deduct raw materials via Recipe BOM
            InventoryDeductionService::deductForOrderItems($order, $newOrderItems, null);

            // Record Audit Log
            AuditLog::log(
                $isNewOrder ? 'qr.order_placed' : 'qr.round_added',
                $order,
                null,
                [
                    'table_number' => $table->table_number,
                    'order_number' => $order->order_number,
                    'kot_number' => $kotNumber,
                    'round_number' => $roundNumber,
                ],
                $restaurantId,
                $branchId
            );

            $order->load(['items.addons', 'table']);

            return $this->successResponse([
                'order' => $order,
                'kot_number' => $kotNumber,
                'round_number' => $roundNumber,
                'tracking_url' => "/order/track/{$order->order_number}",
            ], $isNewOrder ? 'Your order has been placed and sent to the kitchen!' : 'New round added to your table order!', 201);
        });
    }

    /**
     * Real-time order tracking for guests.
     */
    public function trackOrder(string $orderNumber): JsonResponse
    {
        $order = Order::with(['table', 'items' => function ($q) {
            $q->where('status', '!=', 'cancelled')->with('addons');
        }])
        ->where('order_number', $orderNumber)
        ->first();

        if (!$order) {
            return $this->errorResponse('Order not found.', 404);
        }

        // Compute overall stage (avoid empty collection returning true for every())
        $statuses = $order->items->pluck('status');
        if ($order->order_status === 'cancelled' || $statuses->isEmpty()) {
            $stage = 0;
            $stageLabel = 'Cancelled';
        } elseif ($statuses->every(fn($s) => $s === 'served')) {
            $stage = 4;
            $stageLabel = 'Served';
        } elseif ($statuses->contains('ready')) {
            $stage = 3;
            $stageLabel = 'Ready for Serving';
        } elseif ($statuses->contains('preparing')) {
            $stage = 2;
            $stageLabel = 'Preparing in Kitchen';
        } else {
            $stage = 1;
            $stageLabel = 'Order Received';
        }

        return $this->successResponse([
            'order_number' => $order->order_number,
            'table_number' => $order->table?->table_number,
            'round_count' => $order->round_count,
            'order_status' => $order->order_status,
            'payment_status' => $order->payment_status,
            'stage' => $stage,
            'stage_label' => $stageLabel,
            'total_amount' => $order->total_amount,
            'created_at' => $order->created_at->toIso8601String(),
            'items' => $order->items->map(fn($item) => [
                'name' => $item->item_name,
                'quantity' => $item->quantity,
                'variant_name' => $item->variant_name,
                'status' => $item->status,
                'round_number' => $item->round_number,
                'kitchen_station' => $item->kitchen_station,
                'addons' => $item->addons->map(fn($a) => $a->addon_name),
            ]),
        ], 'Order tracking status retrieved.');
    }

    /**
     * Digital Table Bell: Guest requests service at table.
     */
    public function serviceRequest(Request $request, string $qrToken): JsonResponse
    {
        $table = DiningTable::where('qr_token', $qrToken)->first();
        if (!$table) {
            return $this->errorResponse('Invalid table QR token.', 404);
        }

        $validated = $request->validate([
            'request_type' => 'required|in:call_waiter,request_water,request_bill,request_cutlery,custom',
            'note' => 'nullable|string|max:200',
        ]);

        $typeLabels = [
            'call_waiter' => 'Call Waiter Assistance',
            'request_water' => 'Water Service Requested',
            'request_bill' => 'Bill Requested',
            'request_cutlery' => 'Extra Cutlery Requested',
            'custom' => 'Service Request',
        ];

        $title = $typeLabels[$validated['request_type']];

        // Create live Notification for floor staff & Topbar bell
        Notification::create([
            'restaurant_id' => $table->restaurant_id,
            'branch_id' => $table->branch_id,
            'user_id' => $table->waiter_id,
            'type' => 'table_service_request',
            'title' => "Table {$table->table_number}: {$title}",
            'message' => $validated['note']
                ? "Table {$table->table_number} ({$table->location}): {$validated['note']}"
                : "Guest at Table {$table->table_number} ({$table->location}) requested {$title}.",
            'data' => [
                'table_id' => $table->id,
                'table_number' => $table->table_number,
                'location' => $table->location,
                'request_type' => $validated['request_type'],
                'note' => $validated['note'] ?? null,
            ],
        ]);

        // Audit Log
        AuditLog::log(
            'table.service_request',
            $table,
            null,
            [
                'table_number' => $table->table_number,
                'request_type' => $validated['request_type'],
                'note' => $validated['note'] ?? null,
            ],
            $table->restaurant_id,
            $table->branch_id
        );

        return $this->successResponse([
            'table_number' => $table->table_number,
            'request_type' => $validated['request_type'],
            'message' => "Your request for {$title} has been sent to our floor staff. We'll be at Table {$table->table_number} in a moment!",
        ], 'Staff notified.');
    }

    /**
     * Public Guest Table Reservation Booking.
     */
    public function createReservation(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'restaurant_id' => 'required|exists:restaurants,id',
            'branch_id' => 'required|exists:branches,id',
            'customer_name' => 'required|string|max:100',
            'customer_phone' => 'required|string|max:30',
            'customer_email' => 'nullable|email|max:100',
            'guest_count' => 'required|integer|min:1|max:50',
            'reservation_date' => 'required|date|after_or_equal:today',
            'reservation_time' => 'required|date_format:H:i',
            'special_requests' => 'nullable|string|max:500',
        ]);

        $branch = Branch::where('id', $validated['branch_id'])
            ->where('restaurant_id', $validated['restaurant_id'])
            ->where('is_active', true)
            ->first();

        if (!$branch) {
            return $this->errorResponse('Selected branch is unavailable or does not belong to this restaurant.', 422);
        }

        if ($branch->opening_time && $branch->closing_time) {
            if ($validated['reservation_time'] < $branch->opening_time || $validated['reservation_time'] > $branch->closing_time) {
                return $this->errorResponse(
                    "Reservations for {$branch->name} are accepted between {$branch->opening_time} and {$branch->closing_time}.",
                    422
                );
            }
        }

        $reservation = Reservation::create([
            'restaurant_id' => $validated['restaurant_id'],
            'branch_id' => $branch->id,
            'customer_name' => $validated['customer_name'],
            'customer_phone' => $validated['customer_phone'],
            'customer_email' => $validated['customer_email'] ?? null,
            'guest_count' => $validated['guest_count'],
            'reservation_date' => $validated['reservation_date'],
            'reservation_time' => $validated['reservation_time'],
            'status' => 'confirmed',
            'special_requests' => $validated['special_requests'] ?? null,
        ]);

        AuditLog::log(
            'reservation.created',
            $reservation,
            null,
            [
                'customer_name' => $reservation->customer_name,
                'guest_count' => $reservation->guest_count,
                'date' => $reservation->reservation_date,
            ],
            $reservation->restaurant_id,
            $reservation->branch_id
        );

        $responseData = $reservation->toArray();
        $responseData['booking_code'] = sprintf('RES-%05d', $reservation->id);

        return $this->successResponse($responseData, 'Your table reservation has been confirmed!', 201);
    }
}
