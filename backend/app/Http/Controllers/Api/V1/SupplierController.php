<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Supplier;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    use ApiResponse;

    /**
     * Display a listing of suppliers for the active restaurant.
     */
    public function index(Request $request): JsonResponse
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

        $query = Supplier::where('restaurant_id', $restaurantId)
            ->withCount(['inventoryItems', 'purchaseOrders']);

        if ($status = $request->input('status')) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('contact_person', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $suppliers = $query->orderBy('name', 'asc')->get();

        return $this->successResponse($suppliers, 'Suppliers retrieved successfully.');
    }

    /**
     * Create a new supplier.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $restaurantId = $request->header('X-Restaurant-ID')
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Branch::first()?->restaurant_id;
        }

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'contact_person' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:100',
            'address' => 'nullable|string|max:500',
            'tax_number' => 'nullable|string|max:50',
            'payment_terms' => 'nullable|string|max:50',
            'status' => 'nullable|in:active,inactive',
        ]);

        $validated['restaurant_id'] = $restaurantId;
        $validated['status'] = $validated['status'] ?? 'active';

        $supplier = Supplier::create($validated);

        AuditLog::log('supplier.created', $supplier, null, ['name' => $supplier->name], $user);

        return $this->successResponse($supplier, 'Supplier registered successfully.', 201);
    }

    /**
     * Display a specific supplier.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $supplier = Supplier::with(['inventoryItems', 'purchaseOrders'])->findOrFail($id);
        if (!$request->user()->hasRestaurantAccess($supplier->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this supplier.', 403);
        }
        return $this->successResponse($supplier, 'Supplier details retrieved.');
    }

    /**
     * Update supplier attributes.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $supplier = Supplier::findOrFail($id);
        if (!$user->hasRestaurantAccess($supplier->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this supplier.', 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:150',
            'contact_person' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:100',
            'address' => 'nullable|string|max:500',
            'tax_number' => 'nullable|string|max:50',
            'payment_terms' => 'nullable|string|max:50',
            'status' => 'nullable|in:active,inactive',
        ]);

        $old = $supplier->toArray();
        $supplier->update($validated);

        AuditLog::log('supplier.updated', $supplier, $old, $supplier->getChanges(), $user);

        return $this->successResponse($supplier, 'Supplier updated successfully.');
    }

    /**
     * Delete supplier.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $supplier = Supplier::findOrFail($id);
        if (!$user->hasRestaurantAccess($supplier->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this supplier.', 403);
        }

        AuditLog::log('supplier.deleted', $supplier, $supplier->toArray(), null, $user);
        $supplier->delete();

        return $this->successResponse(null, 'Supplier deleted successfully.');
    }
}
