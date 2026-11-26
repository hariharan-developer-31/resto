<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\DiningTable;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Restaurant;
use App\Models\User;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    use ApiResponse;

    /**
     * Get comprehensive restaurant revenue and sales overview analytics.
     */
    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();

        $restaurantId = $request->header('X-Restaurant-ID')
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Branch::first()?->restaurant_id;
        }

        if (!$restaurantId) {
            return $this->errorResponse('Please specify an active restaurant context.', 400);
        }

        if (!$user->hasRestaurantAccess((int) $restaurantId)) {
            return $this->errorResponse('Unauthorized access to this restaurant.', 403);
        }

        $branchId = $request->header('X-Branch-ID') ?? $request->input('branch_id');

        // Date range filter (default: last 30 days)
        $endDate = $request->input('end_date') ? Carbon::parse($request->input('end_date'))->endOfDay() : now()->endOfDay();
        $startDate = $request->input('start_date') ? Carbon::parse($request->input('start_date'))->startOfDay() : now()->subDays(29)->startOfDay();

        // Base query for paid orders
        $ordersQuery = Order::where('restaurant_id', $restaurantId)
            ->where('payment_status', 'paid')
            ->whereBetween('created_at', [$startDate, $endDate]);

        if ($branchId) {
            $ordersQuery->where('branch_id', $branchId);
        }

        $orders = $ordersQuery->get();

        // 1. KPI Aggregations
        $totalGrossRevenue = (float) $orders->sum('total_amount');
        $totalNetSales = (float) $orders->sum('subtotal');
        $totalTax = (float) $orders->sum('tax_amount');
        $totalDiscounts = (float) $orders->sum('discount_amount');
        $totalOrdersCount = $orders->count();
        $averageOrderValue = $totalOrdersCount > 0 ? round($totalGrossRevenue / $totalOrdersCount, 2) : 0.00;

        // Total guest headcount from dine-in orders
        $totalGuestsServed = (int) $orders->where('order_type', 'dine_in')->sum('guest_count');

        // 2. Daily Revenue Trend (Recharts Compatible)
        $dailyTrend = [];
        $cursor = $startDate->copy();
        while ($cursor->lte($endDate)) {
            $dateStr = $cursor->format('Y-m-d');
            $dayOrders = $orders->filter(fn($o) => Carbon::parse($o->created_at)->format('Y-m-d') === $dateStr);

            $dailyTrend[] = [
                'date' => $dateStr,
                'day' => $cursor->format('D, M j'),
                'revenue' => round((float) $dayOrders->sum('total_amount'), 2),
                'orders' => $dayOrders->count(),
                'net_sales' => round((float) $dayOrders->sum('subtotal'), 2),
                'tax' => round((float) $dayOrders->sum('tax_amount'), 2),
            ];
            $cursor->addDay();
        }

        // 3. Order Type Distribution
        $orderTypeDistribution = [
            'dine_in' => [
                'count' => $orders->where('order_type', 'dine_in')->count(),
                'revenue' => round((float) $orders->where('order_type', 'dine_in')->sum('total_amount'), 2),
            ],
            'takeaway' => [
                'count' => $orders->where('order_type', 'takeaway')->count(),
                'revenue' => round((float) $orders->where('order_type', 'takeaway')->sum('total_amount'), 2),
            ],
            'delivery' => [
                'count' => $orders->where('order_type', 'delivery')->count(),
                'revenue' => round((float) $orders->where('order_type', 'delivery')->sum('total_amount'), 2),
            ],
        ];

        // 4. Payment Modes Breakdown
        $orderIds = $orders->pluck('id');
        $payments = Payment::whereIn('order_id', $orderIds)
            ->whereIn('status', ['success', 'successful'])
            ->get();

        $paymentModes = [
            'cash' => round((float) $payments->where('payment_method', 'cash')->sum('amount'), 2),
            'upi' => round((float) $payments->where('payment_method', 'upi')->sum('amount'), 2),
            'card' => round((float) $payments->where('payment_method', 'card')->sum('amount'), 2),
            'other' => round((float) $payments->whereNotIn('payment_method', ['cash', 'upi', 'card'])->sum('amount'), 2),
        ];

        // 5. Hourly Order Volume Heatmap (00:00 to 23:00)
        $hourlyRush = [];
        for ($h = 0; $h < 24; $h++) {
            $hStr = sprintf('%02d:00', $h);
            $count = $orders->filter(fn($o) => (int) Carbon::parse($o->created_at)->format('H') === $h)->count();
            $hourlyRush[] = [
                'hour' => $hStr,
                'orders' => $count,
            ];
        }

        return $this->successResponse([
            'summary' => [
                'total_gross_revenue' => $totalGrossRevenue,
                'total_net_sales' => $totalNetSales,
                'total_tax_collected' => $totalTax,
                'total_discounts_given' => $totalDiscounts,
                'total_orders' => $totalOrdersCount,
                'average_order_value' => $averageOrderValue,
                'total_guests_served' => $totalGuestsServed,
                'date_range' => [
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                ],
            ],
            'daily_trend' => $dailyTrend,
            'order_type_distribution' => $orderTypeDistribution,
            'payment_modes' => $paymentModes,
            'hourly_rush' => $hourlyRush,
        ], 'Overview analytics retrieved successfully.');
    }

    /**
     * Menu Engineering & Dish Product Mix analysis.
     */
    public function menuEngineering(Request $request): JsonResponse
    {
        $user = $request->user();

        $restaurantId = $request->header('X-Restaurant-ID')
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Branch::first()?->restaurant_id;
        }

        if (!$restaurantId || !$user->hasRestaurantAccess((int) $restaurantId)) {
            return $this->errorResponse('Unauthorized or missing restaurant context.', 403);
        }

        $branchId = $request->header('X-Branch-ID') ?? $request->input('branch_id');

        $query = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('menu_items', 'order_items.menu_item_id', '=', 'menu_items.id')
            ->leftJoin('categories', 'menu_items.category_id', '=', 'categories.id')
            ->where('orders.restaurant_id', $restaurantId)
            ->where('orders.payment_status', 'paid')
            ->where('order_items.status', '!=', 'cancelled');

        if ($branchId) {
            $query->where('orders.branch_id', $branchId);
        }

        $items = $query->select(
            'menu_items.id',
            'menu_items.name',
            'menu_items.type',
            'categories.name as category_name',
            DB::raw('SUM(order_items.quantity) as total_quantity'),
            DB::raw('SUM(order_items.total_price) as total_revenue'),
            DB::raw('AVG(order_items.unit_price) as avg_unit_price')
        )
        ->groupBy('menu_items.id', 'menu_items.name', 'menu_items.type', 'categories.name')
        ->orderByDesc('total_revenue')
        ->get();

        // Calculate Category contribution
        $categoryBreakdown = [];
        $totalSales = $items->sum('total_revenue');

        foreach ($items->groupBy('category_name') as $catName => $catItems) {
            $catRev = $catItems->sum('total_revenue');
            $categoryBreakdown[] = [
                'category' => $catName ?: 'General',
                'revenue' => round($catRev, 2),
                'quantity' => $catItems->sum('total_quantity'),
                'percentage' => $totalSales > 0 ? round(($catRev / $totalSales) * 100, 1) : 0,
            ];
        }

        return $this->successResponse([
            'top_dishes' => $items->take(15)->map(fn($item) => [
                'id' => $item->id,
                'name' => $item->name,
                'category' => $item->category_name ?: 'General',
                'type' => $item->type,
                'quantity_sold' => (int) $item->total_quantity,
                'revenue' => round((float) $item->total_revenue, 2),
                'avg_price' => round((float) $item->avg_unit_price, 2),
            ]),
            'category_breakdown' => $categoryBreakdown,
        ], 'Menu engineering analytics retrieved.');
    }

    /**
     * Table turnaround time & dining floor efficiency.
     */
    public function tableEfficiency(Request $request): JsonResponse
    {
        $user = $request->user();

        $restaurantId = $request->header('X-Restaurant-ID')
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Branch::first()?->restaurant_id;
        }

        if (!$restaurantId || !$user->hasRestaurantAccess((int) $restaurantId)) {
            return $this->errorResponse('Unauthorized or missing restaurant context.', 403);
        }

        $branchId = $request->header('X-Branch-ID') ?? $request->input('branch_id');

        $query = Order::where('restaurant_id', $restaurantId)
            ->where('order_type', 'dine_in')
            ->where('payment_status', 'paid')
            ->whereNotNull('table_id');

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        $completedOrders = $query->with('table:id,table_number,location,seating_capacity')->latest()->take(50)->get();

        $turnaroundTimes = [];
        foreach ($completedOrders as $order) {
            $created = Carbon::parse($order->created_at);
            $settled = Carbon::parse($order->settled_at ?? $order->updated_at);
            $diffMinutes = max(1, (int) abs($created->diffInMinutes($settled)));
            $turnaroundTimes[] = $diffMinutes;
        }

        $avgTurnaround = count($turnaroundTimes) > 0 ? round(array_sum($turnaroundTimes) / count($turnaroundTimes)) : 0;

        // Current Floor Occupancy
        $tablesQuery = DiningTable::query();
        if ($branchId) {
            $tablesQuery->where('branch_id', $branchId);
        } elseif ($restaurantId) {
            $tablesQuery->where('restaurant_id', $restaurantId);
        }

        $allTables = $tablesQuery->get();
        $totalTables = $allTables->count();
        $occupiedTables = $allTables->where('status', 'occupied')->count();
        $occupancyRate = $totalTables > 0 ? round(($occupiedTables / $totalTables) * 100, 1) : 0;

        return $this->successResponse([
            'average_turnaround_minutes' => $avgTurnaround,
            'total_tables' => $totalTables,
            'occupied_tables' => $occupiedTables,
            'occupancy_rate_percentage' => $occupancyRate,
            'tables_summary' => $allTables->groupBy('location')->map(fn($group, $loc) => [
                'location' => $loc ?: 'Main Hall',
                'total' => $group->count(),
                'occupied' => $group->where('status', 'occupied')->count(),
            ])->values(),
        ], 'Table efficiency analytics retrieved.');
    }

    /**
     * End-of-Day (EOD) Z-Report for cashier shift & tax register balancing.
     */
    public function eodReport(Request $request): JsonResponse
    {
        $user = $request->user();

        $restaurantId = $request->header('X-Restaurant-ID')
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Branch::first()?->restaurant_id;
        }

        if (!$restaurantId || !$user->hasRestaurantAccess((int) $restaurantId)) {
            return $this->errorResponse('Unauthorized or missing restaurant context.', 403);
        }

        $branchId = $request->header('X-Branch-ID')
            ?? $request->input('branch_id')
            ?? Branch::where('restaurant_id', $restaurantId)->first()?->id;

        if (!$branchId) {
            return $this->errorResponse('No branch found for this restaurant.', 404);
        }

        $branch = Branch::with('restaurant')->where('restaurant_id', $restaurantId)->findOrFail($branchId);

        $reportDate = $request->input('date', now()->toDateString());
        $start = Carbon::parse($reportDate)->startOfDay();
        $end = Carbon::parse($reportDate)->endOfDay();

        // Orders on this day
        $orders = Order::where('branch_id', $branch->id)
            ->whereBetween('created_at', [$start, $end])
            ->get();

        $paidOrders = $orders->where('payment_status', 'paid');
        $cancelledOrders = $orders->where('order_status', 'cancelled');

        $grossSales = (float) $paidOrders->sum('total_amount');
        $subtotal = (float) $paidOrders->sum('subtotal');
        $totalTax = (float) $paidOrders->sum('tax_amount');
        $cgst = round($totalTax / 2, 2);
        $sgst = round($totalTax / 2, 2);
        $discounts = (float) $paidOrders->sum('discount_amount');
        $serviceCharges = (float) $paidOrders->sum('service_charge');
        $packagingCharges = (float) $paidOrders->sum('packaging_charge');

        // Payment tenders
        $orderIds = $paidOrders->pluck('id');
        $payments = Payment::whereIn('order_id', $orderIds)
            ->whereIn('status', ['success', 'successful'])
            ->get();

        $cashTendered = (float) $payments->where('payment_method', 'cash')->sum('amount');
        $upiTendered = (float) $payments->where('payment_method', 'upi')->sum('amount');
        $cardTendered = (float) $payments->where('payment_method', 'card')->sum('amount');

        return $this->successResponse([
            'report_metadata' => [
                'report_type' => 'End-of-Day (EOD) Z-Report',
                'report_date' => $reportDate,
                'generated_at' => now()->toIso8601String(),
                'restaurant_name' => $branch->restaurant->name,
                'branch_name' => $branch->name,
                'branch_address' => $branch->address,
                'gst_number' => $branch->restaurant->gst_number,
                'currency' => $branch->restaurant->currency_symbol,
            ],
            'financial_summary' => [
                'gross_sales' => $grossSales,
                'net_sales' => $subtotal,
                'discounts' => $discounts,
                'cgst_amount' => $cgst,
                'sgst_amount' => $sgst,
                'total_tax' => $totalTax,
                'service_charges' => $serviceCharges,
                'packaging_charges' => $packagingCharges,
            ],
            'tender_reconciliation' => [
                'cash' => $cashTendered,
                'upi' => $upiTendered,
                'card' => $cardTendered,
                'total_collected' => $cashTendered + $upiTendered + $cardTendered,
            ],
            'order_statistics' => [
                'total_orders' => $orders->count(),
                'paid_orders' => $paidOrders->count(),
                'cancelled_orders' => $cancelledOrders->count(),
                'dine_in_count' => $paidOrders->where('order_type', 'dine_in')->count(),
                'takeaway_count' => $paidOrders->where('order_type', 'takeaway')->count(),
                'delivery_count' => $paidOrders->where('order_type', 'delivery')->count(),
            ],
            'cancelled_orders_audit' => $cancelledOrders->map(fn($o) => [
                'order_number' => $o->order_number,
                'cancellation_reason' => $o->cancellation_reason,
                'amount' => $o->total_amount,
                'cancelled_at' => $o->cancelled_at,
            ])->values(),
        ], 'End-of-Day Z-Report compiled successfully.');
    }

    /**
     * GST and Tax liability ledger report.
     */
    public function taxReport(Request $request): JsonResponse
    {
        $user = $request->user();

        $restaurantId = $request->header('X-Restaurant-ID')
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Branch::first()?->restaurant_id;
        }

        if (!$restaurantId || !$user->hasRestaurantAccess((int) $restaurantId)) {
            return $this->errorResponse('Unauthorized or missing restaurant context.', 403);
        }

        $startDate = $request->input('start_date') ? Carbon::parse($request->input('start_date'))->startOfDay() : now()->startOfMonth();
        $endDate = $request->input('end_date') ? Carbon::parse($request->input('end_date'))->endOfDay() : now()->endOfMonth();

        $orders = Order::where('restaurant_id', $restaurantId)
            ->where('payment_status', 'paid')
            ->whereBetween('created_at', [$startDate, $endDate])
            ->get();

        $taxableSubtotal = (float) $orders->sum('subtotal');
        $totalTax = (float) $orders->sum('tax_amount');
        $cgst = round($totalTax / 2, 2);
        $sgst = round($totalTax / 2, 2);

        return $this->successResponse([
            'date_range' => [
                'from' => $startDate->toDateString(),
                'to' => $endDate->toDateString(),
            ],
            'taxable_amount' => $taxableSubtotal,
            'cgst_2_5_pct' => $cgst,
            'sgst_2_5_pct' => $sgst,
            'total_tax_liability' => $totalTax,
            'invoices_count' => $orders->count(),
        ], 'Tax report compiled.');
    }
}
