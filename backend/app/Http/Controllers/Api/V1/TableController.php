<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\DiningTable;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TableController extends Controller
{
    use ApiResponse;

    /**
     * Display a listing of tables for a branch.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $branchId = $request->header('X-Branch-ID') 
            ?? $request->input('branch_id')
            ?? $user->branches()->first()?->id;

        if (!$branchId && $user->isSuperAdmin()) {
            $branchId = Branch::first()?->id;
        }

        if (!$branchId) {
            return $this->errorResponse('Please specify an active branch context.', 400);
        }

        $branch = Branch::with('restaurant')->find($branchId);
        if (!$branch) {
            return $this->errorResponse('Branch not found.', 404);
        }

        $query = DiningTable::where('branch_id', $branchId)
            ->with(['waiter:id,name,username', 'branch:id,name', 'restaurant:id,name,slug']);

        // Status filter
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        // Location filter
        if ($location = $request->input('location')) {
            $query->where('location', $location);
        }

        // Waiter filter
        if ($waiterId = $request->input('waiter_id')) {
            $query->where('waiter_id', $waiterId);
        }

        $frontendUrl = rtrim((string) config('app.frontend_url', 'http://localhost:3000'), '/');

        $tables = $query->get()
            ->sortBy('table_number', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->map(function ($table) use ($frontendUrl) {
                return [
                    'id' => $table->id,
                    'restaurant_id' => $table->restaurant_id,
                    'branch_id' => $table->branch_id,
                    'table_number' => $table->table_number,
                    'seating_capacity' => $table->seating_capacity,
                    'location' => $table->location,
                    'status' => $table->status,
                    'waiter_id' => $table->waiter_id,
                    'waiter' => $table->waiter,
                    'qr_token' => $table->qr_token,
                    'qr_generated_at' => $table->qr_generated_at?->toIso8601String(),
                    'qr_ordering_url' => $table->qr_token
                        ? "{$frontendUrl}/order/{$table->qr_token}"
                        : null,
                ];
            });

        // Unique locations for filtering tabs
        $locations = DiningTable::where('branch_id', $branchId)
            ->distinct()
            ->pluck('location')
            ->filter()
            ->values();

        return $this->successResponse([
            'tables' => $tables,
            'branch' => [
                'id' => $branch->id,
                'name' => $branch->name,
                'restaurant_name' => $branch->restaurant?->name,
                'restaurant_slug' => $branch->restaurant?->slug,
            ],
            'locations' => $locations,
        ], 'Dining tables retrieved successfully.');
    }

    /**
     * Store a newly created dining table.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('tables.manage')) {
            return $this->errorResponse('Unauthorized to create dining tables.', 403);
        }

        $branchId = $request->header('X-Branch-ID') 
            ?? $request->input('branch_id')
            ?? $user->branches()->first()?->id;

        if (!$branchId && $user->isSuperAdmin()) {
            $branchId = Branch::first()?->id;
        }

        $branch = Branch::find($branchId);
        if (!$branch) {
            return $this->errorResponse('Branch not found.', 404);
        }

        $validated = $request->validate([
            'table_number' => 'required|string|max:50',
            'seating_capacity' => 'nullable|integer|min:1|max:50',
            'location' => 'nullable|string|max:64',
            'waiter_id' => 'nullable|exists:users,id',
            'status' => 'nullable|in:available,occupied,reserved,billing,cleaning,out_of_service',
        ]);

        // Check uniqueness in this branch
        $exists = DiningTable::where('branch_id', $branchId)
            ->where('table_number', $validated['table_number'])
            ->exists();

        if ($exists) {
            return $this->errorResponse("Table [{$validated['table_number']}] already exists in this branch.", 422);
        }

        // Generate unpredictable, secure random token (32 chars)
        $token = 'tbl_' . Str::random(32);

        $table = DiningTable::create([
            'restaurant_id' => $branch->restaurant_id,
            'branch_id' => $branchId,
            'waiter_id' => $validated['waiter_id'] ?? null,
            'table_number' => $validated['table_number'],
            'seating_capacity' => $validated['seating_capacity'] ?? 4,
            'location' => $validated['location'] ?? 'Indoor',
            'status' => $validated['status'] ?? 'available',
            'qr_token' => $token,
            'qr_generated_at' => now(),
        ]);

        AuditLog::log(
            action: 'table.created',
            auditable: $table,
            newValues: $table->toArray(),
            restaurantId: $branch->restaurant_id,
            branchId: $branchId,
            userId: $user->id
        );

        return $this->successResponse($table->load('waiter:id,name'), 'Dining table created successfully.', 201);
    }

    /**
     * Display the specified table.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $table = DiningTable::with(['waiter:id,name,phone', 'branch', 'restaurant'])->find($id);
        if (!$table) {
            return $this->errorResponse('Table not found.', 404);
        }

        if (!$request->user()->hasRestaurantAccess($table->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this table.', 403);
        }

        $frontendUrl = rtrim((string) config('app.frontend_url', 'http://localhost:3000'), '/');
        $data = $table->toArray();
        $data['qr_ordering_url'] = $table->qr_token ? "{$frontendUrl}/order/{$table->qr_token}" : null;

        return $this->successResponse($data, 'Table details retrieved.');
    }

    /**
     * Update the specified table.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('tables.manage')) {
            return $this->errorResponse('Unauthorized to update dining tables.', 403);
        }

        $table = DiningTable::find($id);
        if (!$table) {
            return $this->errorResponse('Table not found.', 404);
        }

        if (!$user->hasRestaurantAccess($table->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this table.', 403);
        }

        $validated = $request->validate([
            'table_number' => 'sometimes|required|string|max:50',
            'seating_capacity' => 'nullable|integer|min:1|max:50',
            'location' => 'nullable|string|max:64',
            'waiter_id' => 'nullable|exists:users,id',
            'status' => 'nullable|in:available,occupied,reserved,billing,cleaning,out_of_service',
        ]);

        if (isset($validated['table_number'])) {
            $exists = DiningTable::where('branch_id', $table->branch_id)
                ->where('table_number', $validated['table_number'])
                ->where('id', '!=', $id)
                ->exists();

            if ($exists) {
                return $this->errorResponse("Table [{$validated['table_number']}] already exists in this branch.", 422);
            }
        }

        $oldValues = $table->toArray();
        $table->update($validated);

        AuditLog::log(
            action: 'table.updated',
            auditable: $table,
            oldValues: $oldValues,
            newValues: $table->toArray(),
            restaurantId: $table->restaurant_id,
            branchId: $table->branch_id,
            userId: $user->id
        );

        return $this->successResponse($table->fresh(['waiter:id,name']), 'Table updated successfully.');
    }

    /**
     * Remove the specified table (with safeguards).
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('tables.manage')) {
            return $this->errorResponse('Unauthorized to delete dining tables.', 403);
        }

        $table = DiningTable::find($id);
        if (!$table) {
            return $this->errorResponse('Table not found.', 404);
        }

        if (!$user->hasRestaurantAccess($table->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this table.', 403);
        }

        if (in_array($table->status, ['occupied', 'billing'])) {
            return $this->errorResponse("Cannot delete Table [{$table->table_number}] while it is currently occupied or billing.", 422);
        }

        $table->delete();

        AuditLog::log(
            action: 'table.deleted',
            auditable: $table,
            restaurantId: $table->restaurant_id,
            branchId: $table->branch_id,
            userId: $user->id
        );

        return $this->successResponse(null, 'Table deleted successfully.');
    }

    /**
     * Regenerate unique, unpredictable QR token.
     */
    public function generateQr(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('tables.qr.generate')) {
            return $this->errorResponse('Unauthorized to generate table QR tokens.', 403);
        }

        $table = DiningTable::find($id);
        if (!$table) {
            return $this->errorResponse('Table not found.', 404);
        }

        if (!$user->hasRestaurantAccess($table->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this table.', 403);
        }

        $newToken = $table->generateQrToken();

        AuditLog::log(
            action: 'table.qr_regenerated',
            auditable: $table,
            restaurantId: $table->restaurant_id,
            branchId: $table->branch_id,
            userId: $user->id
        );

        $frontendUrl = rtrim((string) config('app.frontend_url', 'http://localhost:3000'), '/');

        return $this->successResponse([
            'table_id' => $table->id,
            'table_number' => $table->table_number,
            'qr_token' => $newToken,
            'qr_generated_at' => $table->qr_generated_at->toIso8601String(),
            'qr_ordering_url' => "{$frontendUrl}/order/{$newToken}",
        ], 'QR token regenerated successfully. Previous token has been revoked.');
    }

    /**
     * Quick assign waiter.
     */
    public function assignWaiter(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('tables.manage')) {
            return $this->errorResponse('Unauthorized.', 403);
        }

        $request->validate([
            'waiter_id' => 'nullable|exists:users,id',
        ]);

        $table = DiningTable::find($id);
        if (!$table) {
            return $this->errorResponse('Table not found.', 404);
        }

        if (!$user->hasRestaurantAccess($table->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this table.', 403);
        }

        $table->update(['waiter_id' => $request->input('waiter_id')]);

        return $this->successResponse($table->fresh(['waiter:id,name']), 'Waiter assigned successfully.');
    }

    /**
     * Quick update table status.
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('tables.manage') && !$user->can('orders.edit')) {
            return $this->errorResponse('Unauthorized to update table status.', 403);
        }

        $request->validate([
            'status' => 'required|in:available,occupied,reserved,billing,cleaning,out_of_service',
        ]);

        $table = DiningTable::find($id);
        if (!$table) {
            return $this->errorResponse('Table not found.', 404);
        }

        if (!$user->hasRestaurantAccess($table->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this table.', 403);
        }

        $table->update(['status' => $request->input('status')]);

        return $this->successResponse($table, 'Table status updated.');
    }
}
