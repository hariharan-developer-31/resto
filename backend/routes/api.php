<?php

use App\Http\Controllers\Api\V1\AddonController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BranchController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\MenuItemController;
use App\Http\Controllers\Api\V1\RestaurantController;
use App\Http\Controllers\Api\V1\RolePermissionController;
use App\Http\Controllers\Api\V1\SuperAdminController;
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

    // Authentication Routes (Rate limited)
    Route::prefix('auth')->middleware(['throttle:60,1'])->group(function () {
        Route::post('/login', [AuthController::class, 'login']);
        Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
        Route::post('/reset-password', [AuthController::class, 'resetPassword']);

        // Authenticated Auth Endpoints
        Route::middleware('auth:sanctum')->group(function () {
            Route::get('/me', [AuthController::class, 'me']);
            Route::post('/logout', [AuthController::class, 'logout']);
            Route::post('/change-password', [AuthController::class, 'changePassword']);
        });
    });

    // Protected Authenticated System Routes
    Route::middleware('auth:sanctum')->group(function () {
        // Super Admin Global Analytics
        Route::get('/super-admin/dashboard', [SuperAdminController::class, 'dashboardStats']);

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
