<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Restaurant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SystemController extends Controller
{
    use ApiResponse;

    /**
     * System Health Check.
     */
    public function health(): JsonResponse
    {
        $dbConnected = false;
        try {
            DB::connection()->getPdo();
            $dbConnected = true;
        } catch (\Throwable $e) {
            $dbConnected = false;
        }

        return $this->successResponse([
            'status' => $dbConnected ? 'healthy' : 'degraded',
            'version' => '1.0.0-phase1',
            'environment' => config('app.env'),
            'database' => $dbConnected ? 'connected' : 'disconnected',
            'timestamp' => now()->toIso8601String(),
        ], 'System health status');
    }

    /**
     * Public Bootstrap Meta.
     */
    public function bootstrap(): JsonResponse
    {
        $restaurants = Restaurant::where('is_active', true)
            ->with(['branches' => fn($q) => $q->where('is_active', true)])
            ->get(['id', 'name', 'slug', 'currency', 'currency_symbol', 'primary_color']);

        return $this->successResponse([
            'platform_name' => 'Restaurant OS',
            'design_system' => [
                'theme' => 'light',
                'primary' => '#C76B4A',
                'secondary' => '#66745B',
                'background' => '#FAF8F4',
                'font_primary' => 'DM Sans',
                'font_secondary' => 'DM Serif Display',
            ],
            'restaurants' => $restaurants,
        ], 'Bootstrap metadata loaded');
    }

    /**
     * Audit Logs Explorer.
     */
    public function auditLogs(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('settings.view')) {
            return $this->errorResponse('Unauthorized to view audit logs.', 403);
        }

        $query = AuditLog::with(['user:id,name,email', 'restaurant:id,name', 'branch:id,name'])
            ->latest();

        if ($request->has('action')) {
            $query->where('action', 'like', '%' . $request->input('action') . '%');
        }

        if ($request->has('restaurant_id')) {
            $query->where('restaurant_id', $request->input('restaurant_id'));
        }

        $logs = $query->paginate($request->input('per_page', 25));

        return $this->successResponse($logs, 'Audit logs retrieved');
    }
}
