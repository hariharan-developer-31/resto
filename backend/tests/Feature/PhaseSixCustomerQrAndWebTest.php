<?php

namespace Tests\Feature;

use App\Models\Addon;
use App\Models\Branch;
use App\Models\DiningTable;
use App\Models\MenuItem;
use App\Models\MenuVariant;
use App\Models\Order;
use App\Models\Reservation;
use App\Models\Restaurant;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhaseSixCustomerQrAndWebTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    /**
     * Test Guest can view public restaurant profile and active menu catalog.
     */
    public function test_guest_can_view_public_restaurant_profile_and_catalog(): void
    {
        $restaurant = Restaurant::first();

        $response = $this->getJson('/api/v1/public/restaurants/' . $restaurant->slug);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'restaurant' => [
                        'name' => $restaurant->name,
                        'slug' => $restaurant->slug,
                    ],
                ],
            ]);

        $this->assertNotEmpty($response->json('data.branches'));
        $this->assertNotEmpty($response->json('data.menu_catalog'));
    }

    /**
     * Test Guest can resolve table via valid QR token.
     */
    public function test_guest_can_resolve_table_via_valid_qr_token(): void
    {
        $table = DiningTable::first();

        $response = $this->getJson('/api/v1/public/table/' . $table->qr_token);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'table' => [
                        'id' => $table->id,
                        'table_number' => $table->table_number,
                    ],
                ],
            ]);

        $this->assertNotEmpty($response->json('data.categories'));
    }

    /**
     * Test invalid or unknown QR token returns 404.
     */
    public function test_invalid_qr_token_returns_404(): void
    {
        $response = $this->getJson('/api/v1/public/table/tbl_invalid_token_1234567890abcdef');

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
            ]);
    }

    /**
     * Test contactless ordering directly from table QR code.
     */
    public function test_guest_can_place_order_via_table_qr_token(): void
    {
        $table = DiningTable::first();
        $menuItem = MenuItem::with(['variants', 'addons'])->first();
        $variant = $menuItem->variants->first();
        $addon = $menuItem->addons->first() ?? Addon::first();

        $response = $this->postJson('/api/v1/public/table/' . $table->qr_token . '/order', [
            'customer_name' => 'Suresh Kumar',
            'customer_phone' => '9888877777',
            'special_instructions' => 'Table guest ordering test',
            'items' => [
                [
                    'menu_item_id' => $menuItem->id,
                    'menu_variant_id' => $variant?->id,
                    'quantity' => 1,
                    'special_instructions' => 'No onions please',
                    'addon_ids' => $addon ? [$addon->id] : [],
                ],
            ],
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
            ]);

        $orderData = $response->json('data.order');
        $this->assertNotEmpty($orderData['order_number']);
        $this->assertEquals(1, $orderData['round_count']);

        // Check table became occupied
        $this->assertEquals('occupied', $table->fresh()->status);

        // Check KOT generated
        $kotNumber = $response->json('data.kot_number');
        $this->assertStringStartsWith('KOT-', $kotNumber);

        // Check order item created in database
        $this->assertDatabaseHas('order_items', [
            'order_id' => $orderData['id'],
            'menu_item_id' => $menuItem->id,
            'quantity' => 1,
        ]);
    }

    /**
     * Test ordering again on same table adds an additional order round.
     */
    public function test_guest_can_add_additional_round_via_qr_token(): void
    {
        $table = DiningTable::first();
        $menuItems = MenuItem::take(2)->get();

        // Round 1
        $r1 = $this->postJson('/api/v1/public/table/' . $table->qr_token . '/order', [
            'items' => [
                ['menu_item_id' => $menuItems[0]->id, 'quantity' => 1],
            ],
        ]);
        $r1->assertStatus(201);
        $orderId = $r1->json('data.order.id');

        // Round 2
        $r2 = $this->postJson('/api/v1/public/table/' . $table->qr_token . '/order', [
            'items' => [
                ['menu_item_id' => $menuItems[1]->id, 'quantity' => 2],
            ],
        ]);
        $r2->assertStatus(201);

        $order = $r2->json('data.order');
        $this->assertEquals($orderId, $order['id']);
        $this->assertEquals(2, $order['round_count']);
    }

    /**
     * Test Guest can track order preparation status.
     */
    public function test_guest_can_track_order_status(): void
    {
        $table = DiningTable::first();
        $menuItem = MenuItem::first();

        $createRes = $this->postJson('/api/v1/public/table/' . $table->qr_token . '/order', [
            'items' => [
                ['menu_item_id' => $menuItem->id, 'quantity' => 2],
            ],
        ]);
        $orderNumber = $createRes->json('data.order.order_number');

        $trackRes = $this->getJson('/api/v1/public/orders/' . $orderNumber . '/track');

        $trackRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'order_number' => $orderNumber,
                    'stage' => 1,
                    'stage_label' => 'Order Received',
                ],
            ]);

        $this->assertNotEmpty($trackRes->json('data.items'));
    }

    /**
     * Test Digital Table Bell: Guest service requests at table.
     */
    public function test_guest_can_send_table_bell_service_request(): void
    {
        $table = DiningTable::first();

        $response = $this->postJson('/api/v1/public/table/' . $table->qr_token . '/service-request', [
            'request_type' => 'call_waiter',
            'note' => 'Please bring extra water glasses',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'table_number' => $table->table_number,
                    'request_type' => 'call_waiter',
                ],
            ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'table.service_request',
            'restaurant_id' => $table->restaurant_id,
            'branch_id' => $table->branch_id,
        ]);

        // Verify live staff notification was created and is readable via API
        $this->assertDatabaseHas('notifications', [
            'type' => 'table_service_request',
            'restaurant_id' => $table->restaurant_id,
            'branch_id' => $table->branch_id,
        ]);

        $waiter = \App\Models\User::where('email', 'waiter@grandfeast.com')->firstOrFail();
        $token = $waiter->createToken('waiter_token')->plainTextToken;

        $notifRes = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
            'X-Restaurant-ID' => (string) $table->restaurant_id,
            'X-Branch-ID' => (string) $table->branch_id,
        ])->getJson('/api/v1/notifications');

        $notifRes->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, $notifRes->json('data.unread_count'));
    }

    /**
     * Test Guest can book a table reservation.
     */
    public function test_guest_can_book_table_reservation(): void
    {
        $restaurant = Restaurant::first();
        $branch = Branch::first();
        $tomorrow = now()->addDay()->toDateString();

        $response = $this->postJson('/api/v1/public/reservations', [
            'restaurant_id' => $restaurant->id,
            'branch_id' => $branch->id,
            'customer_name' => 'Meera Krishnan',
            'customer_phone' => '+91 91234 56789',
            'customer_email' => 'meera@example.com',
            'guest_count' => 4,
            'reservation_date' => $tomorrow,
            'reservation_time' => '20:00',
            'special_requests' => 'Quiet booth preferred',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'customer_name' => 'Meera Krishnan',
                    'guest_count' => 4,
                    'status' => 'confirmed',
                ],
            ]);

        $this->assertDatabaseHas('reservations', [
            'customer_name' => 'Meera Krishnan',
            'customer_phone' => '+91 91234 56789',
            'guest_count' => 4,
            'status' => 'confirmed',
        ]);
        $this->assertStringStartsWith('RES-', (string) $response->json('data.booking_code'));
    }

    /**
     * Test cancelled order tracks as Cancelled (stage 0) rather than Served.
     */
    public function test_cancelled_order_tracks_as_cancelled_not_served(): void
    {
        $cancelledOrder = Order::where('order_status', 'cancelled')->firstOrFail();

        $res = $this->getJson('/api/v1/public/orders/' . $cancelledOrder->order_number . '/track');

        $res->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'stage' => 0,
                    'stage_label' => 'Cancelled',
                ],
            ]);
    }
}
