<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\DiningTable;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhaseTwoManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    /**
     * Test Super Admin dashboard statistics endpoint.
     */
    public function test_super_admin_can_retrieve_dashboard_analytics(): void
    {
        $superAdmin = User::where('email', 'superadmin@resto.com')->first();
        $token = $superAdmin->createToken('admin_token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/super-admin/dashboard');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'overview' => [
                        'total_restaurants' => 1,
                        'total_branches' => 2,
                    ],
                ],
            ]);

        $this->assertArrayHasKey('today_revenue', $response->json('data.overview'));
        $this->assertArrayHasKey('monthly_revenue', $response->json('data.overview'));
        $this->assertArrayHasKey('pending_payments', $response->json('data.overview'));
        $this->assertArrayHasKey('active_tables', $response->json('data.overview'));
        $this->assertNotEmpty($response->json('data.revenue_trends'));
        $this->assertNotEmpty($response->json('data.restaurant_performance'));
    }

    /**
     * Test unauthorized users cannot view Super Admin analytics.
     */
    public function test_unauthorized_user_cannot_view_analytics(): void
    {
        $waiter = User::where('email', 'waiter@grandfeast.com')->first();
        $token = $waiter->createToken('waiter_token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/super-admin/dashboard');

        $response->assertStatus(403);
    }

    /**
     * Test Restaurant CRUD workflow with audit logging.
     */
    public function test_restaurant_crud_lifecycle(): void
    {
        $superAdmin = User::where('email', 'superadmin@resto.com')->first();
        $token = $superAdmin->createToken('admin_token')->plainTextToken;

        // 1. Create Restaurant
        $createResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/restaurants', [
                'name' => 'Royal Spice Bistro',
                'slug' => 'royal-spice-bistro',
                'phone' => '+91 99000 11223',
                'email' => 'contact@royalspice.com',
                'currency' => 'INR',
                'currency_symbol' => '₹',
                'timezone' => 'Asia/Kolkata',
                'primary_color' => '#C76B4A',
            ]);

        $createResponse->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Royal Spice Bistro',
                    'slug' => 'royal-spice-bistro',
                ],
            ]);

        $restaurantId = $createResponse->json('data.id');

        // 2. Update Restaurant
        $updateResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->putJson('/api/v1/restaurants/' . $restaurantId, [
                'name' => 'Royal Spice Bistro & Bar',
                'phone' => '+91 99000 99999',
            ]);

        $updateResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Royal Spice Bistro & Bar',
                ],
            ]);

        // 3. Toggle Status
        $toggleResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/restaurants/' . $restaurantId . '/toggle-status');

        $toggleResponse->assertStatus(200)
            ->assertJson([
                'data' => [
                    'is_active' => false,
                ],
            ]);

        // 4. Archive Restaurant
        $deleteResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson('/api/v1/restaurants/' . $restaurantId);

        $deleteResponse->assertStatus(200);

        // Verify soft deleted
        $this->assertSoftDeleted('restaurants', ['id' => $restaurantId]);

        // Verify audit log
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'restaurant.archived',
            'restaurant_id' => $restaurantId,
        ]);
    }

    /**
     * Test safeguard against archiving restaurant with active orders.
     */
    public function test_cannot_archive_restaurant_with_active_orders(): void
    {
        $superAdmin = User::where('email', 'superadmin@resto.com')->first();
        $token = $superAdmin->createToken('admin_token')->plainTextToken;

        $restaurant = Restaurant::where('slug', 'the-grand-feast')->first();

        // The seeder contains ORD-1002 in status 'preparing'
        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson('/api/v1/restaurants/' . $restaurant->id);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Cannot archive restaurant while there are active or preparing kitchen orders.',
            ]);
    }

    /**
     * Test Branch CRUD workflow.
     */
    public function test_branch_crud_lifecycle(): void
    {
        $superAdmin = User::where('email', 'superadmin@resto.com')->first();
        $token = $superAdmin->createToken('admin_token')->plainTextToken;

        $restaurant = Restaurant::where('slug', 'the-grand-feast')->first();

        // Create Branch
        $createResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson("/api/v1/restaurants/{$restaurant->id}/branches", [
                'name' => 'Velachery Express',
                'code' => 'VLC-03',
                'city' => 'Chennai',
                'tax_rate' => 5.00,
                'opening_time' => '11:00',
                'closing_time' => '23:00',
            ]);

        $createResponse->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Velachery Express',
                    'code' => 'VLC-03',
                ],
            ]);

        $branchId = $createResponse->json('data.id');

        // Update Branch
        $updateResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->putJson("/api/v1/restaurants/{$restaurant->id}/branches/{$branchId}", [
                'name' => 'Velachery Flagship Express',
                'tax_rate' => 12.00,
            ]);

        $updateResponse->assertStatus(200)
            ->assertJson([
                'data' => [
                    'name' => 'Velachery Flagship Express',
                ],
            ]);

        // Delete Branch
        $deleteResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson("/api/v1/restaurants/{$restaurant->id}/branches/{$branchId}");

        $deleteResponse->assertStatus(200);
        $this->assertSoftDeleted('branches', ['id' => $branchId]);
    }

    /**
     * Test User Management CRUD and safeguards.
     */
    public function test_user_management_lifecycle(): void
    {
        $superAdmin = User::where('email', 'superadmin@resto.com')->first();
        $token = $superAdmin->createToken('admin_token')->plainTextToken;

        $restaurant = Restaurant::where('slug', 'the-grand-feast')->first();

        // 1. Create Staff User
        $createResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/users', [
                'name' => 'Vijay Anand',
                'email' => 'vijay@grandfeast.com',
                'username' => 'vijay_waiter',
                'phone' => '+91 91122 33445',
                'password' => 'password123',
                'role' => 'Waiter',
                'restaurant_ids' => [$restaurant->id],
            ]);

        $createResponse->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'email' => 'vijay@grandfeast.com',
                ],
            ]);

        $userId = $createResponse->json('data.id');

        // 2. Direct Admin Password Reset
        $resetResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson("/api/v1/users/{$userId}/reset-password", [
                'new_password' => 'brandnewpass123',
            ]);

        $resetResponse->assertStatus(200);

        // 3. Prevent Self Deletion
        $selfDeleteResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson('/api/v1/users/' . $superAdmin->id);

        $selfDeleteResponse->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'You cannot delete your own account.',
            ]);

        // 4. Delete Created User
        $deleteResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson("/api/v1/users/{$userId}");

        $deleteResponse->assertStatus(200);
        $this->assertSoftDeleted('users', ['id' => $userId]);
    }

    /**
     * Test Role and Permission Matrix API.
     */
    public function test_role_and_permission_matrix(): void
    {
        $superAdmin = User::where('email', 'superadmin@resto.com')->first();
        $token = $superAdmin->createToken('admin_token')->plainTextToken;

        // 1. Get matrix
        $matrixResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/roles');

        $matrixResponse->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'roles',
                    'grouped_permissions' => [
                        'Dashboard',
                        'Restaurants',
                        'Branches',
                        'Users',
                        'Orders',
                        'Kitchen',
                    ],
                ],
            ]);

        // 2. Create custom role
        $createRoleResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/roles', [
                'name' => 'Floor Supervisor',
                'permissions' => ['tables.view', 'orders.view', 'orders.create'],
            ]);

        $createRoleResponse->assertStatus(201)
            ->assertJson([
                'data' => [
                    'name' => 'Floor Supervisor',
                ],
            ]);

        $roleId = $createRoleResponse->json('data.id');

        // 3. Safeguard against deleting system roles
        $systemRole = \Spatie\Permission\Models\Role::where('name', 'Cashier')->first();
        $deleteSystemRoleResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson('/api/v1/roles/' . $systemRole->id);

        $deleteSystemRoleResponse->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Core system role [Cashier] cannot be deleted.',
            ]);

        // 4. Delete custom role
        $deleteCustomResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson('/api/v1/roles/' . $roleId);

        $deleteCustomResponse->assertStatus(200);
    }
}
