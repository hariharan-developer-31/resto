<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\DiningTable;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Restaurant;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhaseFiveKdsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    /**
     * Helper to seed an active order with KOT items across multiple kitchen stations.
     */
    protected function createActiveOrderWithItems(string $kotNumber = 'KOT-20261126-001'): array
    {
        $restaurant = Restaurant::first();
        $branch = Branch::first();
        $table = DiningTable::first();

        $order = Order::create([
            'restaurant_id' => $restaurant->id,
            'branch_id' => $branch->id,
            'table_id' => $table->id,
            'order_number' => Order::generateOrderNumber($branch->id),
            'order_type' => 'dine_in',
            'order_status' => 'pending',
            'payment_status' => 'unpaid',
            'subtotal' => 600.00,
            'tax_amount' => 30.00,
            'total_amount' => 630.00,
            'round_count' => 1,
        ]);

        $itemBiryani = MenuItem::where('kitchen_station', 'biryani')->first() ?? MenuItem::first();
        $itemTandoor = MenuItem::where('kitchen_station', 'tandoor')->first() ?? MenuItem::skip(1)->first();

        $orderItem1 = OrderItem::create([
            'order_id' => $order->id,
            'menu_item_id' => $itemBiryani->id,
            'round_number' => 1,
            'kot_number' => $kotNumber,
            'item_name' => $itemBiryani->name,
            'quantity' => 2,
            'unit_price' => $itemBiryani->base_price,
            'subtotal' => $itemBiryani->base_price * 2,
            'tax_rate' => 5.00,
            'tax_amount' => 15.00,
            'total_price' => ($itemBiryani->base_price * 2) + 15.00,
            'status' => 'pending',
            'kitchen_station' => 'biryani',
            'special_instructions' => 'Less oil, spicy',
        ]);

        $orderItem2 = OrderItem::create([
            'order_id' => $order->id,
            'menu_item_id' => $itemTandoor->id,
            'round_number' => 1,
            'kot_number' => $kotNumber,
            'item_name' => $itemTandoor->name,
            'quantity' => 1,
            'unit_price' => $itemTandoor->base_price,
            'subtotal' => $itemTandoor->base_price,
            'tax_rate' => 5.00,
            'tax_amount' => 15.00,
            'total_price' => $itemTandoor->base_price + 15.00,
            'status' => 'pending',
            'kitchen_station' => 'tandoor',
        ]);

        return [$order, [$orderItem1, $orderItem2]];
    }

    /**
     * Test Kitchen Staff can retrieve active KDS tickets grouped by KOT.
     */
    public function test_kitchen_staff_can_retrieve_kds_tickets(): void
    {
        $this->createActiveOrderWithItems('KOT-20261126-101');

        $chef = User::where('email', 'kitchen@grandfeast.com')->first();
        $token = $chef->createToken('chef_token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/kds/tickets');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'station' => 'all',
                    'mode' => 'active',
                ],
            ]);

        $tickets = $response->json('data.tickets');
        $this->assertNotEmpty($tickets);

        $ticket = collect($tickets)->firstWhere('kot_number', 'KOT-20261126-101');
        $this->assertNotNull($ticket);
        $this->assertEquals('dine_in', $ticket['order_type']);
        $this->assertCount(2, $ticket['items']);
        $this->assertArrayHasKey('elapsed_minutes', $ticket);
        $this->assertArrayHasKey('urgency', $ticket);
    }

    /**
     * Test station-specific filtering (e.g. Biryani station only).
     */
    public function test_kitchen_staff_can_filter_by_station(): void
    {
        $this->createActiveOrderWithItems('KOT-20261126-202');

        $chef = User::where('email', 'kitchen@grandfeast.com')->first();
        $token = $chef->createToken('chef_token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/kds/tickets?station=biryani');

        $response->assertStatus(200);

        $tickets = $response->json('data.tickets');
        $ticket = collect($tickets)->firstWhere('kot_number', 'KOT-20261126-202');
        $this->assertNotNull($ticket);

        // Only the biryani station item should be present in this ticket
        $stations = collect($ticket['items'])->pluck('kitchen_station')->unique();
        $this->assertEquals(['biryani'], $stations->toArray());
    }

    /**
     * Test Chef can update item status to preparing and ready.
     */
    public function test_chef_can_update_item_status(): void
    {
        [$order, $items] = $this->createActiveOrderWithItems('KOT-20261126-303');
        $chef = User::where('email', 'kitchen@grandfeast.com')->first();
        $token = $chef->createToken('chef_token')->plainTextToken;

        // 1. Mark as preparing
        $prepResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->patchJson('/api/v1/kds/items/' . $items[0]->id . '/status', [
                'status' => 'preparing',
            ]);

        $prepResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'preparing',
                ],
            ]);

        $this->assertEquals('preparing', $order->fresh()->order_status);

        // 2. Mark as ready
        $readyResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->patchJson('/api/v1/kds/items/' . $items[0]->id . '/status', [
                'status' => 'ready',
            ]);

        $readyResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'ready',
                ],
            ]);

        $this->assertEquals('ready', $items[0]->fresh()->status);
    }

    /**
     * Test Chef can batch mark an entire KOT ticket as Ready.
     */
    public function test_chef_can_batch_mark_entire_ticket_as_ready(): void
    {
        [$order, $items] = $this->createActiveOrderWithItems('KOT-20261126-404');
        $chef = User::where('email', 'kitchen@grandfeast.com')->first();
        $token = $chef->createToken('chef_token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/kds/tickets/KOT-20261126-404/ready');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'kot_number' => 'KOT-20261126-404',
                    'updated_items_count' => 2,
                ],
            ]);

        // Verify both items became ready
        $this->assertEquals('ready', $items[0]->fresh()->status);
        $this->assertEquals('ready', $items[1]->fresh()->status);

        // Verify overall order status synced to ready
        $this->assertEquals('ready', $order->fresh()->order_status);
    }

    /**
     * Test KDS live summary metrics endpoint.
     */
    public function test_kds_summary_metrics(): void
    {
        $this->createActiveOrderWithItems('KOT-20261126-505');
        $chef = User::where('email', 'kitchen@grandfeast.com')->first();
        $token = $chef->createToken('chef_token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/kds/summary');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $data = $response->json('data');
        $this->assertArrayHasKey('pending_items', $data);
        $this->assertArrayHasKey('preparing_items', $data);
        $this->assertArrayHasKey('ready_items', $data);
        $this->assertArrayHasKey('overdue_tickets', $data);
        $this->assertArrayHasKey('station_counts', $data);
        $this->assertGreaterThanOrEqual(2, $data['pending_items']);
    }
}
