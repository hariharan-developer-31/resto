<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolePermissionController extends Controller
{
    use ApiResponse;

    /**
     * List all roles and permissions grouped by module.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('roles.view')) {
            return $this->errorResponse('Unauthorized to view roles.', 403);
        }

        $roles = Role::with('permissions:id,name')
            ->where('guard_name', 'sanctum')
            ->orWhere('guard_name', 'web')
            ->get()
            ->unique('name')
            ->values()
            ->map(function ($role) {
                return [
                    'id' => $role->id,
                    'name' => $role->name,
                    'is_system_role' => in_array($role->name, [
                        'Super Admin',
                        'Restaurant Admin',
                        'Branch Manager',
                        'Cashier',
                        'Waiter',
                        'Kitchen Staff',
                        'Customer',
                    ]),
                    'permissions' => $role->permissions->pluck('name'),
                ];
            });

        // Group permissions logically by module
        $rawPermissions = Permission::where('guard_name', 'sanctum')
            ->orWhere('guard_name', 'web')
            ->get()
            ->unique('name')
            ->values();

        $groupedPermissions = [
            'Dashboard' => [],
            'Restaurants' => [],
            'Branches' => [],
            'Users' => [],
            'Roles & Permissions' => [],
            'Menu' => [],
            'Tables' => [],
            'Orders' => [],
            'Kitchen' => [],
            'Payments' => [],
            'Reservations' => [],
            'Inventory' => [],
            'Reports' => [],
            'Settings' => [],
        ];

        foreach ($rawPermissions as $perm) {
            $prefix = explode('.', $perm->name)[0];
            $groupName = match ($prefix) {
                'dashboard' => 'Dashboard',
                'restaurants' => 'Restaurants',
                'branches' => 'Branches',
                'users' => 'Users',
                'roles' => 'Roles & Permissions',
                'menu' => 'Menu',
                'tables' => 'Tables',
                'orders' => 'Orders',
                'kitchen' => 'Kitchen',
                'payments' => 'Payments',
                'reservations' => 'Reservations',
                'inventory' => 'Inventory',
                'reports' => 'Reports',
                'settings' => 'Settings',
                default => 'Settings',
            };

            $groupedPermissions[$groupName][] = [
                'id' => $perm->id,
                'name' => $perm->name,
                'label' => ucwords(str_replace(['.', '_'], ' ', $perm->name)),
            ];
        }

        return $this->successResponse([
            'roles' => $roles,
            'grouped_permissions' => $groupedPermissions,
        ], 'Roles and permission matrix retrieved.');
    }

    /**
     * Create a custom role.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('roles.manage')) {
            return $this->errorResponse('Unauthorized to create roles.', 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:roles,name',
            'permissions' => 'nullable|array',
            'permissions.*' => 'exists:permissions,name',
        ]);

        $roleSanctum = Role::create(['name' => $validated['name'], 'guard_name' => 'sanctum']);
        $roleWeb = Role::create(['name' => $validated['name'], 'guard_name' => 'web']);

        if (!empty($validated['permissions'])) {
            $roleSanctum->syncPermissions($validated['permissions']);
            $roleWeb->syncPermissions($validated['permissions']);
        }

        AuditLog::log(
            action: 'role.created',
            newValues: ['name' => $validated['name'], 'permissions' => $validated['permissions'] ?? []],
            userId: $user->id
        );

        return $this->successResponse([
            'id' => $roleSanctum->id,
            'name' => $roleSanctum->name,
            'permissions' => $roleSanctum->permissions->pluck('name'),
        ], 'Role created successfully.', 201);
    }

    /**
     * Update an existing role's permissions.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('roles.manage')) {
            return $this->errorResponse('Unauthorized to update roles.', 403);
        }

        $role = Role::find($id);
        if (!$role) {
            return $this->errorResponse('Role not found.', 404);
        }

        if ($role->name === 'Super Admin') {
            return $this->errorResponse('Super Admin role permissions cannot be modified.', 422);
        }

        $systemRoles = [
            'Super Admin',
            'Restaurant Admin',
            'Branch Manager',
            'Cashier',
            'Waiter',
            'Kitchen Staff',
            'Customer',
        ];

        if (in_array($role->name, $systemRoles, true) && !$user->isSuperAdmin()) {
            return $this->errorResponse('Only a Super Admin can modify core system role permissions.', 403);
        }

        $validated = $request->validate([
            'permissions' => 'required|array',
            'permissions.*' => 'exists:permissions,name',
        ]);

        // Sync for both sanctum and web guard roles
        Role::where('name', $role->name)->each(function ($r) use ($validated) {
            $r->syncPermissions($validated['permissions']);
        });

        AuditLog::log(
            action: 'role.permissions_updated',
            newValues: ['role' => $role->name, 'permissions' => $validated['permissions']],
            userId: $user->id
        );

        return $this->successResponse([
            'id' => $role->id,
            'name' => $role->name,
            'permissions' => $validated['permissions'],
        ], 'Role permissions updated successfully.');
    }

    /**
     * Delete custom role.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('roles.manage')) {
            return $this->errorResponse('Unauthorized to delete roles.', 403);
        }

        $role = Role::find($id);
        if (!$role) {
            return $this->errorResponse('Role not found.', 404);
        }

        // Safeguard against deleting system roles
        $systemRoles = [
            'Super Admin',
            'Restaurant Admin',
            'Branch Manager',
            'Cashier',
            'Waiter',
            'Kitchen Staff',
            'Customer',
        ];

        if (in_array($role->name, $systemRoles)) {
            return $this->errorResponse("Core system role [{$role->name}] cannot be deleted.", 422);
        }

        $roleName = $role->name;
        Role::where('name', $roleName)->delete();

        AuditLog::log(
            action: 'role.deleted',
            newValues: ['role' => $roleName],
            userId: $user->id
        );

        return $this->successResponse(null, "Role [{$roleName}] deleted successfully.");
    }
}
