<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\BranchSetting;
use App\Models\Restaurant;
use App\Models\RestaurantSetting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Create Granular Permissions
        $permissions = [
            // Dashboard
            'dashboard.view',
            // Restaurants
            'restaurants.view',
            'restaurants.create',
            'restaurants.edit',
            'restaurants.delete',
            // Branches
            'branches.view',
            'branches.create',
            'branches.edit',
            'branches.delete',
            // Users
            'users.view',
            'users.create',
            'users.edit',
            'users.delete',
            // Roles & Permissions
            'roles.view',
            'roles.manage',
            // Menu
            'menu.view',
            'menu.create',
            'menu.edit',
            'menu.delete',
            // Tables
            'tables.view',
            'tables.manage',
            'tables.qr.generate',
            // Orders
            'orders.view',
            'orders.create',
            'orders.edit',
            'orders.cancel',
            'orders.transfer',
            // Kitchen
            'kitchen.view',
            'kitchen.manage',
            // Payments
            'payments.view',
            'payments.collect',
            'payments.refund',
            // Reservations
            'reservations.view',
            'reservations.manage',
            // Inventory
            'inventory.view',
            'inventory.manage',
            // Reports
            'reports.view',
            'reports.export',
            // Settings
            'settings.view',
            'settings.edit',
        ];

        foreach ($permissions as $permissionName) {
            Permission::firstOrCreate(['name' => $permissionName, 'guard_name' => 'sanctum']);
            Permission::firstOrCreate(['name' => $permissionName, 'guard_name' => 'web']);
        }

        // 2. Create Roles
        $superAdminRole = Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'sanctum']);
        Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);

        $restaurantAdminRole = Role::firstOrCreate(['name' => 'Restaurant Admin', 'guard_name' => 'sanctum']);
        $restaurantAdminWeb = Role::firstOrCreate(['name' => 'Restaurant Admin', 'guard_name' => 'web']);
        $restaurantAdminPermissions = [
            'dashboard.view',
            'branches.view', 'branches.create', 'branches.edit',
            'users.view', 'users.create', 'users.edit', 'users.delete',
            'roles.view',
            'menu.view', 'menu.create', 'menu.edit', 'menu.delete',
            'tables.view', 'tables.manage', 'tables.qr.generate',
            'orders.view', 'orders.create', 'orders.edit', 'orders.cancel', 'orders.transfer',
            'kitchen.view', 'kitchen.manage',
            'payments.view', 'payments.collect', 'payments.refund',
            'reservations.view', 'reservations.manage',
            'inventory.view', 'inventory.manage',
            'reports.view', 'reports.export',
            'settings.view', 'settings.edit',
        ];
        $restaurantAdminRole->syncPermissions($restaurantAdminPermissions);
        $restaurantAdminWeb->syncPermissions($restaurantAdminPermissions);

        $branchManagerRole = Role::firstOrCreate(['name' => 'Branch Manager', 'guard_name' => 'sanctum']);
        $branchManagerWeb = Role::firstOrCreate(['name' => 'Branch Manager', 'guard_name' => 'web']);
        $branchManagerPermissions = [
            'dashboard.view',
            'branches.view',
            'users.view',
            'menu.view', 'menu.create', 'menu.edit',
            'tables.view', 'tables.manage', 'tables.qr.generate',
            'orders.view', 'orders.create', 'orders.edit', 'orders.cancel', 'orders.transfer',
            'kitchen.view', 'kitchen.manage',
            'payments.view', 'payments.collect',
            'reservations.view', 'reservations.manage',
            'inventory.view', 'inventory.manage',
            'reports.view',
        ];
        $branchManagerRole->syncPermissions($branchManagerPermissions);
        $branchManagerWeb->syncPermissions($branchManagerPermissions);

        $cashierRole = Role::firstOrCreate(['name' => 'Cashier', 'guard_name' => 'sanctum']);
        $cashierWeb = Role::firstOrCreate(['name' => 'Cashier', 'guard_name' => 'web']);
        $cashierPermissions = [
            'dashboard.view',
            'menu.view',
            'tables.view',
            'orders.view', 'orders.create', 'orders.edit',
            'payments.view', 'payments.collect',
        ];
        $cashierRole->syncPermissions($cashierPermissions);
        $cashierWeb->syncPermissions($cashierPermissions);

        $waiterRole = Role::firstOrCreate(['name' => 'Waiter', 'guard_name' => 'sanctum']);
        $waiterWeb = Role::firstOrCreate(['name' => 'Waiter', 'guard_name' => 'web']);
        $waiterPermissions = [
            'menu.view',
            'tables.view',
            'orders.view', 'orders.create', 'orders.edit',
        ];
        $waiterRole->syncPermissions($waiterPermissions);
        $waiterWeb->syncPermissions($waiterPermissions);

        $kitchenRole = Role::firstOrCreate(['name' => 'Kitchen Staff', 'guard_name' => 'sanctum']);
        $kitchenWeb = Role::firstOrCreate(['name' => 'Kitchen Staff', 'guard_name' => 'web']);
        $kitchenPermissions = [
            'kitchen.view', 'kitchen.manage',
            'orders.view',
        ];
        $kitchenRole->syncPermissions($kitchenPermissions);
        $kitchenWeb->syncPermissions($kitchenPermissions);

        Role::firstOrCreate(['name' => 'Customer', 'guard_name' => 'sanctum']);
        Role::firstOrCreate(['name' => 'Customer', 'guard_name' => 'web']);

        // 3. Create Super Admin User
        $superAdmin = User::firstOrCreate(
            ['email' => 'superadmin@resto.com'],
            [
                'name' => 'Super Administrator',
                'username' => 'superadmin',
                'phone' => '+91 98765 00000',
                'password' => Hash::make('password123'),
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );
        $superAdmin->assignRole('Super Admin');

        // 4. Create Sample Restaurant & Branches
        $restaurant = Restaurant::firstOrCreate(
            ['slug' => 'the-grand-feast'],
            [
                'name' => 'The Grand Feast',
                'description' => 'Fine dining and contemporary multi-cuisine restaurant specializing in authentic tastes and artisanal dishes.',
                'phone' => '+91 98765 43210',
                'email' => 'contact@grandfeast.com',
                'website' => 'https://grandfeast.resto-os.com',
                'gst_number' => '33AAAAA0000A1Z5',
                'currency' => 'INR',
                'currency_symbol' => '₹',
                'timezone' => 'Asia/Kolkata',
                'primary_color' => '#C76B4A',
                'is_active' => true,
            ]
        );

        RestaurantSetting::updateOrCreate(
            ['restaurant_id' => $restaurant->id, 'key' => 'general'],
            ['value' => json_encode([
                'order_prefix' => 'TGF-',
                'enable_qr_ordering' => true,
                'enable_table_reservation' => true,
                'auto_accept_orders' => false,
                'tax_type' => 'exclusive',
            ])]
        );

        $branch1 = Branch::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Downtown Flagship'],
            [
                'code' => 'DWT-01',
                'phone' => '+91 98765 43211',
                'email' => 'downtown@grandfeast.com',
                'address' => '42 Anna Salai, Thousand Lights',
                'city' => 'Chennai',
                'state' => 'Tamil Nadu',
                'postal_code' => '600006',
                'is_main_branch' => true,
                'is_active' => true,
                'opening_time' => '11:00',
                'closing_time' => '23:00',
                'tax_rate' => 5.00,
            ]
        );

        $branch2 = Branch::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Seaside Bistro'],
            [
                'code' => 'SSB-02',
                'phone' => '+91 98765 43212',
                'email' => 'seaside@grandfeast.com',
                'address' => '18 Beach Road, Besant Nagar',
                'city' => 'Chennai',
                'state' => 'Tamil Nadu',
                'postal_code' => '600090',
                'is_main_branch' => false,
                'is_active' => true,
                'opening_time' => '12:00',
                'closing_time' => '23:30',
                'tax_rate' => 5.00,
            ]
        );

        BranchSetting::updateOrCreate(
            ['branch_id' => $branch1->id, 'key' => 'operations'],
            ['value' => json_encode([
                'table_count' => 24,
                'service_charge_percent' => 0,
                'allow_takeaway' => true,
            ])]
        );

        // 5. Create Restaurant Staff Users
        $restAdmin = User::firstOrCreate(
            ['email' => 'admin@grandfeast.com'],
            [
                'name' => 'Rajesh Sharma (Admin)',
                'username' => 'rajesh_admin',
                'phone' => '+91 98765 11111',
                'password' => Hash::make('password123'),
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );
        $restAdmin->assignRole('Restaurant Admin');
        $restAdmin->restaurants()->syncWithoutDetaching([$restaurant->id]);
        $restAdmin->branches()->syncWithoutDetaching([$branch1->id, $branch2->id]);

        $manager = User::firstOrCreate(
            ['email' => 'manager@grandfeast.com'],
            [
                'name' => 'Priya Patel (Manager)',
                'username' => 'priya_mgr',
                'phone' => '+91 98765 22222',
                'password' => Hash::make('password123'),
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );
        $manager->assignRole('Branch Manager');
        $manager->restaurants()->syncWithoutDetaching([$restaurant->id]);
        $manager->branches()->syncWithoutDetaching([$branch1->id]);

        $cashier = User::firstOrCreate(
            ['email' => 'cashier@grandfeast.com'],
            [
                'name' => 'Karthik Raja (Cashier)',
                'username' => 'karthik_pos',
                'phone' => '+91 98765 33333',
                'password' => Hash::make('password123'),
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );
        $cashier->assignRole('Cashier');
        $cashier->restaurants()->syncWithoutDetaching([$restaurant->id]);
        $cashier->branches()->syncWithoutDetaching([$branch1->id]);

        $waiter = User::firstOrCreate(
            ['email' => 'waiter@grandfeast.com'],
            [
                'name' => 'Arun Kumar (Waiter)',
                'username' => 'arun_waiter',
                'phone' => '+91 98765 44444',
                'password' => Hash::make('password123'),
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );
        $waiter->assignRole('Waiter');
        $waiter->restaurants()->syncWithoutDetaching([$restaurant->id]);
        $waiter->branches()->syncWithoutDetaching([$branch1->id]);

        $kitchen = User::firstOrCreate(
            ['email' => 'kitchen@grandfeast.com'],
            [
                'name' => 'Chef Suresh (Kitchen)',
                'username' => 'suresh_chef',
                'phone' => '+91 98765 55555',
                'password' => Hash::make('password123'),
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );
        $kitchen->assignRole('Kitchen Staff');
        $kitchen->restaurants()->syncWithoutDetaching([$restaurant->id]);
        $kitchen->branches()->syncWithoutDetaching([$branch1->id]);

        // 6. Seed Sample Tables for Real Analytics
        $t1 = \App\Models\DiningTable::firstOrCreate(
            ['branch_id' => $branch1->id, 'table_number' => 'T-01'],
            ['restaurant_id' => $restaurant->id, 'seating_capacity' => 4, 'status' => 'occupied', 'qr_token' => \Illuminate\Support\Str::random(32)]
        );
        $t2 = \App\Models\DiningTable::firstOrCreate(
            ['branch_id' => $branch1->id, 'table_number' => 'T-02'],
            ['restaurant_id' => $restaurant->id, 'seating_capacity' => 2, 'status' => 'available', 'qr_token' => \Illuminate\Support\Str::random(32)]
        );
        $t3 = \App\Models\DiningTable::firstOrCreate(
            ['branch_id' => $branch1->id, 'table_number' => 'T-03'],
            ['restaurant_id' => $restaurant->id, 'seating_capacity' => 6, 'status' => 'reserved', 'qr_token' => \Illuminate\Support\Str::random(32)]
        );
        $t4 = \App\Models\DiningTable::firstOrCreate(
            ['branch_id' => $branch1->id, 'table_number' => 'T-04'],
            ['restaurant_id' => $restaurant->id, 'seating_capacity' => 4, 'status' => 'occupied', 'qr_token' => \Illuminate\Support\Str::random(32)]
        );

        // 7. Seed Sample Orders for Real Financial & Operational Metrics
        \App\Models\Order::firstOrCreate(
            ['order_number' => 'ORD-1001'],
            [
                'restaurant_id' => $restaurant->id,
                'branch_id' => $branch1->id,
                'table_id' => $t1->id,
                'waiter_id' => $waiter->id,
                'order_type' => 'dine_in',
                'order_status' => 'completed',
                'payment_status' => 'paid',
                'subtotal' => 1250.00,
                'tax_amount' => 62.50,
                'discount_amount' => 0.00,
                'total_amount' => 1312.50,
                'created_at' => now(),
            ]
        );
        \App\Models\Order::firstOrCreate(
            ['order_number' => 'ORD-1002'],
            [
                'restaurant_id' => $restaurant->id,
                'branch_id' => $branch1->id,
                'table_id' => $t4->id,
                'waiter_id' => $waiter->id,
                'order_type' => 'dine_in',
                'order_status' => 'preparing',
                'payment_status' => 'unpaid',
                'subtotal' => 840.00,
                'tax_amount' => 42.00,
                'discount_amount' => 50.00,
                'total_amount' => 832.00,
                'created_at' => now(),
            ]
        );
        \App\Models\Order::firstOrCreate(
            ['order_number' => 'ORD-1003'],
            [
                'restaurant_id' => $restaurant->id,
                'branch_id' => $branch1->id,
                'table_id' => null,
                'waiter_id' => null,
                'order_type' => 'takeaway',
                'order_status' => 'completed',
                'payment_status' => 'paid',
                'subtotal' => 450.00,
                'tax_amount' => 22.50,
                'discount_amount' => 0.00,
                'total_amount' => 472.50,
                'created_at' => now(),
            ]
        );
        \App\Models\Order::firstOrCreate(
            ['order_number' => 'ORD-1004'],
            [
                'restaurant_id' => $restaurant->id,
                'branch_id' => $branch1->id,
                'table_id' => null,
                'waiter_id' => null,
                'order_type' => 'takeaway',
                'order_status' => 'cancelled',
                'payment_status' => 'unpaid',
                'subtotal' => 300.00,
                'tax_amount' => 15.00,
                'discount_amount' => 0.00,
                'total_amount' => 315.00,
                'cancellation_reason' => 'Customer requested cancellation prior to kitchen acceptance',
                'cancelled_at' => now(),
                'created_at' => now(),
            ]
        );

        // 8. Seed Sample Reservations
        \App\Models\Reservation::firstOrCreate(
            ['customer_phone' => '+91 99887 76655', 'reservation_date' => now()->toDateString()],
            [
                'restaurant_id' => $restaurant->id,
                'branch_id' => $branch1->id,
                'table_id' => $t3->id,
                'customer_name' => 'Aditya Verma',
                'customer_email' => 'aditya@example.com',
                'guest_count' => 4,
                'reservation_time' => '19:30',
                'status' => 'confirmed',
                'special_requests' => 'Window seating preferred',
            ]
        );

        // 9. Seed Menu Categories & Subcategories
        $catBiryani = \App\Models\Category::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'slug' => 'biryani'],
            ['name' => 'Biryani Specialties', 'description' => 'Aromatic slow-cooked Dum biryanis with fragrant long-grain Basmati rice.', 'sort_order' => 1, 'is_active' => true]
        );
        $catStarters = \App\Models\Category::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'slug' => 'starters'],
            ['name' => 'Starters & Appetizers', 'description' => 'Crispy delicacies, clay-oven tandoor kebabs, and appetizers.', 'sort_order' => 2, 'is_active' => true]
        );
        $catMain = \App\Models\Category::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'slug' => 'main-course'],
            ['name' => 'Main Course Curries', 'description' => 'Rich, traditional gravies cooked with freshly ground spices.', 'sort_order' => 3, 'is_active' => true]
        );
        $catChinese = \App\Models\Category::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'slug' => 'chinese'],
            ['name' => 'Wok & Chinese', 'description' => 'Stir-fried noodles, rice bowls, and sizzling wok specialties.', 'sort_order' => 4, 'is_active' => true]
        );
        $catBeverages = \App\Models\Category::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'slug' => 'beverages'],
            ['name' => 'Artisanal Beverages', 'description' => 'Freshly squeezed juices, hand-churned lassis, coolers and sodas.', 'sort_order' => 5, 'is_active' => true]
        );
        $catDesserts = \App\Models\Category::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'slug' => 'desserts'],
            ['name' => 'Desserts & Sweets', 'description' => 'Classic Indian desserts, rich puddings, and ice creams.', 'sort_order' => 6, 'is_active' => true]
        );

        // 10. Seed Addons
        $addonChicken = \App\Models\Addon::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Extra Chicken Pieces'],
            ['price' => 70.00, 'is_active' => true]
        );
        $addonEgg = \App\Models\Addon::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Extra Boiled Egg'],
            ['price' => 25.00, 'is_active' => true]
        );
        $addonRaita = \App\Models\Addon::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Extra Onion Raita & Mirchi Ka Salan'],
            ['price' => 30.00, 'is_active' => true]
        );
        $addonCheese = \App\Models\Addon::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Grated Amul Cheese Topping'],
            ['price' => 40.00, 'is_active' => true]
        );

        // 11. Seed Menu Items
        $biryaniItem = \App\Models\MenuItem::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'slug' => 'chicken-biryani'],
            [
                'category_id' => $catBiryani->id,
                'name' => 'Chicken Dum Biryani',
                'description' => 'Tender chicken marinated in yogurt and traditional spices, slow-cooked in sealed handi with premium basmati rice.',
                'base_price' => 200.00,
                'type' => 'non_veg',
                'preparation_time' => 15,
                'is_available' => true,
                'is_featured' => true,
                'kitchen_station' => 'main',
                'sort_order' => 1,
            ]
        );
        $biryaniItem->addons()->syncWithoutDetaching([$addonChicken->id, $addonEgg->id, $addonRaita->id]);

        \App\Models\MenuVariant::firstOrCreate(
            ['menu_item_id' => $biryaniItem->id, 'name' => 'Regular (Serves 1)'],
            ['price' => 200.00, 'is_default' => true]
        );
        \App\Models\MenuVariant::firstOrCreate(
            ['menu_item_id' => $biryaniItem->id, 'name' => 'Large (Serves 2)'],
            ['price' => 290.00, 'is_default' => false]
        );
        \App\Models\MenuVariant::firstOrCreate(
            ['menu_item_id' => $biryaniItem->id, 'name' => 'Family Pack (Serves 4)'],
            ['price' => 550.00, 'is_default' => false]
        );

        $paneerItem = \App\Models\MenuItem::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'slug' => 'paneer-butter-masala'],
            [
                'category_id' => $catMain->id,
                'name' => 'Paneer Butter Masala',
                'description' => 'Soft cottage cheese cubes simmered in a velvet tomato, butter, and cashew cream gravy flavored with kasoori methi.',
                'base_price' => 180.00,
                'type' => 'veg',
                'preparation_time' => 12,
                'is_available' => true,
                'is_featured' => true,
                'kitchen_station' => 'main',
                'sort_order' => 2,
            ]
        );
        $paneerItem->addons()->syncWithoutDetaching([$addonCheese->id]);

        $dragonItem = \App\Models\MenuItem::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'slug' => 'dragon-chicken'],
            [
                'category_id' => $catChinese->id,
                'name' => 'Fiery Dragon Chicken',
                'description' => 'Crispy fried chicken strips tossed with crunchy cashew nuts, bell peppers, dried red chilies, and tangy soy-chili sauce.',
                'base_price' => 220.00,
                'type' => 'non_veg',
                'preparation_time' => 14,
                'is_available' => true,
                'kitchen_station' => 'grill',
                'sort_order' => 3,
            ]
        );

        $lassiItem = \App\Models\MenuItem::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'slug' => 'alphonso-mango-lassi'],
            [
                'category_id' => $catBeverages->id,
                'name' => 'Alphonso Mango Lassi',
                'description' => 'Creamy hand-churned yogurt blended with authentic Ratnagiri Alphonso mango pulp and a hint of cardamom.',
                'base_price' => 90.00,
                'type' => 'veg',
                'preparation_time' => 5,
                'is_available' => true,
                'kitchen_station' => 'beverage',
                'sort_order' => 4,
            ]
        );

        $dessertItem = \App\Models\MenuItem::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'slug' => 'gulab-jamun-ice-cream'],
            [
                'category_id' => $catDesserts->id,
                'name' => 'Hot Gulab Jamun with Vanilla Bean Ice Cream',
                'description' => 'Warm khoya dumplings soaked in saffron-rose syrup, served over cold artisanal vanilla bean ice cream.',
                'base_price' => 110.00,
                'type' => 'veg',
                'preparation_time' => 6,
                'is_available' => true,
                'kitchen_station' => 'dessert',
                'sort_order' => 5,
            ]
        );

        // 12. Update Dining Tables with Locations, Waiter, and Secure QR Tokens
        $t1->update(['location' => 'AC Dining Hall', 'waiter_id' => $waiter->id, 'qr_token' => 'tbl_' . \Illuminate\Support\Str::random(32), 'qr_generated_at' => now()]);
        $t2->update(['location' => 'Indoor Garden', 'waiter_id' => null, 'qr_token' => 'tbl_' . \Illuminate\Support\Str::random(32), 'qr_generated_at' => now()]);
        $t3->update(['location' => 'Open Rooftop', 'waiter_id' => null, 'qr_token' => 'tbl_' . \Illuminate\Support\Str::random(32), 'qr_generated_at' => now()]);
        $t4->update(['location' => 'Patio Deck', 'waiter_id' => $waiter->id, 'qr_token' => 'tbl_' . \Illuminate\Support\Str::random(32), 'qr_generated_at' => now()]);

        \App\Models\DiningTable::firstOrCreate(
            ['branch_id' => $branch1->id, 'table_number' => 'T-05'],
            ['restaurant_id' => $restaurant->id, 'seating_capacity' => 8, 'location' => 'Private Dining Suite', 'status' => 'available', 'qr_token' => 'tbl_' . \Illuminate\Support\Str::random(32), 'qr_generated_at' => now()]
        );
        \App\Models\DiningTable::firstOrCreate(
            ['branch_id' => $branch1->id, 'table_number' => 'T-06'],
            ['restaurant_id' => $restaurant->id, 'seating_capacity' => 2, 'location' => 'Bar Counter', 'status' => 'cleaning', 'qr_token' => 'tbl_' . \Illuminate\Support\Str::random(32), 'qr_generated_at' => now()]
        );

        // 13. Seed Suppliers (Phase 7)
        $supMeat = \App\Models\Supplier::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Apex Farm Fresh Meats'],
            [
                'contact_person' => 'Rajesh Sharma',
                'phone' => '+91 98200 11223',
                'email' => 'rajesh@apexmeats.example.com',
                'address' => 'Gala 14, Wholesale APMC Market, Vashi',
                'tax_number' => '27AAACA1234A1Z5',
                'payment_terms' => 'net_30',
                'status' => 'active',
            ]
        );

        $supDairy = \App\Models\Supplier::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Heritage Dairy & Spices Ltd'],
            [
                'contact_person' => 'Kavita Patel',
                'phone' => '+91 98300 44556',
                'email' => 'orders@heritagedairy.example.com',
                'address' => 'Plot 88, Industrial Food Park, Chakan',
                'tax_number' => '27AABCH9988C1Z2',
                'payment_terms' => 'net_15',
                'status' => 'active',
            ]
        );

        // 14. Seed Inventory Items (Phase 7)
        $itemRice = \App\Models\InventoryItem::firstOrCreate(
            ['branch_id' => $branch1->id, 'sku' => 'ING-RICE-01'],
            [
                'restaurant_id' => $restaurant->id,
                'supplier_id' => $supDairy->id,
                'name' => 'Royal Daawat Basmati Rice (Aged 2 Yrs)',
                'category' => 'dry_goods',
                'unit' => 'kg',
                'current_stock' => 50.000,
                'minimum_stock' => 20.000,
                'unit_cost' => 95.00,
                'storage_location' => 'Dry Store Room A',
                'status' => 'in_stock',
            ]
        );

        $itemChicken = \App\Models\InventoryItem::firstOrCreate(
            ['branch_id' => $branch1->id, 'sku' => 'ING-CHIK-01'],
            [
                'restaurant_id' => $restaurant->id,
                'supplier_id' => $supMeat->id,
                'name' => 'Tender Chicken Breast Boneless',
                'category' => 'poultry',
                'unit' => 'kg',
                'current_stock' => 6.500,
                'minimum_stock' => 15.000,
                'unit_cost' => 260.00,
                'storage_location' => 'Walk-in Chiller #2',
                'status' => 'low_stock',
            ]
        );

        $itemPaneer = \App\Models\InventoryItem::firstOrCreate(
            ['branch_id' => $branch1->id, 'sku' => 'ING-PAN-01'],
            [
                'restaurant_id' => $restaurant->id,
                'supplier_id' => $supDairy->id,
                'name' => 'Artisanal Malai Paneer Blocks',
                'category' => 'dairy',
                'unit' => 'kg',
                'current_stock' => 0.000,
                'minimum_stock' => 8.000,
                'unit_cost' => 340.00,
                'storage_location' => 'Walk-in Chiller #1',
                'status' => 'out_of_stock',
            ]
        );

        $itemGhee = \App\Models\InventoryItem::firstOrCreate(
            ['branch_id' => $branch1->id, 'sku' => 'ING-GHEE-01'],
            [
                'restaurant_id' => $restaurant->id,
                'supplier_id' => $supDairy->id,
                'name' => 'Bilona Cow Ghee Pure',
                'category' => 'dairy',
                'unit' => 'l',
                'current_stock' => 18.000,
                'minimum_stock' => 5.000,
                'unit_cost' => 750.00,
                'storage_location' => 'Chef Prep Station Counter',
                'status' => 'in_stock',
            ]
        );

        // 15. Seed Recipe BOM for Biryani Item
        if ($biryaniItem) {
            \App\Models\RecipeIngredient::firstOrCreate(
                ['menu_item_id' => $biryaniItem->id, 'inventory_item_id' => $itemRice->id, 'menu_variant_id' => null],
                ['quantity_required' => 0.300, 'unit' => 'kg']
            );
            \App\Models\RecipeIngredient::firstOrCreate(
                ['menu_item_id' => $biryaniItem->id, 'inventory_item_id' => $itemChicken->id, 'menu_variant_id' => null],
                ['quantity_required' => 0.400, 'unit' => 'kg']
            );
            \App\Models\RecipeIngredient::firstOrCreate(
                ['menu_item_id' => $biryaniItem->id, 'inventory_item_id' => $itemGhee->id, 'menu_variant_id' => null],
                ['quantity_required' => 0.050, 'unit' => 'l']
            );
        }

        // 16. Seed Purchase Order
        $po = \App\Models\PurchaseOrder::firstOrCreate(
            ['po_number' => 'PO-20261126-001'],
            [
                'restaurant_id' => $restaurant->id,
                'branch_id' => $branch1->id,
                'supplier_id' => $supMeat->id,
                'order_date' => now()->toDateString(),
                'expected_delivery_date' => now()->addDay()->toDateString(),
                'status' => 'ordered',
                'subtotal' => 5200.00,
                'tax_amount' => 260.00,
                'total_amount' => 5460.00,
                'notes' => 'Urgent replenishment for weekend biryani service',
                'created_by' => $superAdmin->id,
            ]
        );

        \App\Models\PurchaseOrderItem::firstOrCreate(
            ['purchase_order_id' => $po->id, 'inventory_item_id' => $itemChicken->id],
            [
                'quantity_ordered' => 20.000,
                'quantity_received' => 0.000,
                'unit_cost' => 260.00,
                'total_price' => 5200.00,
            ]
        );

        // Audit log of system initial setup
        AuditLog::create([
            'restaurant_id' => $restaurant->id,
            'branch_id' => $branch1->id,
            'user_id' => $superAdmin->id,
            'action' => 'system.initialized',
            'auditable_type' => Restaurant::class,
            'auditable_id' => $restaurant->id,
            'new_values' => ['name' => $restaurant->name, 'status' => 'initialized'],
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Seeder Engine',
        ]);
    }
}
