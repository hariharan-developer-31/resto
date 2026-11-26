<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\DiningTable;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Restaurant;
use App\Models\RestaurantSubscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhaseEightAnalyticsAndSaaSTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;
    protected User $manager;
    protected Restaurant $restaurant;
    protected Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();

        $this->superAdmin = User::where('email', 'superadmin@resto.com')->firstOrFail();
        $this->manager = User::where('email', 'manager@grandfeast.com')->firstOrFail();
        $this->restaurant = Restaurant::firstOrFail();
        $this->branch = Branch::firstOrFail();
    }

    /**
     * Test manager can retrieve overview sales analytics.
     */
    public function test_manager_can_retrieve_revenue_and_sales_overview_analytics(): void
    {
        $response = $this->actingAs($this->manager)
            ->withHeaders([
                'X-Restaurant-ID' => $this->restaurant->id,
                'X-Branch-ID' => $this->branch->id,
            ])
            ->getJson('/api/v1/analytics/overview');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'summary' => [],
                    'daily_trend' => [],
                    'order_type_distribution' => [],
                    'payment_modes' => [],
                    'hourly_rush' => [],
                ],
            ]);

        $this->assertNotEmpty($response->json('data.daily_trend'));
        $this->assertArrayHasKey('cash', $response->json('data.payment_modes'));
        $this->assertArrayHasKey('dine_in', $response->json('data.order_type_distribution'));
    }

    /**
     * Test manager can view menu engineering product mix.
     */
    public function test_manager_can_retrieve_menu_engineering_and_dish_mix(): void
    {
        $response = $this->actingAs($this->manager)
            ->withHeaders([
                'X-Restaurant-ID' => $this->restaurant->id,
                'X-Branch-ID' => $this->branch->id,
            ])
            ->getJson('/api/v1/analytics/menu-engineering');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'top_dishes' => [],
                    'category_breakdown' => [],
                ],
            ]);
    }

    /**
     * Test table turnaround and occupancy rate analytics.
     */
    public function test_manager_can_retrieve_table_efficiency_and_occupancy(): void
    {
        $response = $this->actingAs($this->manager)
            ->withHeaders([
                'X-Restaurant-ID' => $this->restaurant->id,
                'X-Branch-ID' => $this->branch->id,
            ])
            ->getJson('/api/v1/analytics/table-efficiency');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertArrayHasKey('average_turnaround_minutes', $response->json('data'));
        $this->assertGreaterThan(0, $response->json('data.total_tables'));
    }

    /**
     * Test End-of-Day (EOD) Z-Report compilation and tender balancing.
     */
    public function test_manager_can_generate_end_of_day_z_report(): void
    {
        $today = now()->toDateString();

        $response = $this->actingAs($this->manager)
            ->withHeaders([
                'X-Restaurant-ID' => $this->restaurant->id,
                'X-Branch-ID' => $this->branch->id,
            ])
            ->getJson("/api/v1/reports/eod?date={$today}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'report_metadata' => [
                        'report_type' => 'End-of-Day (EOD) Z-Report',
                    ],
                    'financial_summary' => [],
                    'tender_reconciliation' => [],
                    'order_statistics' => [],
                ],
            ]);

        $this->assertArrayHasKey('gross_sales', $response->json('data.financial_summary'));
        $this->assertArrayHasKey('total_collected', $response->json('data.tender_reconciliation'));
    }

    /**
     * Test Tax & GST liability report.
     */
    public function test_manager_can_retrieve_tax_and_gst_report(): void
    {
        $response = $this->actingAs($this->manager)
            ->withHeaders([
                'X-Restaurant-ID' => $this->restaurant->id,
            ])
            ->getJson('/api/v1/reports/tax');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'date_range' => [],
                ],
            ]);

        $this->assertArrayHasKey('total_tax_liability', $response->json('data'));
    }

    /**
     * Test listing SaaS subscription plans.
     */
    public function test_public_and_staff_can_view_saas_subscription_plans(): void
    {
        $response = $this->actingAs($this->manager)->getJson('/api/v1/subscription/plans');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $slugs = collect($response->json('data'))->pluck('slug')->all();
        $this->assertContains('starter', $slugs);
        $this->assertContains('pro', $slugs);
        $this->assertContains('enterprise', $slugs);
    }

    /**
     * Test tenant can retrieve current plan and quota utilization.
     */
    public function test_tenant_can_view_current_subscription_and_resource_quotas(): void
    {
        $response = $this->actingAs($this->manager)
            ->withHeaders([
                'X-Restaurant-ID' => $this->restaurant->id,
            ])
            ->getJson('/api/v1/subscription/current');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'plan' => [
                        'slug' => 'pro',
                    ],
                    'quotas' => [
                        'branches' => [],
                        'tables' => [],
                        'staff' => [],
                    ],
                ],
            ]);

        $this->assertEquals(3, $response->json('data.quotas.branches.max'));
    }

    /**
     * Test tenant can upgrade subscription plan.
     */
    public function test_tenant_can_upgrade_subscription_plan(): void
    {
        $enterprisePlan = SubscriptionPlan::where('slug', 'enterprise')->firstOrFail();

        $response = $this->actingAs($this->manager)
            ->withHeaders([
                'X-Restaurant-ID' => $this->restaurant->id,
            ])
            ->postJson('/api/v1/subscription/upgrade', [
                'plan_id' => $enterprisePlan->id,
                'billing_cycle' => 'annual',
                'payment_gateway' => 'razorpay',
                'payment_reference' => 'pay_test_enterprise_upgrade_123',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertEquals($enterprisePlan->id, $this->restaurant->fresh()->current_plan_id);

        $this->assertDatabaseHas('restaurant_subscriptions', [
            'restaurant_id' => $this->restaurant->id,
            'plan_id' => $enterprisePlan->id,
            'billing_cycle' => 'annual',
            'status' => 'active',
        ]);
    }

    /**
     * Test Super Admin can create new custom SaaS subscription tier.
     */
    public function test_super_admin_can_create_custom_subscription_plan(): void
    {
        $response = $this->actingAs($this->superAdmin)->postJson('/api/v1/super-admin/plans', [
            'name' => 'Ghost Kitchen Cloud Tier',
            'slug' => 'ghost-kitchen-tier',
            'description' => 'Tailored for delivery-only virtual cloud kitchens',
            'monthly_price' => 2499.00,
            'annual_price' => 24990.00,
            'max_branches' => 2,
            'max_tables_per_branch' => 0,
            'max_staff_members' => 8,
            'features' => ['kds', 'orders', 'inventory', 'delivery_integrations'],
            'sort_order' => 4,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'slug' => 'ghost-kitchen-tier',
                ],
            ]);

        $this->assertDatabaseHas('subscription_plans', [
            'slug' => 'ghost-kitchen-tier',
            'monthly_price' => 2499.00,
        ]);
    }

    /**
     * Test Hostinger cron maintenance command.
     */
    public function test_hostinger_cron_maintenance_command_executes_successfully(): void
    {
        $this->artisan('resto:hostinger-cron')
            ->expectsOutputToContain('Starting Restaurant OS Hostinger Scheduled Maintenance..')
            ->expectsOutputToContain('Hostinger maintenance cycle completed successfully.')
            ->assertExitCode(0);
    }
}
