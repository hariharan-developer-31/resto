<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\DiningTable;
use App\Models\Order;
use App\Models\Reservation;
use App\Models\Restaurant;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SuperAdminController extends Controller
{
    use ApiResponse;

    /**
     * Get aggregate platform analytics directly from database.
     */
    public function dashboardStats(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin()) {
            return $this->errorResponse('Unauthorized to access Super Admin analytics.', 403);
        }

        $now = now();
        $today = $now->toDateString();
        $startOfMonth = $now->copy()->startOfMonth();

        // 1. Core Counts
        $totalRestaurants = Restaurant::count();
        $totalBranches = Branch::count();
        $totalUsers = User::count();
        $totalStaff = User::whereHas('roles', function ($q) {
            $q->whereIn('name', ['Restaurant Admin', 'Branch Manager', 'Cashier', 'Kitchen Staff']);
        })->count();
        $totalWaiters = User::whereHas('roles', function ($q) {
            $q->where('name', 'Waiter');
        })->count();

        // 2. Orders & Financial Aggregates
        $totalOrders = Order::count();
        $todayRevenue = (float) Order::whereDate('created_at', $today)
            ->where('payment_status', 'paid')
            ->sum('total_amount');

        $monthlyRevenue = (float) Order::where('created_at', '>=', $startOfMonth)
            ->where('payment_status', 'paid')
            ->sum('total_amount');

        $pendingPayments = (float) Order::where('payment_status', 'unpaid')
            ->where('order_status', '!=', 'cancelled')
            ->sum('total_amount');

        $activeTables = DiningTable::where('status', 'occupied')->count();
        $totalReservations = Reservation::count();
        $cancelledOrders = Order::where('order_status', 'cancelled')->count();

        // 3. 7-Day Revenue Trend
        $revenueTrends = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = $now->copy()->subDays($i)->toDateString();
            $label = $now->copy()->subDays($i)->format('D, M j');
            $dailyRevenue = (float) Order::whereDate('created_at', $date)
                ->where('payment_status', 'paid')
                ->sum('total_amount');
            $dailyOrders = Order::whereDate('created_at', $date)->count();

            $revenueTrends[] = [
                'date' => $date,
                'label' => $label,
                'revenue' => $dailyRevenue,
                'orders' => $dailyOrders,
            ];
        }

        // 4. Restaurant Performance Comparison
        $restaurantPerformance = Restaurant::withCount(['branches', 'orders'])
            ->with(['branches' => function ($q) {
                $q->withCount('diningTables');
            }])
            ->get()
            ->map(function ($rest) {
                $revenue = (float) Order::where('restaurant_id', $rest->id)
                    ->where('payment_status', 'paid')
                    ->sum('total_amount');

                $activeTablesCount = DiningTable::where('restaurant_id', $rest->id)
                    ->where('status', 'occupied')
                    ->count();

                return [
                    'id' => $rest->id,
                    'name' => $rest->name,
                    'slug' => $rest->slug,
                    'currency_symbol' => $rest->currency_symbol,
                    'is_active' => $rest->is_active,
                    'branches_count' => $rest->branches_count,
                    'orders_count' => $rest->orders_count,
                    'total_revenue' => $revenue,
                    'active_tables' => $activeTablesCount,
                ];
            });

        // 5. Recent Orders
        $recentOrders = Order::with(['restaurant:id,name,currency_symbol', 'branch:id,name', 'table:id,table_number', 'waiter:id,name'])
            ->latest()
            ->take(6)
            ->get()
            ->map(function ($ord) {
                return [
                    'id' => $ord->id,
                    'order_number' => $ord->order_number,
                    'restaurant_name' => $ord->restaurant?->name,
                    'branch_name' => $ord->branch?->name,
                    'table_number' => $ord->table?->table_number ?? 'Takeaway',
                    'waiter_name' => $ord->waiter?->name ?? 'Online/Self',
                    'order_type' => $ord->order_type,
                    'order_status' => $ord->order_status,
                    'payment_status' => $ord->payment_status,
                    'total_amount' => (float) $ord->total_amount,
                    'currency_symbol' => $ord->restaurant?->currency_symbol ?? '₹',
                    'created_at' => $ord->created_at->diffForHumans(),
                ];
            });

        // 6. Recent Platform Activities
        $recentActivities = AuditLog::with(['user:id,name', 'restaurant:id,name'])
            ->latest()
            ->take(6)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'user_name' => $log->user?->name ?? 'System',
                    'restaurant_name' => $log->restaurant?->name ?? 'Global',
                    'ip_address' => $log->ip_address,
                    'created_at' => $log->created_at->diffForHumans(),
                ];
            });

        return $this->successResponse([
            'overview' => [
                'total_restaurants' => $totalRestaurants,
                'total_branches' => $totalBranches,
                'total_users' => $totalUsers,
                'total_staff' => $totalStaff,
                'total_waiters' => $totalWaiters,
                'total_orders' => $totalOrders,
                'today_revenue' => $todayRevenue,
                'monthly_revenue' => $monthlyRevenue,
                'pending_payments' => $pendingPayments,
                'active_tables' => $activeTables,
                'total_reservations' => $totalReservations,
                'cancelled_orders' => $cancelledOrders,
            ],
            'revenue_trends' => $revenueTrends,
            'restaurant_performance' => $restaurantPerformance,
            'recent_orders' => $recentOrders,
            'recent_activities' => $recentActivities,
        ], 'Super Admin statistics retrieved successfully.');
    }

    /**
     * Get tenant-scoped dashboard analytics for Restaurant Admins, Branch Managers, and Cashiers.
     */
    public function tenantDashboardStats(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('dashboard.view')) {
            return $this->errorResponse('Unauthorized to view dashboard analytics.', 403);
        }

        $restaurantId = $request->header('X-Restaurant-ID')
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Restaurant::first()?->id;
        }

        if (!$restaurantId || !$user->hasRestaurantAccess((int) $restaurantId)) {
            return $this->errorResponse('Unauthorized or missing restaurant context.', 403);
        }

        $branchId = $request->header('X-Branch-ID') ?? $request->input('branch_id');
        if ($branchId && !$user->isSuperAdmin() && !$user->hasBranchAccess((int) $branchId)) {
            return $this->errorResponse('Unauthorized access to this branch.', 403);
        }

        $now = now();
        $today = $now->toDateString();
        $startOfMonth = $now->copy()->startOfMonth();

        $branchQuery = Branch::where('restaurant_id', $restaurantId);
        if ($branchId) {
            $branchQuery->where('id', $branchId);
        }

        $orderBase = Order::where('restaurant_id', $restaurantId);
        if ($branchId) {
            $orderBase->where('branch_id', $branchId);
        }

        $tableBase = DiningTable::where('restaurant_id', $restaurantId);
        if ($branchId) {
            $tableBase->where('branch_id', $branchId);
        }

        $reservationBase = Reservation::where('restaurant_id', $restaurantId);
        if ($branchId) {
            $reservationBase->where('branch_id', $branchId);
        }

        $usersQuery = User::whereHas('restaurants', fn($q) => $q->where('restaurants.id', $restaurantId));

        $totalBranches = (clone $branchQuery)->count();
        $totalUsers = (clone $usersQuery)->count();
        $totalStaff = (clone $usersQuery)->whereHas('roles', fn($q) => $q->whereIn('name', ['Restaurant Admin', 'Branch Manager', 'Cashier', 'Kitchen Staff']))->count();
        $totalWaiters = (clone $usersQuery)->whereHas('roles', fn($q) => $q->where('name', 'Waiter'))->count();

        $totalOrders = (clone $orderBase)->count();
        $todayRevenue = (float) (clone $orderBase)->whereDate('created_at', $today)->where('payment_status', 'paid')->sum('total_amount');
        $monthlyRevenue = (float) (clone $orderBase)->where('created_at', '>=', $startOfMonth)->where('payment_status', 'paid')->sum('total_amount');
        $pendingPayments = (float) (clone $orderBase)->where('payment_status', 'unpaid')->where('order_status', '!=', 'cancelled')->sum('total_amount');
        $activeTables = (clone $tableBase)->where('status', 'occupied')->count();
        $totalReservations = (clone $reservationBase)->count();
        $cancelledOrders = (clone $orderBase)->where('order_status', 'cancelled')->count();

        $revenueTrends = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = $now->copy()->subDays($i)->toDateString();
            $label = $now->copy()->subDays($i)->format('D, M j');
            $revenueTrends[] = [
                'date' => $date,
                'label' => $label,
                'revenue' => (float) (clone $orderBase)->whereDate('created_at', $date)->where('payment_status', 'paid')->sum('total_amount'),
                'orders' => (clone $orderBase)->whereDate('created_at', $date)->count(),
            ];
        }

        $restaurant = Restaurant::withCount(['branches', 'orders'])->find($restaurantId);
        $restaurantPerformance = $restaurant ? [[
            'id' => $restaurant->id,
            'name' => $restaurant->name,
            'slug' => $restaurant->slug,
            'currency_symbol' => $restaurant->currency_symbol,
            'is_active' => $restaurant->is_active,
            'branches_count' => $restaurant->branches_count,
            'orders_count' => $totalOrders,
            'total_revenue' => (float) (clone $orderBase)->where('payment_status', 'paid')->sum('total_amount'),
            'active_tables' => $activeTables,
        ]] : [];

        $recentOrders = (clone $orderBase)
            ->with(['restaurant:id,name,currency_symbol', 'branch:id,name', 'table:id,table_number', 'waiter:id,name'])
            ->latest()
            ->take(6)
            ->get()
            ->map(fn($ord) => [
                'id' => $ord->id,
                'order_number' => $ord->order_number,
                'restaurant_name' => $ord->restaurant?->name,
                'branch_name' => $ord->branch?->name,
                'table_number' => $ord->table?->table_number ?? 'Takeaway',
                'waiter_name' => $ord->waiter?->name ?? 'Online/Self',
                'order_type' => $ord->order_type,
                'order_status' => $ord->order_status,
                'payment_status' => $ord->payment_status,
                'total_amount' => (float) $ord->total_amount,
                'currency_symbol' => $ord->restaurant?->currency_symbol ?? '₹',
                'created_at' => $ord->created_at->diffForHumans(),
            ]);

        $recentActivities = AuditLog::where('restaurant_id', $restaurantId)
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->with(['user:id,name', 'restaurant:id,name'])
            ->latest()
            ->take(6)
            ->get()
            ->map(fn($log) => [
                'id' => $log->id,
                'action' => $log->action,
                'user_name' => $log->user?->name ?? 'System',
                'restaurant_name' => $log->restaurant?->name ?? 'Restaurant',
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at->diffForHumans(),
            ]);

        return $this->successResponse([
            'overview' => [
                'total_restaurants' => 1,
                'total_branches' => $totalBranches,
                'total_users' => $totalUsers,
                'total_staff' => $totalStaff,
                'total_waiters' => $totalWaiters,
                'total_orders' => $totalOrders,
                'today_revenue' => $todayRevenue,
                'monthly_revenue' => $monthlyRevenue,
                'pending_payments' => $pendingPayments,
                'active_tables' => $activeTables,
                'total_reservations' => $totalReservations,
                'cancelled_orders' => $cancelledOrders,
            ],
            'revenue_trends' => $revenueTrends,
            'restaurant_performance' => $restaurantPerformance,
            'recent_orders' => $recentOrders,
            'recent_activities' => $recentActivities,
        ], 'Dashboard statistics retrieved successfully.');
    }
}
