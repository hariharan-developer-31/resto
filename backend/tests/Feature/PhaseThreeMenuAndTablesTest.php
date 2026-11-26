<?php

namespace Tests\Feature;

use App\Models\Addon;
use App\Models\Branch;
use App\Models\Category;
use App\Models\DiningTable;
use App\Models\MenuItem;
use App\Models\Restaurant;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhaseThreeMenuAndTablesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    /**
     * Test Category CRUD and prevention of deletion when items exist.
     */
    public function test_category_lifecycle_and_deletion_safeguard(): void
    {
        $superAdmin = User::where('email', 'superadmin@resto.com')->first();
        $token = $superAdmin->createToken('admin_token')->plainTextToken;
        $restaurant = Restaurant::first();

        // 1. Create a new Category
        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->withHeader('X-Restaurant-ID', (string) $restaurant->id)
            ->postJson('/api/v1/categories', [
                'name' => 'Tandoori Platters',
                'description' => 'Smoky tandoori delicacies',
                'sort_order' => 10,
                'is_active' => true,
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Tandoori Platters',
                    'slug' => 'tandoori-platters',
                ],
            ]);

        $newCategoryId = $response->json('data.id');

        // 2. Add an item into this category
        $branch = Branch::first();
        $item = MenuItem::create([
            'restaurant_id' => $restaurant->id,
            'branch_id' => $branch->id,
            'category_id' => $newCategoryId,
            'name' => 'Tandoori Paneer Tikka',
            'slug' => 'tandoori-paneer-tikka',
            'type' => 'veg',
            'base_price' => 280.00,
            'tax_rate' => 5.00,
            'kitchen_station' => 'tandoor',
            'is_available' => true,
        ]);

        // 3. Attempt to delete category with items - must fail with 422
        $deleteAttempt = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->withHeader('X-Restaurant-ID', (string) $restaurant->id)
            ->deleteJson('/api/v1/categories/' . $newCategoryId);

        $deleteAttempt->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        // 4. Delete the item and then delete the category
        $item->delete();

        $deleteSuccess = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->withHeader('X-Restaurant-ID', (string) $restaurant->id)
            ->deleteJson('/api/v1/categories/' . $newCategoryId);

        $deleteSuccess->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }

    /**
     * Test Menu Item creation with variants and addons.
     */
    public function test_menu_item_creation_with_variants_and_addons(): void
    {
        $superAdmin = User::where('email', 'superadmin@resto.com')->first();
        $token = $superAdmin->createToken('admin_token')->plainTextToken;
        $restaurant = Restaurant::first();
        $branch = Branch::first();
        $category = Category::first();
        $addon = Addon::first();

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->withHeader('X-Restaurant-ID', (string) $restaurant->id)
            ->withHeader('X-Branch-ID', (string) $branch->id)
            ->postJson('/api/v1/menu-items', [
                'category_id' => $category->id,
                'name' => 'Royal Hyderabadi Dum Biryani',
                'description' => 'Slow cooked aromatic basmati rice with fragrant spices',
                'type' => 'non-veg',
                'base_price' => 320.00,
                'tax_rate' => 5.00,
                'preparation_time' => 25,
                'kitchen_station' => 'biryani',
                'is_featured' => true,
                'variants' => [
                    [
                        'name' => 'Regular',
                        'price' => 320.00,
                        'is_default' => true,
                    ],
                    [
                        'name' => 'Jumbo Family Pack',
                        'price' => 850.00,
                        'is_default' => false,
                    ],
                ],
                'addon_ids' => [$addon->id],
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Royal Hyderabadi Dum Biryani',
                    'base_price' => 320.00,
                ],
            ]);

        $this->assertCount(2, $response->json('data.variants'));
        $this->assertCount(1, $response->json('data.addons'));
    }

    /**
     * Test Menu Item availability toggle endpoint.
     */
    public function test_menu_item_availability_toggle(): void
    {
        $superAdmin = User::where('email', 'superadmin@resto.com')->first();
        $token = $superAdmin->createToken('admin_token')->plainTextToken;
        $item = MenuItem::first();
        $initialState = $item->is_available;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/menu-items/' . $item->id . '/toggle-availability');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'is_available' => !$initialState,
                ],
            ]);

        $this->assertEquals(!$initialState, $item->fresh()->is_available);
    }

    /**
     * Test Addon creation and listing.
     */
    public function test_addon_management(): void
    {
        $superAdmin = User::where('email', 'superadmin@resto.com')->first();
        $token = $superAdmin->createToken('admin_token')->plainTextToken;
        $restaurant = Restaurant::first();

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->withHeader('X-Restaurant-ID', (string) $restaurant->id)
            ->postJson('/api/v1/addons', [
                'name' => 'Extra Salan Gravy',
                'price' => 40.00,
                'is_active' => true,
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Extra Salan Gravy',
                    'price' => 40.00,
                ],
            ]);

        $listResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->withHeader('X-Restaurant-ID', (string) $restaurant->id)
            ->getJson('/api/v1/addons');

        $listResponse->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertGreaterThanOrEqual(1, count($listResponse->json('data')));
    }

    /**
     * Test Table creation and unique table number per branch constraint.
     */
    public function test_dining_table_creation_and_uniqueness_per_branch(): void
    {
        $superAdmin = User::where('email', 'superadmin@resto.com')->first();
        $token = $superAdmin->createToken('admin_token')->plainTextToken;
        $restaurant = Restaurant::first();
        $branch = Branch::first();

        // 1. Create table T-99
        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->withHeader('X-Restaurant-ID', (string) $restaurant->id)
            ->withHeader('X-Branch-ID', (string) $branch->id)
            ->postJson('/api/v1/tables', [
                'table_number' => 'T-99',
                'seating_capacity' => 6,
                'location' => 'Rooftop Terrace',
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'table_number' => 'T-99',
                    'seating_capacity' => 6,
                    'status' => 'available',
                ],
            ]);

        // QR Token should automatically be generated and start with tbl_
        $qrToken = $response->json('data.qr_token');
        $this->assertStringStartsWith('tbl_', $qrToken);
        $this->assertEquals(36, strlen($qrToken)); // tbl_ (4) + 32 chars = 36

        // 2. Duplicate table number in same branch should fail
        $duplicateResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->withHeader('X-Restaurant-ID', (string) $restaurant->id)
            ->withHeader('X-Branch-ID', (string) $branch->id)
            ->postJson('/api/v1/tables', [
                'table_number' => 'T-99',
                'seating_capacity' => 4,
            ]);

        $duplicateResponse->assertStatus(422);
    }

    /**
     * Test QR Token regeneration and verification of unpredictable token.
     */
    public function test_table_qr_token_regeneration(): void
    {
        $superAdmin = User::where('email', 'superadmin@resto.com')->first();
        $token = $superAdmin->createToken('admin_token')->plainTextToken;
        $table = DiningTable::first();
        $originalQrToken = $table->qr_token;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/tables/' . $table->id . '/generate-qr');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $newQrToken = $response->json('data.qr_token');
        $this->assertNotEquals($originalQrToken, $newQrToken);
        $this->assertStringStartsWith('tbl_', $newQrToken);
        $this->assertEquals(36, strlen($newQrToken));
        $this->assertNotNull($response->json('data.qr_generated_at'));
    }

    /**
     * Test table status change and waiter assignment.
     */
    public function test_table_status_and_waiter_assignment(): void
    {
        $superAdmin = User::where('email', 'superadmin@resto.com')->first();
        $token = $superAdmin->createToken('admin_token')->plainTextToken;
        $table = DiningTable::first();
        $waiter = User::where('email', 'waiter@grandfeast.com')->first();

        // 1. Update Status to occupied
        $statusResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->patchJson('/api/v1/tables/' . $table->id . '/status', [
                'status' => 'occupied',
            ]);

        $statusResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'occupied',
                ],
            ]);

        // 2. Assign Waiter
        $waiterResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->patchJson('/api/v1/tables/' . $table->id . '/waiter', [
                'waiter_id' => $waiter->id,
            ]);

        $waiterResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'waiter_id' => $waiter->id,
                ],
            ]);

        $this->assertEquals($waiter->id, $table->fresh()->waiter_id);
    }

    /**
     * Test occupied table cannot be deleted.
     */
    public function test_occupied_table_cannot_be_deleted(): void
    {
        $superAdmin = User::where('email', 'superadmin@resto.com')->first();
        $token = $superAdmin->createToken('admin_token')->plainTextToken;
        $table = DiningTable::first();
        $table->update(['status' => 'occupied']);

        $deleteResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson('/api/v1/tables/' . $table->id);

        $deleteResponse->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertNotNull(DiningTable::find($table->id));
    }
}
