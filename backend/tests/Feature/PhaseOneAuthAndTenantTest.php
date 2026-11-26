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
}
