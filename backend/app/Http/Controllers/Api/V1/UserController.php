<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    use ApiResponse;

    /**
     * Display a listing of users.
     */
    public function index(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser->isSuperAdmin() && !$currentUser->can('users.view')) {
            return $this->errorResponse('Unauthorized to view users.', 403);
        }

        $query = User::with(['roles', 'restaurants:id,name', 'branches:id,restaurant_id,name'])
            ->latest();

        // Scope to tenant restaurants if not super admin
        if (!$currentUser->isSuperAdmin()) {
            $userRestaurantIds = $currentUser->restaurants()->pluck('restaurants.id');
            $query->whereHas('restaurants', function ($q) use ($userRestaurantIds) {
                $q->whereIn('restaurants.id', $userRestaurantIds);
            });
        }

        // Filter by role
        if ($role = $request->input('role')) {
            $query->whereHas('roles', function ($q) use ($role) {
                $q->where('name', $role);
            });
        }

        // Filter by restaurant
        if ($restaurantId = $request->input('restaurant_id')) {
            $query->whereHas('restaurants', function ($q) use ($restaurantId) {
                $q->where('restaurants.id', $restaurantId);
            });
        }

        // Search
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('username', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $users = $query->paginate($request->input('per_page', 15));

        return $this->successResponse($users, 'Users retrieved successfully.');
    }

    /**
     * Store a newly created user.
     */
    public function store(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser->isSuperAdmin() && !$currentUser->can('users.create')) {
            return $this->errorResponse('Unauthorized to create users.', 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'username' => 'nullable|string|max:100|unique:users,username',
            'phone' => 'nullable|string|max:30',
            'password' => 'required|string|min:8',
            'role' => 'required|string|exists:roles,name',
            'restaurant_ids' => 'nullable|array',
            'restaurant_ids.*' => 'exists:restaurants,id',
            'branch_ids' => 'nullable|array',
            'branch_ids.*' => 'exists:branches,id',
            'permissions' => 'nullable|array',
            'is_active' => 'nullable|boolean',
        ]);

        // Security: Only Super Admin can assign Super Admin role
        if ($validated['role'] === 'Super Admin' && !$currentUser->isSuperAdmin()) {
            return $this->errorResponse('Only a Super Admin can grant Super Admin privileges.', 403);
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'username' => $validated['username'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'password' => Hash::make($validated['password']),
            'is_active' => $validated['is_active'] ?? true,
            'email_verified_at' => now(),
        ]);

        $user->assignRole($validated['role']);

        if (!empty($validated['restaurant_ids'])) {
            $user->restaurants()->sync($validated['restaurant_ids']);
        }

        if (!empty($validated['branch_ids'])) {
            $user->branches()->sync($validated['branch_ids']);
        }

        if (!empty($validated['permissions'])) {
            $user->syncPermissions($validated['permissions']);
        }

        AuditLog::log(
            action: 'user.created',
            auditable: $user,
            newValues: [
                'name' => $user->name,
                'email' => $user->email,
                'role' => $validated['role'],
            ],
            userId: $currentUser->id
        );

        return $this->successResponse(
            $user->load(['roles', 'restaurants:id,name', 'branches:id,name']),
            'User created successfully.',
            201
        );
    }

    /**
     * Display the specified user.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser->isSuperAdmin() && !$currentUser->can('users.view') && $currentUser->id !== $id) {
            return $this->errorResponse('Unauthorized access.', 403);
        }

        $user = User::with([
            'roles.permissions',
            'permissions',
            'restaurants:id,name,slug,currency_symbol',
            'branches:id,restaurant_id,name,code',
        ])->find($id);

        if (!$user) {
            return $this->errorResponse('User not found.', 404);
        }

        return $this->successResponse($user, 'User details retrieved.');
    }

    /**
     * Update the specified user.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser->isSuperAdmin() && !$currentUser->can('users.edit') && $currentUser->id !== $id) {
            return $this->errorResponse('Unauthorized to update this user.', 403);
        }

        $user = User::find($id);
        if (!$user) {
            return $this->errorResponse('User not found.', 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|email|max:255|unique:users,email,' . $id,
            'username' => 'nullable|string|max:100|unique:users,username,' . $id,
            'phone' => 'nullable|string|max:30',
            'password' => 'nullable|string|min:8',
            'role' => 'nullable|string|exists:roles,name',
            'restaurant_ids' => 'nullable|array',
            'restaurant_ids.*' => 'exists:restaurants,id',
            'branch_ids' => 'nullable|array',
            'branch_ids.*' => 'exists:branches,id',
            'permissions' => 'nullable|array',
            'is_active' => 'nullable|boolean',
        ]);

        $oldValues = $user->toArray();

        $updateData = [
            'name' => $validated['name'] ?? $user->name,
            'email' => $validated['email'] ?? $user->email,
            'username' => $validated['username'] ?? $user->username,
            'phone' => $validated['phone'] ?? $user->phone,
        ];

        if (!empty($validated['password'])) {
            $updateData['password'] = Hash::make($validated['password']);
        }

        if (isset($validated['is_active'])) {
            $updateData['is_active'] = $validated['is_active'];
        }

        $user->update($updateData);

        // Update role if permitted
        if (!empty($validated['role']) && ($currentUser->isSuperAdmin() || $currentUser->can('roles.manage'))) {
            $user->syncRoles([$validated['role']]);
        }

        if (isset($validated['restaurant_ids'])) {
            $user->restaurants()->sync($validated['restaurant_ids']);
        }

        if (isset($validated['branch_ids'])) {
            $user->branches()->sync($validated['branch_ids']);
        }

        if (isset($validated['permissions'])) {
            $user->syncPermissions($validated['permissions']);
        }

        AuditLog::log(
            action: 'user.updated',
            auditable: $user,
            oldValues: $oldValues,
            newValues: $user->fresh()->toArray(),
            userId: $currentUser->id
        );

        return $this->successResponse(
            $user->fresh(['roles', 'restaurants:id,name', 'branches:id,name']),
            'User updated successfully.'
        );
    }

    /**
     * Remove the specified user (Safeguards against self-deletion).
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser->isSuperAdmin() && !$currentUser->can('users.delete')) {
            return $this->errorResponse('Unauthorized to delete users.', 403);
        }

        if ($currentUser->id === $id) {
            return $this->errorResponse('You cannot delete your own account.', 422);
        }

        $user = User::find($id);
        if (!$user) {
            return $this->errorResponse('User not found.', 404);
        }

        $user->delete();

        AuditLog::log(
            action: 'user.deleted',
            auditable: $user,
            userId: $currentUser->id
        );

        return $this->successResponse(null, 'User deleted successfully.');
    }

    /**
     * Toggle active/inactive status.
     */
    public function toggleStatus(Request $request, int $id): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser->isSuperAdmin() && !$currentUser->can('users.edit')) {
            return $this->errorResponse('Unauthorized.', 403);
        }

        if ($currentUser->id === $id) {
            return $this->errorResponse('You cannot deactivate your own account.', 422);
        }

        $user = User::find($id);
        if (!$user) {
            return $this->errorResponse('User not found.', 404);
        }

        $user->update(['is_active' => !$user->is_active]);

        AuditLog::log(
            action: $user->is_active ? 'user.activated' : 'user.deactivated',
            auditable: $user,
            userId: $currentUser->id
        );

        return $this->successResponse($user, 'User status updated.');
    }

    /**
     * Admin direct password reset.
     */
    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser->isSuperAdmin() && !$currentUser->can('users.edit')) {
            return $this->errorResponse('Unauthorized to reset user passwords.', 403);
        }

        $request->validate([
            'new_password' => 'required|string|min:8',
        ]);

        $user = User::find($id);
        if (!$user) {
            return $this->errorResponse('User not found.', 404);
        }

        $user->update([
            'password' => Hash::make($request->input('new_password')),
        ]);

        AuditLog::log(
            action: 'user.password_reset_by_admin',
            auditable: $user,
            userId: $currentUser->id
        );

        return $this->successResponse(null, 'User password reset successfully.');
    }
}
