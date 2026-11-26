<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Restaurant;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PhaseOneAuthAndTenantTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    /**
     * Test health check endpoint.
     */
    public function test_health_check_returns_healthy_status(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'healthy',
                    'database' => 'connected',
                ],
            ]);
    }

    /**
     * Test public bootstrap endpoint returns design tokens and active restaurants.
     */
    public function test_bootstrap_returns_system_metadata(): void
    {
        $response = $this->getJson('/api/v1/bootstrap');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'platform_name' => 'Restaurant OS',
                    'design_system' => [
                        'primary' => '#C76B4A',
                        'theme' => 'light',
                    ],
                ],
            ]);

        $this->assertNotEmpty($response->json('data.restaurants'));
    }

    /**
     * Test Super Admin login with valid credentials.
     */
    public function test_super_admin_can_login(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'login' => 'superadmin@resto.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'token_type' => 'Bearer',
                    'user' => [
                        'email' => 'superadmin@resto.com',
                        'is_super_admin' => true,
                    ],
                ],
            ]);

        $this->assertNotNull($response->json('data.token'));

        // Verify audit log created
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'auth.login',
        ]);
    }

    /**
     * Test login with invalid password fails.
     */
    public function test_login_fails_with_invalid_password(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'login' => 'superadmin@resto.com',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);
    }

    /**
     * Test deactivated user cannot login.
     */
    public function test_deactivated_user_cannot_login(): void
    {
        $user = User::where('email', 'cashier@grandfeast.com')->first();
        $user->update(['is_active' => false]);

        $response = $this->postJson('/api/v1/auth/login', [
            'login' => 'cashier@grandfeast.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Your account has been deactivated. Please contact an administrator.',
            ]);
    }

    /**
     * Test authenticated user can access /auth/me and logout.
     */
    public function test_authenticated_user_profile_and_logout(): void
    {
        $user = User::where('email', 'superadmin@resto.com')->first();
        $token = $user->createToken('test_token')->plainTextToken;

        $meResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/auth/me');

        $meResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'user' => [
                        'email' => 'superadmin@resto.com',
                    ],
                ],
            ]);

        $logoutResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/auth/logout');

        $logoutResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }

    /**
     * Test password change workflow.
     */
    public function test_user_can_change_password(): void
    {
        $user = User::where('email', 'waiter@grandfeast.com')->first();
        $token = $user->createToken('test_token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/auth/change-password', [
                'current_password' => 'password123',
                'new_password' => 'newpassword456',
                'new_password_confirmation' => 'newpassword456',
            ]);

        $response->assertStatus(200);

        // Verify can login with new password
        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'login' => 'waiter@grandfeast.com',
            'password' => 'newpassword456',
        ]);

        $loginResponse->assertStatus(200);
    }

    /**
     * Test Tenant Isolation: Staff cannot access unassigned restaurant.
     */
    public function test_staff_cannot_access_unassigned_restaurant(): void
    {
        $restaurantB = Restaurant::create([
            'name' => 'Competitor Bistro',
            'slug' => 'competitor-bistro',
            'is_active' => true,
        ]);

        $cashier = User::where('email', 'cashier@grandfeast.com')->first();
        $cashierToken = $cashier->createToken('cashier_token')->plainTextToken;

        // 1. Cashier accessing assigned Restaurant A -> Should Succeed
        $allowedResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $cashierToken,
            'X-Restaurant-ID' => 1,
        ])->getJson('/api/v1/tenant/verify');

        $allowedResponse->assertStatus(200)
            ->assertJson(['success' => true]);

        // 2. Cashier attempting to access unassigned Restaurant B -> Must be Forbidden 403
        $forbiddenResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $cashierToken,
            'X-Restaurant-ID' => $restaurantB->id,
        ])->getJson('/api/v1/tenant/verify');

        $forbiddenResponse->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Unauthorized access to this restaurant.',
            ]);
    }

    /**
     * Test Tenant Isolation: Super Admin can access any restaurant.
     */
    public function test_super_admin_can_access_any_restaurant(): void
    {
        $restaurantB = Restaurant::create([
            'name' => 'Competitor Bistro 2',
            'slug' => 'competitor-bistro-2',
            'is_active' => true,
        ]);

        $superAdmin = User::where('email', 'superadmin@resto.com')->first();
        $adminToken = $superAdmin->createToken('admin_token')->plainTextToken;

        $adminResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $adminToken,
            'X-Restaurant-ID' => $restaurantB->id,
        ])->getJson('/api/v1/tenant/verify');

        $adminResponse->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    /**
     * Test self-update privilege escalation is blocked for low-privilege users.
     */
    public function test_staff_cannot_escalate_privileges_via_self_update(): void
    {
        $waiter = User::where('email', 'waiter@grandfeast.com')->firstOrFail();
        $token = $waiter->createToken('waiter_token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->putJson("/api/v1/users/{$waiter->id}", [
                'name' => 'Arun Escalated',
                'permissions' => ['restaurants.delete', 'users.delete'],
            ]);

        $response->assertStatus(403)
            ->assertJson(['success' => false]);
    }

    /**
     * Test Restaurant Admin cannot reset Super Admin password.
     */
    public function test_restaurant_admin_cannot_reset_super_admin_password(): void
    {
        $restAdmin = User::where('email', 'admin@grandfeast.com')->firstOrFail();
        $superAdmin = User::where('email', 'superadmin@resto.com')->firstOrFail();
        $token = $restAdmin->createToken('rest_admin_token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson("/api/v1/users/{$superAdmin->id}/reset-password", [
                'new_password' => 'hijacked1234',
            ]);

        $response->assertStatus(403)
            ->assertJson(['success' => false]);
    }

    /**
     * Test non-Super-Admin is blocked from /super-admin/* and gets scoped /dashboard.
     */
    public function test_non_super_admin_dashboard_and_plan_restrictions(): void
    {
        $cashier = User::where('email', 'cashier@grandfeast.com')->firstOrFail();
        $token = $cashier->createToken('cashier_token')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertStatus(403);

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/super-admin/plans', [
                'name' => 'Rogue Plan',
                'slug' => 'rogue',
                'monthly_price' => 0,
                'annual_price' => 0,
                'max_branches' => 99,
                'max_tables_per_branch' => 99,
                'max_staff_members' => 99,
            ])
            ->assertStatus(403);

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/dashboard')
            ->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    /**
     * Test global exception handler returns accurate 401/404/422 status codes.
     */
    public function test_api_exception_handler_returns_proper_http_status_codes(): void
    {
        // Unauthenticated -> 401
        $this->getJson('/api/v1/dashboard')->assertStatus(401);

        // Validation error -> 422
        $this->postJson('/api/v1/auth/login', [])->assertStatus(422);

        // Not found -> 404
        $superAdmin = User::where('email', 'superadmin@resto.com')->firstOrFail();
        $token = $superAdmin->createToken('admin_token')->plainTextToken;
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/restaurants/999999')
            ->assertStatus(404);
    }

    /**
     * Test deactivated user's existing token is immediately rejected by active middleware.
     */
    public function test_deactivated_user_existing_token_is_rejected(): void
    {
        $cashier = User::where('email', 'cashier@grandfeast.com')->firstOrFail();
        $token = $cashier->createToken('cashier_token')->plainTextToken;

        $cashier->update(['is_active' => false]);

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(403);
    }
}
