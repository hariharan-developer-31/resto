<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Restaurant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KdsController extends Controller
{
    use ApiResponse;

    /**
     * Retrieve KDS tickets grouped by KOT with station filtering and elapsed urgency.
     */
    public function tickets(Request $request): JsonResponse
    {
        $user = $request->user();

        // Tenant Scoping
        $restaurantId = $request->header('X-Restaurant-ID') 
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        $branchId = $request->header('X-Branch-ID') 
            ?? $request->input('branch_id')
            ?? $user->branches()->first()?->id;

        if (!$branchId && $user->isSuperAdmin()) {
            $branchId = Branch::first()?->id;
        }

        $station = $request->input('station', 'all');
        $viewMode = $request->input('mode', 'active'); // 'active' or 'completed'

        $query = OrderItem::with([
            'order.table',
            'order.waiter:id,name',
            'addons',
            'menuItem:id,name,image,kitchen_station',
        ])
        ->whereHas('order', function ($q) use ($restaurantId, $branchId) {
            if ($restaurantId) {
                $q->where('restaurant_id', $restaurantId);
            }
            if ($branchId) {
                $q->where('branch_id', $branchId);
            }
            $q->where('order_status', '!=', 'cancelled');
        });

        // Station Filter
        if ($station !== 'all') {
            $query->where('kitchen_station', $station);
        }

        // View Mode Filter
        if ($viewMode === 'completed') {
            $query->whereIn('status', ['ready', 'served'])
                  ->where('updated_at', '>=', now()->subHours(4));
        } else {
            $query->whereIn('status', ['pending', 'preparing']);
        }

        $items = $query->oldest('created_at')->get();

        // Group items by kot_number to form KDS Tickets
        $groupedTickets = $items->groupBy('kot_number')->map(function ($ticketItems, $kotNumber) {
            $firstItem = $ticketItems->first();
            $order = $firstItem->order;
            $createdAt = $firstItem->created_at;
            $elapsedMinutes = (int) now()->diffInMinutes($createdAt);

            // Urgency thresholds
            $urgency = 'normal';
            if ($elapsedMinutes >= 20) {
                $urgency = 'critical'; // Red alert
            } elseif ($elapsedMinutes >= 10) {
                $urgency = 'warning'; // Amber alert
            }

            return [
                'kot_number' => $kotNumber ?? 'KOT-MANUAL',
                'order_id' => $order?->id,
                'order_number' => $order?->order_number,
                'order_type' => $order?->order_type ?? 'dine_in',
                'table_number' => $order?->table?->table_number ?? ($order?->order_type === 'takeaway' ? 'Takeaway' : 'Delivery'),
                'table_location' => $order?->table?->location,
                'waiter_name' => $order?->waiter?->name ?? 'Staff Counter',
                'round_number' => $firstItem->round_number ?? 1,
                'created_at' => $createdAt->toIso8601String(),
                'elapsed_minutes' => $elapsedMinutes,
                'urgency' => $urgency,
                'total_items' => $ticketItems->sum('quantity'),
                'items' => $ticketItems->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'name' => $item->item_name,
                        'variant_name' => $item->variant_name,
                        'quantity' => $item->quantity,
                        'status' => $item->status,
                        'kitchen_station' => $item->kitchen_station,
                        'special_instructions' => $item->special_instructions,
                        'addons' => $item->addons->map(fn($a) => [
                            'name' => $a->addon_name,
                            'quantity' => $a->quantity,
                        ]),
                    ];
                })->values(),
                'all_preparing' => $ticketItems->every(fn($i) => $i->status === 'preparing'),
                'all_ready' => $ticketItems->every(fn($i) => $i->status === 'ready' || $i->status === 'served'),
            ];
        })->values();

        // Sort by elapsed minutes descending (oldest first for FIFO efficiency)
        $sortedTickets = $groupedTickets->sortByDesc('elapsed_minutes')->values();

        return $this->successResponse([
            'station' => $station,
            'mode' => $viewMode,
            'tickets_count' => $sortedTickets->count(),
            'tickets' => $sortedTickets,
        ], 'KDS tickets retrieved successfully.');
    }

    /**
     * Update preparation status of an individual dish item.
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

        // Recalculate order totals if item was cancelled or un-cancelled
        if ($previousStatus === 'cancelled' || $validated['status'] === 'cancelled') {
            $order->recalculateTotals(
                (float) $order->discount_amount,
                (float) $order->service_charge,
                (float) $order->packaging_charge
            );
        }

        // Sync overall order status (excluding cancelled items)
        $itemStatuses = $order->items()->where('status', '!=', 'cancelled')->pluck('status');
        if ($itemStatuses->isNotEmpty()) {
            if ($itemStatuses->every(fn($s) => $s === 'ready' || $s === 'served')) {
                $order->update(['order_status' => 'ready']);
            } elseif ($itemStatuses->contains('preparing') && $order->order_status !== 'ready') {
                $order->update(['order_status' => 'preparing']);
            }
        }

        AuditLog::log(
            'kds.item_status_updated',
            $item,
            null,
            ['status' => $validated['status']],
            $order->restaurant_id,
            $order->branch_id,
            $request->user()->id
        );

        return $this->successResponse($item, "Dish status updated to {$validated['status']}.");
    }

    /**
     * Batch mark all items in a KOT ticket as Ready.
     */
    public function markTicketReady(Request $request, string $kotNumber): JsonResponse
    {
        $user = $request->user();
        $station = $request->input('station', 'all');

        $query = OrderItem::where('kot_number', $kotNumber)
            ->whereIn('status', ['pending', 'preparing']);

        if ($station !== 'all') {
            $query->where('kitchen_station', $station);
        }

        $updatedCount = $query->update(['status' => 'ready']);

        // Check and sync order statuses
        $orders = Order::whereHas('items', fn($q) => $q->where('kot_number', $kotNumber))->get();
        foreach ($orders as $order) {
            if ($order->items()->pluck('status')->every(fn($s) => $s === 'ready' || $s === 'served')) {
                $order->update(['order_status' => 'ready']);
            }
        }

        return $this->successResponse([
            'kot_number' => $kotNumber,
            'updated_items_count' => $updatedCount,
        ], "KOT ticket {$kotNumber} marked as Ready for pickup.");
    }

    /**
     * Live KDS Station Summary Metrics.
     */
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();

        $restaurantId = $request->header('X-Restaurant-ID') 
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        $branchId = $request->header('X-Branch-ID') 
            ?? $request->input('branch_id')
            ?? $user->branches()->first()?->id;

        $itemsQuery = OrderItem::whereHas('order', function ($q) use ($restaurantId, $branchId) {
            if ($restaurantId) $q->where('restaurant_id', $restaurantId);
            if ($branchId) $q->where('branch_id', $branchId);
            $q->where('order_status', '!=', 'cancelled');
        });

        $pending = (clone $itemsQuery)->where('status', 'pending')->count();
        $preparing = (clone $itemsQuery)->where('status', 'preparing')->count();
        $ready = (clone $itemsQuery)->where('status', 'ready')->count();

        // Overdue (> 15 mins)
        $overdueTickets = (clone $itemsQuery)
            ->whereIn('status', ['pending', 'preparing'])
            ->where('created_at', '<=', now()->subMinutes(15))
            ->distinct('kot_number')
            ->count('kot_number');

        // Breakdown per kitchen station
        $stations = ['main', 'grill', 'tandoor', 'biryani', 'beverage', 'dessert'];
        $stationCounts = [];
        foreach ($stations as $st) {
            $stationCounts[$st] = (clone $itemsQuery)
                ->where('kitchen_station', $st)
                ->whereIn('status', ['pending', 'preparing'])
                ->count();
        }

        return $this->successResponse([
            'pending_items' => $pending,
            'preparing_items' => $preparing,
            'ready_items' => $ready,
            'overdue_tickets' => $overdueTickets,
            'station_counts' => $stationCounts,
        ], 'KDS summary metrics retrieved.');
    }
}
