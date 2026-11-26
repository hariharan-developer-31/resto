<?php

use App\Http\Controllers\Api\V1\AddonController;
use App\Http\Controllers\Api\V1\AnalyticsController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BranchController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\InventoryController;
use App\Http\Controllers\Api\V1\KdsController;
use App\Http\Controllers\Api\V1\MenuItemController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\PublicGuestController;
use App\Http\Controllers\Api\V1\PurchaseOrderController;
use App\Http\Controllers\Api\V1\RecipeController;
use App\Http\Controllers\Api\V1\ReservationController;
use App\Http\Controllers\Api\V1\RestaurantController;
use App\Http\Controllers\Api\V1\RolePermissionController;
use App\Http\Controllers\Api\V1\SubscriptionController;
use App\Http\Controllers\Api\V1\SuperAdminController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\SystemController;
use App\Http\Controllers\Api\V1\TableController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - Restaurant OS V1
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {
    // Public System & Health Routes
    Route::get('/health', [SystemController::class, 'health']);
    Route::get('/bootstrap', [SystemController::class, 'bootstrap']);

    // Public Customer & Contactless QR Routes
    Route::prefix('public')->group(function () {
        Route::get('/restaurants/{slug}', [PublicGuestController::class, 'restaurantDetails']);
        Route::get('/table/{qrToken}', [PublicGuestController::class, 'resolveTable']);
        Route::get('/orders/{orderNumber}/track', [PublicGuestController::class, 'trackOrder']);

        Route::middleware(['throttle:30,1'])->group(function () {
            Route::post('/table/{qrToken}/order', [PublicGuestController::class, 'placeTableOrder']);
            Route::post('/table/{qrToken}/service-request', [PublicGuestController::class, 'serviceRequest']);
            Route::post('/reservations', [PublicGuestController::class, 'createReservation']);
        });
    });

    // Authentication Routes (Rate limited)
    Route::prefix('auth')->group(function () {
        Route::middleware(['throttle:10,1'])->group(function () {
            Route::post('/login', [AuthController::class, 'login']);
            Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
            Route::post('/reset-password', [AuthController::class, 'resetPassword']);
        });

        // Authenticated Auth Endpoints
        Route::middleware(['auth:sanctum', 'active'])->group(function () {
            Route::get('/me', [AuthController::class, 'me']);
            Route::post('/logout', [AuthController::class, 'logout']);
            Route::post('/change-password', [AuthController::class, 'changePassword']);
        });
    });

    // Protected Authenticated System Routes
    Route::middleware(['auth:sanctum', 'active', 'tenant'])->group(function () {
        // Super Admin Global Analytics & Tenant Scoped Dashboard
        Route::get('/super-admin/dashboard', [SuperAdminController::class, 'dashboardStats']);
        Route::get('/dashboard', [SuperAdminController::class, 'tenantDashboardStats']);

        // Restaurant Management
        Route::apiResource('restaurants', RestaurantController::class);
        Route::post('/restaurants/{id}/toggle-status', [RestaurantController::class, 'toggleStatus']);

        // Branch Management
        Route::prefix('restaurants/{restaurant}')->group(function () {
            Route::get('/branches', [BranchController::class, 'index']);
            Route::post('/branches', [BranchController::class, 'store']);
            Route::get('/branches/{branch}', [BranchController::class, 'show']);
            Route::put('/branches/{branch}', [BranchController::class, 'update']);
            Route::delete('/branches/{branch}', [BranchController::class, 'destroy']);
            Route::post('/branches/{branch}/toggle-status', [BranchController::class, 'toggleStatus']);
        });

        // User Management
        Route::apiResource('users', UserController::class);
        Route::post('/users/{id}/toggle-status', [UserController::class, 'toggleStatus']);
        Route::post('/users/{id}/reset-password', [UserController::class, 'resetPassword']);

        // Roles & Permissions Matrix
        Route::get('/roles', [RolePermissionController::class, 'index']);
        Route::post('/roles', [RolePermissionController::class, 'store']);
        Route::put('/roles/{id}', [RolePermissionController::class, 'update']);
        Route::delete('/roles/{id}', [RolePermissionController::class, 'destroy']);

        // Menu Categories
        Route::apiResource('categories', CategoryController::class);

        // Menu Items Catalog
        Route::apiResource('menu-items', MenuItemController::class);
        Route::post('/menu-items/{id}/toggle-availability', [MenuItemController::class, 'toggleAvailability']);

        // Addons
        Route::apiResource('addons', AddonController::class)->except(['show']);

        // Table Management & QR System
        Route::apiResource('tables', TableController::class);
        Route::post('/tables/{id}/qr', [TableController::class, 'generateQr']);
        Route::post('/tables/{id}/generate-qr', [TableController::class, 'generateQr']);
        Route::post('/tables/{id}/assign-waiter', [TableController::class, 'assignWaiter']);
        Route::patch('/tables/{id}/waiter', [TableController::class, 'assignWaiter']);
        Route::post('/tables/{id}/status', [TableController::class, 'updateStatus']);
        Route::patch('/tables/{id}/status', [TableController::class, 'updateStatus']);

        // Orders, POS & KOT Operations
        Route::apiResource('orders', OrderController::class);
        Route::patch('/order-items/{id}/status', [OrderController::class, 'updateItemStatus']);
        Route::post('/orders/{id}/settle', [OrderController::class, 'settleBill']);
        Route::post('/orders/{id}/cancel', [OrderController::class, 'cancel']);

        // Kitchen Display System (KDS)
        Route::get('/kds/tickets', [KdsController::class, 'tickets']);
        Route::get('/kds/summary', [KdsController::class, 'summary']);
        Route::patch('/kds/items/{id}/status', [KdsController::class, 'updateItemStatus']);
        Route::post('/kds/tickets/{kot}/ready', [KdsController::class, 'markTicketReady']);

        // Table Reservations Management
        Route::apiResource('reservations', ReservationController::class);
        Route::patch('/reservations/{id}/status', [ReservationController::class, 'updateStatus']);
        Route::post('/reservations/{id}/assign-table', [ReservationController::class, 'assignTable']);

        // Inventory, Stock & Suppliers
        Route::apiResource('suppliers', SupplierController::class);
        Route::get('/inventory/alerts', [InventoryController::class, 'alerts']);
        Route::post('/inventory/adjust', [InventoryController::class, 'adjustStock']);
        Route::apiResource('inventory', InventoryController::class);

        // Recipe / Bill of Materials (BOM)
        Route::get('/menu-items/{id}/recipe', [RecipeController::class, 'getRecipe']);
        Route::post('/menu-items/{id}/recipe', [RecipeController::class, 'saveRecipe']);

        // Purchase Orders
        Route::apiResource('purchase-orders', PurchaseOrderController::class)->except(['destroy']);
        Route::post('/purchase-orders/{id}/receive', [PurchaseOrderController::class, 'receive']);

        // Business Analytics & Executive Reports (Phase 8)
        Route::get('/analytics/overview', [AnalyticsController::class, 'overview']);
        Route::get('/analytics/menu-engineering', [AnalyticsController::class, 'menuEngineering']);
        Route::get('/analytics/table-efficiency', [AnalyticsController::class, 'tableEfficiency']);
        Route::get('/reports/eod', [AnalyticsController::class, 'eodReport']);
        Route::get('/reports/tax', [AnalyticsController::class, 'taxReport']);

        // Multi-Restaurant SaaS Subscription & Quotas (Phase 8)
        Route::get('/subscription/plans', [SubscriptionController::class, 'plans']);
        Route::get('/subscription/current', [SubscriptionController::class, 'current']);
        Route::post('/subscription/upgrade', [SubscriptionController::class, 'upgrade']);
        Route::post('/super-admin/plans', [SubscriptionController::class, 'storePlan']);

        // Audit Logs Explorer
        Route::get('/audit-logs', [SystemController::class, 'auditLogs']);

        // Tenant Scoped Verification Route
        Route::middleware('tenant')->group(function () {
            Route::get('/tenant/verify', function (Request $request) {
                return response()->json([
                    'success' => true,
                    'message' => 'Tenant isolation check passed.',
                    'current_restaurant' => $request->attributes->get('current_restaurant'),
                    'current_branch' => $request->attributes->get('current_branch'),
                ]);
            });
        });
    });
});
