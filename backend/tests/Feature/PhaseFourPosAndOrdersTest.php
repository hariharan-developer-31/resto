<?php

namespace Tests\Feature;

use App\Models\Addon;
use App\Models\Branch;
use App\Models\DiningTable;
use App\Models\MenuItem;
use App\Models\MenuVariant;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Restaurant;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhaseFourPosAndOrdersTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    /**
     * Test Cashier can create a new dine-in order with items, variants, and addons.
     */
    public function test_cashier_can_create_dine_in_order_with_items_and_addons(): void
    {
        $cashier = User::where('email', 'cashier@grandfeast.com')->first();
        $token = $cashier->createToken('cashier_token')->plainTextToken;
        $restaurant = Restaurant::first();
        $branch = Branch::first();
        $table = DiningTable::first();
        $menuItem = MenuItem::with(['variants', 'addons'])->first();
        $variant = $menuItem->variants->first();
        $addon = $menuItem->addons->first() ?? Addon::first();

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->withHeader('X-Restaurant-ID', (string) $restaurant->id)
            ->withHeader('X-Branch-ID', (string) $branch->id)
            ->postJson('/api/v1/orders', [
                'order_type' => 'dine_in',
                'table_id' => $table->id,
                'customer_name' => 'Rahul Sharma',
                'customer_phone' => '9876543210',
                'items' => [
                    [
                        'menu_item_id' => $menuItem->id,
                        'menu_variant_id' => $variant?->id,
                        'quantity' => 2,
                        'special_instructions' => 'Less spicy, please',
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
        $this->assertEquals('dine_in', $orderData['order_type']);
        $this->assertEquals('pending', $orderData['order_status']);
        $this->assertEquals('unpaid', $orderData['payment_status']);
        $this->assertEquals(1, $orderData['round_count']);

        // Check KOT ticket
        $kotNumber = $response->json('data.kot_number');
        $this->assertStringStartsWith('KOT-', $kotNumber);

        // Check table status became occupied
        $this->assertEquals('occupied', $table->fresh()->status);

        // Check items created
        $this->assertDatabaseHas('order_items', [
            'order_id' => $orderData['id'],
            'menu_item_id' => $menuItem->id,
            'quantity' => 2,
            'special_instructions' => 'Less spicy, please',
        ]);
    }

    /**
     * Test adding items to an occupied table appends a new order round.
     */
    public function test_adding_items_to_occupied_table_creates_new_order_round(): void
    {
        $cashier = User::where('email', 'cashier@grandfeast.com')->first();
        $token = $cashier->createToken('cashier_token')->plainTextToken;
        $restaurant = Restaurant::first();
        $branch = Branch::first();
        $table = DiningTable::first();
        $menuItems = MenuItem::take(2)->get();

        // Round 1
        $roundOneResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->withHeader('X-Restaurant-ID', (string) $restaurant->id)
            ->withHeader('X-Branch-ID', (string) $branch->id)
            ->postJson('/api/v1/orders', [
                'order_type' => 'dine_in',
                'table_id' => $table->id,
                'items' => [
                    [
                        'menu_item_id' => $menuItems[0]->id,
                        'quantity' => 1,
                    ],
                ],
            ]);

        $roundOneResponse->assertStatus(201);
        $orderId = $roundOneResponse->json('data.order.id');
        $roundOneTotal = (float) $roundOneResponse->json('data.order.total_amount');
        $kot1 = $roundOneResponse->json('data.kot_number');

        // Round 2 (additional items added to same table)
        $roundTwoResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->withHeader('X-Restaurant-ID', (string) $restaurant->id)
            ->withHeader('X-Branch-ID', (string) $branch->id)
            ->postJson('/api/v1/orders', [
                'order_type' => 'dine_in',
                'table_id' => $table->id,
                'items' => [
                    [
                        'menu_item_id' => $menuItems[1]->id,
                        'quantity' => 2,
                        'special_instructions' => 'Serve hot',
                    ],
                ],
            ]);

        $roundTwoResponse->assertStatus(201);
        $roundTwoOrder = $roundTwoResponse->json('data.order');

        // Order ID must be identical (same order session)
        $this->assertEquals($orderId, $roundTwoOrder['id']);
        // Round count must be incremented to 2
        $this->assertEquals(2, $roundTwoOrder['round_count']);
        // Grand total must be increased
        $this->assertGreaterThan($roundOneTotal, (float) $roundTwoOrder['total_amount']);

        // Distinct KOT ticket generated
        $kot2 = $roundTwoResponse->json('data.kot_number');
        $this->assertNotEquals($kot1, $kot2);

        // Verify order items have round_number 2
        $this->assertDatabaseHas('order_items', [
            'order_id' => $orderId,
            'menu_item_id' => $menuItems[1]->id,
            'round_number' => 2,
        ]);
    }

    /**
     * Test Waiter can update dish preparation status and mark served.
     */
    public function test_waiter_can_update_dish_status_to_served(): void
    {
        $waiter = User::where('email', 'waiter@grandfeast.com')->first();
        $token = $waiter->createToken('waiter_token')->plainTextToken;
        $restaurant = Restaurant::first();
        $branch = Branch::first();
        $menuItem = MenuItem::first();

        // Create an active order with an item
        $order = Order::create([
            'restaurant_id' => $restaurant->id,
            'branch_id' => $branch->id,
            'order_number' => Order::generateOrderNumber($branch->id),
            'order_type' => 'dine_in',
            'order_status' => 'pending',
            'payment_status' => 'unpaid',
            'subtotal' => 250.00,
            'tax_amount' => 12.50,
            'total_amount' => 262.50,
        ]);

        $orderItem = OrderItem::create([
            'order_id' => $order->id,
            'menu_item_id' => $menuItem->id,
            'round_number' => 1,
            'kot_number' => 'KOT-20261126-001',
            'item_name' => $menuItem->name,
            'quantity' => 1,
            'unit_price' => $menuItem->base_price,
            'subtotal' => $menuItem->base_price,
            'tax_rate' => 5.00,
            'tax_amount' => 12.50,
            'total_price' => 262.50,
            'status' => 'pending',
            'kitchen_station' => 'main',
        ]);

        // 1. Mark as preparing
        $prepResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->patchJson('/api/v1/order-items/' . $orderItem->id . '/status', [
                'status' => 'preparing',
            ]);

        $prepResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'preparing',
                ],
            ]);

        // 2. Mark as ready
        $readyResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->patchJson('/api/v1/order-items/' . $orderItem->id . '/status', [
                'status' => 'ready',
            ]);

        $readyResponse->assertStatus(200);

        // 3. Mark as served
        $servedResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->patchJson('/api/v1/order-items/' . $orderItem->id . '/status', [
                'status' => 'served',
            ]);

        $servedResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'served',
                ],
            ]);

        $this->assertNotNull($orderItem->fresh()->served_at);
    }

    /**
     * Test single-mode Cash bill settlement, invoice generation, change calculation, and table release.
     */
    public function test_bill_settlement_single_mode_cash(): void
    {
        $cashier = User::where('email', 'cashier@grandfeast.com')->first();
        $token = $cashier->createToken('cashier_token')->plainTextToken;
        $order = Order::where('payment_status', 'unpaid')
            ->where('order_status', '!=', 'cancelled')
            ->first();
        $table = $order->table;
        $totalAmount = (float) $order->total_amount;
        $tender = $totalAmount + 100.00;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/orders/' . $order->id . '/settle', [
                'payment_method' => 'cash',
                'paid_amount' => $tender,
                'table_status_after' => 'cleaning',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $data = $response->json('data');
        $this->assertStringStartsWith('INV-', $data['invoice_number']);
        $this->assertEquals(100.00, (float) $data['change_amount']);

        // Check Order is completed & paid
        $freshOrder = $order->fresh();
        $this->assertEquals('paid', $freshOrder->payment_status);
        $this->assertEquals('completed', $freshOrder->order_status);
        $this->assertEquals($tender, (float) $freshOrder->paid_amount);

        // Check Payment record created
        $this->assertDatabaseHas('payments', [
            'order_id' => $order->id,
            'payment_method' => 'cash',
            'status' => 'success',
        ]);

        // Check table status updated to cleaning
        if ($table) {
            $this->assertEquals('cleaning', $table->fresh()->status);
        }
    }

    /**
     * Test split payment settlement (Cash + UPI).
     */
    public function test_bill_settlement_split_mode(): void
    {
        $cashier = User::where('email', 'cashier@grandfeast.com')->first();
        $token = $cashier->createToken('cashier_token')->plainTextToken;
        $order = Order::where('payment_status', 'unpaid')
            ->where('order_status', '!=', 'cancelled')
            ->first();
        $total = (float) $order->total_amount;
        $part1 = round($total / 2, 2);
        $part2 = round($total - $part1, 2);

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/orders/' . $order->id . '/settle', [
                'payments' => [
                    [
                        'payment_method' => 'cash',
                        'amount' => $part1,
                    ],
                    [
                        'payment_method' => 'upi',
                        'amount' => $part2,
                        'transaction_reference' => 'UPI998877665544',
                    ],
                ],
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        // Check 2 payment entries created
        $payments = Payment::where('order_id', $order->id)->get();
        $this->assertCount(2, $payments);
    }

    /**
     * Test cannot settle an already paid order.
     */
    public function test_cannot_settle_already_paid_order(): void
    {
        $cashier = User::where('email', 'cashier@grandfeast.com')->first();
        $token = $cashier->createToken('cashier_token')->plainTextToken;
        $order = Order::where('payment_status', 'paid')->first();

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/orders/' . $order->id . '/settle', [
                'payment_method' => 'cash',
                'paid_amount' => 500.00,
            ]);

        $response->assertStatus(422);
    }

    /**
     * Test cannot settle with insufficient payment.
     */
    public function test_cannot_settle_with_insufficient_payment(): void
    {
        $cashier = User::where('email', 'cashier@grandfeast.com')->first();
        $token = $cashier->createToken('cashier_token')->plainTextToken;
        $order = Order::where('payment_status', 'unpaid')
            ->where('order_status', '!=', 'cancelled')
            ->first();

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/orders/' . $order->id . '/settle', [
                'payment_method' => 'cash',
                'paid_amount' => 10.00, // much less than total
            ]);

        $response->assertStatus(422);
    }

    /**
     * Test cancel order with reason and free table.
     */
    public function test_cancel_order_with_mandatory_reason_and_free_table(): void
    {
        $cashier = User::where('email', 'cashier@grandfeast.com')->first();
        $token = $cashier->createToken('cashier_token')->plainTextToken;
        $order = Order::where('payment_status', 'unpaid')
            ->where('order_status', '!=', 'cancelled')
            ->first();
        $table = $order->table;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/orders/' . $order->id . '/cancel', [
                'cancellation_reason' => 'Guest had an emergency and left before food preparation.',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'order_status' => 'cancelled',
                ],
            ]);

        $this->assertEquals('cancelled', $order->fresh()->order_status);
        $this->assertNotNull($order->fresh()->cancelled_at);

        // Check table returned to available
        if ($table) {
            $this->assertEquals('available', $table->fresh()->status);
        }
    }
}
