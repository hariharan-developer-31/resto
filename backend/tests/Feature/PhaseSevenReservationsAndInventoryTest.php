<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\DiningTable;
use App\Models\InventoryItem;
use App\Models\MenuItem;
use App\Models\PurchaseOrder;
use App\Models\RecipeIngredient;
use App\Models\Reservation;
use App\Models\Restaurant;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhaseSevenReservationsAndInventoryTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;
    protected User $manager;
    protected Restaurant $restaurant;
    protected Branch $branch;
    protected DiningTable $table;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();

        $this->superAdmin = User::where('email', 'superadmin@resto.com')->firstOrFail();
        $this->manager = User::where('email', 'manager@grandfeast.com')->firstOrFail();
        $this->restaurant = Restaurant::firstOrFail();
        $this->branch = Branch::firstOrFail();
        $this->table = DiningTable::firstOrFail();
    }

    /**
     * Test staff can list reservations with branch and status filtering.
     */
    public function test_staff_can_list_and_filter_reservations(): void
    {
        $response = $this->actingAs($this->manager)
            ->withHeaders([
                'X-Restaurant-ID' => $this->restaurant->id,
                'X-Branch-ID' => $this->branch->id,
            ])
            ->getJson('/api/v1/reservations?status=confirmed');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertNotEmpty($response->json('data.data'));
    }

    /**
     * Test staff can create a reservation with table assignment.
     */
    public function test_staff_can_create_reservation_with_table(): void
    {
        $tomorrow = now()->addDay()->toDateString();

        $response = $this->actingAs($this->manager)
            ->withHeaders([
                'X-Restaurant-ID' => $this->restaurant->id,
                'X-Branch-ID' => $this->branch->id,
            ])
            ->postJson('/api/v1/reservations', [
                'branch_id' => $this->branch->id,
                'table_id' => $this->table->id,
                'customer_name' => 'Vikram Malhotra',
                'customer_phone' => '+91 97777 88888',
                'customer_email' => 'vikram@example.com',
                'guest_count' => 3,
                'reservation_date' => $tomorrow,
                'reservation_time' => '20:30',
                'special_requests' => 'Anniversary celebration cake requested',
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'customer_name' => 'Vikram Malhotra',
                    'status' => 'confirmed',
                    'table_id' => $this->table->id,
                ],
            ]);

        $this->assertDatabaseHas('reservations', [
            'customer_name' => 'Vikram Malhotra',
            'customer_phone' => '+91 97777 88888',
            'status' => 'confirmed',
        ]);
    }

    /**
     * Test conflicting time slot prevents double-booking same table.
     */
    public function test_cannot_assign_table_with_conflicting_time_slot(): void
    {
        $bookingDate = now()->addDays(2)->toDateString();

        // Booking 1 on Table at 20:00
        Reservation::create([
            'restaurant_id' => $this->restaurant->id,
            'branch_id' => $this->branch->id,
            'table_id' => $this->table->id,
            'customer_name' => 'Pooja Hegde',
            'customer_phone' => '+91 96666 55555',
            'guest_count' => 2,
            'reservation_date' => $bookingDate,
            'reservation_time' => '20:00',
            'status' => 'confirmed',
        ]);

        // Attempt Booking 2 on same Table at 20:30 (+30 mins overlap within 90-min buffer)
        $response = $this->actingAs($this->manager)
            ->withHeaders([
                'X-Restaurant-ID' => $this->restaurant->id,
                'X-Branch-ID' => $this->branch->id,
            ])
            ->postJson('/api/v1/reservations', [
                'branch_id' => $this->branch->id,
                'table_id' => $this->table->id,
                'customer_name' => 'Rohan Sen',
                'customer_phone' => '+91 95555 44444',
                'guest_count' => 2,
                'reservation_date' => $bookingDate,
                'reservation_time' => '20:30',
            ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    /**
     * Test seating a guest updates reservation status and marks table occupied.
     */
    public function test_staff_can_seat_guest_and_occupy_table(): void
    {
        $reservation = Reservation::where('status', 'confirmed')->firstOrFail();
        $this->table->update(['status' => 'available']);

        $response = $this->actingAs($this->manager)
            ->withHeaders([
                'X-Restaurant-ID' => $this->restaurant->id,
                'X-Branch-ID' => $this->branch->id,
            ])
            ->patchJson("/api/v1/reservations/{$reservation->id}/status", [
                'status' => 'seated',
                'table_id' => $this->table->id,
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'seated',
                    'table_id' => $this->table->id,
                ],
            ]);

        $this->assertEquals('occupied', $this->table->fresh()->status);
        $this->assertNotNull($reservation->fresh()->seated_at);
    }

    /**
     * Test Supplier CRUD lifecycle.
     */
    public function test_supplier_crud_lifecycle(): void
    {
        // 1. Create Supplier
        $createRes = $this->actingAs($this->manager)
            ->withHeaders(['X-Restaurant-ID' => $this->restaurant->id])
            ->postJson('/api/v1/suppliers', [
                'name' => 'Organic Valley Spices Corp',
                'contact_person' => 'Sunil Gupta',
                'phone' => '+91 91111 22222',
                'email' => 'sunil@organicvalley.example.com',
                'payment_terms' => 'net_30',
                'status' => 'active',
            ]);

        $createRes->assertStatus(201);
        $supplierId = $createRes->json('data.id');

        // 2. Update Supplier
        $updateRes = $this->actingAs($this->manager)
            ->putJson("/api/v1/suppliers/{$supplierId}", [
                'contact_person' => 'Sunil R. Gupta',
                'payment_terms' => 'net_15',
            ]);

        $updateRes->assertStatus(200);
        $this->assertEquals('Sunil R. Gupta', Supplier::find($supplierId)->contact_person);

        // 3. Delete Supplier
        $deleteRes = $this->actingAs($this->manager)->deleteJson("/api/v1/suppliers/{$supplierId}");
        $deleteRes->assertStatus(200);
        $this->assertSoftDeleted('suppliers', ['id' => $supplierId]);
    }

    /**
     * Test inventory item creation and low stock threshold detection.
     */
    public function test_inventory_item_creation_and_minimum_stock_alerting(): void
    {
        $supplier = Supplier::firstOrFail();

        // Create item with current_stock (3.00) <= minimum_stock (5.00) -> low_stock!
        $response = $this->actingAs($this->manager)
            ->withHeaders([
                'X-Restaurant-ID' => $this->restaurant->id,
                'X-Branch-ID' => $this->branch->id,
            ])
            ->postJson('/api/v1/inventory', [
                'branch_id' => $this->branch->id,
                'supplier_id' => $supplier->id,
                'name' => 'Organic Kashmiri Saffron Threads',
                'sku' => 'ING-SAF-02',
                'category' => 'spices',
                'unit' => 'g',
                'current_stock' => 3.000,
                'minimum_stock' => 5.000,
                'unit_cost' => 320.00,
                'storage_location' => 'Spice Safe Vault',
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Organic Kashmiri Saffron Threads',
                    'status' => 'low_stock',
                ],
            ]);

        // Verify alert appears in alerts endpoint
        $alertRes = $this->actingAs($this->manager)
            ->withHeaders([
                'X-Restaurant-ID' => $this->restaurant->id,
                'X-Branch-ID' => $this->branch->id,
            ])
            ->getJson('/api/v1/inventory/alerts');

        $alertRes->assertStatus(200);
        $alertNames = collect($alertRes->json('data'))->pluck('name')->all();
        $this->assertContains('Organic Kashmiri Saffron Threads', $alertNames);
    }

    /**
     * Test stock adjustment (wastage/breakage) updates stock balance and records audit movement.
     */
    public function test_stock_adjustment_creates_movement_and_updates_status(): void
    {
        $item = InventoryItem::where('current_stock', '>', 10)->firstOrFail();
        $initialStock = (float) $item->current_stock;

        $response = $this->actingAs($this->manager)
            ->postJson('/api/v1/inventory/adjust', [
                'inventory_item_id' => $item->id,
                'movement_type' => 'wastage',
                'quantity' => -2.500, // Deduction due to kitchen spill
                'reason' => 'Preparation counter spill during dinner rush',
                'notes' => 'Logged by Chef Mohan',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $expectedBalance = $initialStock - 2.500;
        $this->assertEquals($expectedBalance, (float) $item->fresh()->current_stock);

        // Check stock movement ledger record created
        $this->assertDatabaseHas('stock_movements', [
            'inventory_item_id' => $item->id,
            'movement_type' => 'wastage',
            'quantity' => -2.500,
            'reason' => 'Preparation counter spill during dinner rush',
        ]);
    }

    /**
     * Test Purchase Order creation and receipt increments inventory stock.
     */
    public function test_purchase_order_creation_and_stock_receipt_intake(): void
    {
        $supplier = Supplier::firstOrFail();
        $item = InventoryItem::firstOrFail();
        $oldStock = (float) $item->current_stock;

        // 1. Create Purchase Order
        $poRes = $this->actingAs($this->manager)
            ->withHeaders([
                'X-Restaurant-ID' => $this->restaurant->id,
                'X-Branch-ID' => $this->branch->id,
            ])
            ->postJson('/api/v1/purchase-orders', [
                'branch_id' => $this->branch->id,
                'supplier_id' => $supplier->id,
                'order_date' => now()->toDateString(),
                'expected_delivery_date' => now()->addDays(2)->toDateString(),
                'items' => [
                    [
                        'inventory_item_id' => $item->id,
                        'quantity_ordered' => 15.000,
                        'unit_cost' => 100.00,
                    ],
                ],
            ]);

        $poRes->assertStatus(201);
        $poId = $poRes->json('data.id');
        $poItemId = $poRes->json('data.items.0.id');

        // 2. Receive shipment goods
        $receiveRes = $this->actingAs($this->manager)
            ->postJson("/api/v1/purchase-orders/{$poId}/receive", [
                'items' => [
                    [
                        'item_id' => $poItemId,
                        'quantity_received' => 15.000,
                    ],
                ],
            ]);

        $receiveRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'received',
                ],
            ]);

        // Stock must have increased by 15.000
        $this->assertEquals($oldStock + 15.000, (float) $item->fresh()->current_stock);

        // Stock movement ledger entry must exist
        $this->assertDatabaseHas('stock_movements', [
            'inventory_item_id' => $item->id,
            'movement_type' => 'purchase_in',
            'quantity' => 15.000,
            'reference_type' => 'purchase_order',
            'reference_id' => $poId,
        ]);
    }

    /**
     * Test Recipe Bill of Materials (BOM) ingredients can be saved and retrieved.
     */
    public function test_recipe_bom_ingredients_save_and_retrieve(): void
    {
        $menuItem = MenuItem::firstOrFail();
        $items = InventoryItem::take(2)->get();

        $saveRes = $this->actingAs($this->manager)
            ->postJson("/api/v1/menu-items/{$menuItem->id}/recipe", [
                'ingredients' => [
                    [
                        'inventory_item_id' => $items[0]->id,
                        'quantity_required' => 0.250,
                        'unit' => 'kg',
                    ],
                    [
                        'inventory_item_id' => $items[1]->id,
                        'quantity_required' => 0.050,
                        'unit' => 'l',
                    ],
                ],
            ]);

        $saveRes->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        // Verify retrieval
        $getRes = $this->actingAs($this->manager)
            ->getJson("/api/v1/menu-items/{$menuItem->id}/recipe");

        $getRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'menu_item_id' => $menuItem->id,
                ],
            ]);

        $this->assertCount(2, $getRes->json('data.recipe_ingredients'));
    }

    /**
     * Test midnight-crossing reservation conflict and table seating capacity enforcement.
     */
    public function test_midnight_conflict_and_table_capacity_validation(): void
    {
        $bookingDate = now()->addDays(4)->toDateString();
        $smallTable = DiningTable::where('seating_capacity', '<=', 4)->firstOrFail();

        // Reject guest_count exceeding table seating_capacity
        $this->actingAs($this->manager)
            ->withHeaders(['X-Restaurant-ID' => $this->restaurant->id, 'X-Branch-ID' => $this->branch->id])
            ->postJson('/api/v1/reservations', [
                'branch_id' => $this->branch->id,
                'table_id' => $smallTable->id,
                'customer_name' => 'Large Party',
                'customer_phone' => '+91 90000 11111',
                'guest_count' => $smallTable->seating_capacity + 4,
                'reservation_date' => $bookingDate,
                'reservation_time' => '20:00',
            ])
            ->assertStatus(422);

        // Midnight-crossing conflict: 23:15 vs 23:45 on same table
        Reservation::create([
            'restaurant_id' => $this->restaurant->id,
            'branch_id' => $this->branch->id,
            'table_id' => $smallTable->id,
            'customer_name' => 'Late Diner 1',
            'customer_phone' => '+91 90000 22222',
            'guest_count' => 2,
            'reservation_date' => $bookingDate,
            'reservation_time' => '23:15',
            'status' => 'confirmed',
        ]);

        $this->assertTrue(Reservation::hasTableConflict($smallTable->id, $bookingDate, '23:45'));
    }

    /**
     * Test placing an order automatically deducts Recipe BOM ingredients.
     */
    public function test_order_creation_auto_deducts_recipe_bom_inventory(): void
    {
        $recipe = RecipeIngredient::with(['menuItem', 'inventoryItem'])->firstOrFail();
        $invItem = $recipe->inventoryItem;
        $stockBefore = (float) $invItem->current_stock;

        $this->actingAs($this->manager)
            ->withHeaders([
                'X-Restaurant-ID' => $this->restaurant->id,
                'X-Branch-ID' => $this->branch->id,
            ])
            ->postJson('/api/v1/orders', [
                'order_type' => 'takeaway',
                'items' => [
                    ['menu_item_id' => $recipe->menu_item_id, 'quantity' => 1],
                ],
            ])
            ->assertStatus(201);

        $this->assertLessThan($stockBefore, (float) $invItem->fresh()->current_stock);
        $this->assertDatabaseHas('stock_movements', [
            'inventory_item_id' => $invItem->id,
            'movement_type' => 'order_deduction',
        ]);
    }
}
