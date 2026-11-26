<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    use ApiResponse;

    /**
     * Check whether the acting user is allowed to view/manage the target user.
     */
    private function canManageTargetUser(User $actor, User $target): bool
    {
        if ($actor->isSuperAdmin()) {
            return true;
        }

        if ($target->isSuperAdmin()) {
            return false;
        }

        $actorRestaurantIds = $actor->restaurants()->pluck('restaurants.id');
        if ($actorRestaurantIds->isEmpty()) {
            return false;
        }

        return $target->restaurants()->whereIn('restaurants.id', $actorRestaurantIds)->exists();
    }

    /**
     * Validate that non-super-admins only assign restaurants and branches they own.
     */
    private function validateTenantAssignments(User $actor, array $restaurantIds, array $branchIds): ?string
    {
        if (!$actor->isSuperAdmin()) {
            $allowedRestaurants = $actor->restaurants()->pluck('restaurants.id')->all();
            foreach ($restaurantIds as $rid) {
                if (!in_array((int) $rid, $allowedRestaurants, true)) {
                    return 'You cannot assign a user to a restaurant you do not have access to.';
                }
            }

            $allowedBranches = $actor->branches()->pluck('branches.id')->all();
            foreach ($branchIds as $bid) {
                $branch = Branch::find($bid);
                if (!$branch) {
                    return 'One or more selected branches do not exist.';
                }
                if (!in_array((int) $branch->restaurant_id, $allowedRestaurants, true) && !in_array((int) $bid, $allowedBranches, true)) {
                    return 'You cannot assign a user to a branch you do not have access to.';
                }
            }
        }

        if (!empty($restaurantIds) && !empty($branchIds)) {
            $invalidBranch = Branch::whereIn('id', $branchIds)
                ->whereNotIn('restaurant_id', $restaurantIds)
                ->exists();
            if ($invalidBranch) {
                return 'One or more selected branches do not belong to the selected restaurants.';
            }
        }

        return null;
    }

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

        $perPage = min(max((int) $request->input('per_page', 15), 1), 100);
        $users = $query->paginate($perPage);

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
            'permissions.*' => 'string|exists:permissions,name',
            'is_active' => 'nullable|boolean',
        ]);

        // Security: Only Super Admin can assign Super Admin role
        if ($validated['role'] === 'Super Admin' && !$currentUser->isSuperAdmin()) {
            return $this->errorResponse('Only a Super Admin can grant Super Admin privileges.', 403);
        }

        $restaurantIds = $validated['restaurant_ids'] ?? [];
        $branchIds = $validated['branch_ids'] ?? [];

        if ($error = $this->validateTenantAssignments($currentUser, $restaurantIds, $branchIds)) {
            return $this->errorResponse($error, 403);
        }

        if (!$currentUser->isSuperAdmin() && empty($restaurantIds)) {
            $defaultRestaurantId = $currentUser->restaurants()->first()?->id;
            if ($defaultRestaurantId) {
                $restaurantIds = [$defaultRestaurantId];
            }
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

        if (!empty($restaurantIds)) {
            $user->restaurants()->sync($restaurantIds);
        }

        if (!empty($branchIds)) {
            $user->branches()->sync($branchIds);
        }

        if (!empty($validated['permissions']) && ($currentUser->isSuperAdmin() || $currentUser->can('roles.manage'))) {
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
        $isSelf = $currentUser->id === $id;

        if (!$isSelf && !$currentUser->isSuperAdmin() && !$currentUser->can('users.view')) {
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

        if (!$isSelf && !$this->canManageTargetUser($currentUser, $user)) {
            return $this->errorResponse('Unauthorized access to this user.', 403);
        }

        return $this->successResponse($user, 'User details retrieved.');
    }

    /**
     * Update the specified user.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $currentUser = $request->user();
        $isSelf = $currentUser->id === $id;
        $hasAdminEdit = $currentUser->isSuperAdmin() || $currentUser->can('users.edit');

        if (!$isSelf && !$hasAdminEdit) {
            return $this->errorResponse('Unauthorized to update this user.', 403);
        }

        $user = User::find($id);
        if (!$user) {
            return $this->errorResponse('User not found.', 404);
        }

        if (!$isSelf && !$this->canManageTargetUser($currentUser, $user)) {
            return $this->errorResponse('Unauthorized to update this user.', 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|email|max:255|unique:users,email,' . $id,
            'username' => 'nullable|string|max:100|unique:users,username,' . $id,
            'phone' => 'nullable|string|max:30',
            'avatar' => 'nullable|string|max:500',
            'password' => 'nullable|string|min:8',
            'role' => 'nullable|string|exists:roles,name',
            'restaurant_ids' => 'nullable|array',
            'restaurant_ids.*' => 'exists:restaurants,id',
            'branch_ids' => 'nullable|array',
            'branch_ids.*' => 'exists:branches,id',
            'permissions' => 'nullable|array',
            'permissions.*' => 'string|exists:permissions,name',
            'is_active' => 'nullable|boolean',
        ]);

        // Self-update without admin privileges: allow profile fields only
        if ($isSelf && !$hasAdminEdit) {
            $forbiddenKeys = array_intersect(
                array_keys($validated),
                ['role', 'permissions', 'restaurant_ids', 'branch_ids', 'is_active']
            );
            if (!empty($forbiddenKeys)) {
                return $this->errorResponse('You are not authorized to modify roles, permissions, tenant assignments, or account status.', 403);
            }
        }

        if (!empty($validated['role']) && $validated['role'] === 'Super Admin' && !$currentUser->isSuperAdmin()) {
            return $this->errorResponse('Only a Super Admin can grant Super Admin privileges.', 403);
        }

        if ($hasAdminEdit && (isset($validated['restaurant_ids']) || isset($validated['branch_ids']))) {
            $restaurantIds = $validated['restaurant_ids'] ?? $user->restaurants()->pluck('restaurants.id')->all();
            $branchIds = $validated['branch_ids'] ?? $user->branches()->pluck('branches.id')->all();
            if ($error = $this->validateTenantAssignments($currentUser, $restaurantIds, $branchIds)) {
                return $this->errorResponse($error, 403);
            }
        }

        $oldValues = $user->toArray();

        $updateData = [
            'name' => $validated['name'] ?? $user->name,
            'email' => $validated['email'] ?? $user->email,
            'username' => $validated['username'] ?? $user->username,
            'phone' => $validated['phone'] ?? $user->phone,
            'avatar' => $validated['avatar'] ?? $user->avatar,
        ];

        $revokeTokens = false;

        if (!empty($validated['password'])) {
            $updateData['password'] = Hash::make($validated['password']);
            $revokeTokens = true;
        }

        if ($hasAdminEdit && isset($validated['is_active'])) {
            if ($isSelf && !$validated['is_active']) {
                return $this->errorResponse('You cannot deactivate your own account.', 422);
            }
            $updateData['is_active'] = $validated['is_active'];
            if (!$validated['is_active']) {
                $revokeTokens = true;
            }
        }

        $user->update($updateData);

        if ($revokeTokens) {
            $user->tokens()->delete();
        }

        // Update role if permitted
        if ($hasAdminEdit && !empty($validated['role']) && ($currentUser->isSuperAdmin() || $currentUser->can('roles.manage'))) {
            $user->syncRoles([$validated['role']]);
        }

        if ($hasAdminEdit && isset($validated['restaurant_ids'])) {
            $user->restaurants()->sync($validated['restaurant_ids']);
        }

        if ($hasAdminEdit && isset($validated['branch_ids'])) {
            $user->branches()->sync($validated['branch_ids']);
        }

        if ($hasAdminEdit && isset($validated['permissions']) && ($currentUser->isSuperAdmin() || $currentUser->can('roles.manage'))) {
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

        if (!$this->canManageTargetUser($currentUser, $user)) {
            return $this->errorResponse('Unauthorized to delete this user.', 403);
        }

        $user->tokens()->delete();
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

        if (!$this->canManageTargetUser($currentUser, $user)) {
            return $this->errorResponse('Unauthorized to modify this user.', 403);
        }

        $newStatus = !$user->is_active;
        $user->update(['is_active' => $newStatus]);

        if (!$newStatus) {
            $user->tokens()->delete();
        }

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

        if (!$this->canManageTargetUser($currentUser, $user)) {
            return $this->errorResponse('Unauthorized to reset this user\'s password.', 403);
        }

        $user->update([
            'password' => Hash::make($request->input('new_password')),
        ]);

        $user->tokens()->delete();

        AuditLog::log(
            action: 'user.password_reset_by_admin',
            auditable: $user,
            userId: $currentUser->id
        );

        return $this->successResponse(null, 'User password reset successfully.');
    }
}
