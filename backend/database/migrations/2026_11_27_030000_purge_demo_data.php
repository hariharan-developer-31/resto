<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Permanently purge all seeded demo data while preserving roles,
     * permissions, and the Super Admin account.
     */
    public function up(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        $demoEmails = [
            'admin@grandfeast.com',
            'manager@grandfeast.com',
            'cashier@grandfeast.com',
            'waiter@grandfeast.com',
            'kitchen@grandfeast.com',
        ];

        $demoRestaurantIds = Schema::hasTable('restaurants')
            ? DB::table('restaurants')->where('slug', 'the-grand-feast')->pluck('id')->all()
            : [];

        $demoUserIds = Schema::hasTable('users')
            ? DB::table('users')->whereIn('email', $demoEmails)->pluck('id')->all()
            : [];

        DB::transaction(function () use ($demoRestaurantIds, $demoUserIds) {
            if (!empty($demoRestaurantIds)) {
                $branchIds = Schema::hasTable('branches')
                    ? DB::table('branches')->whereIn('restaurant_id', $demoRestaurantIds)->pluck('id')->all()
                    : [];

                if (Schema::hasTable('notifications')) {
                    DB::table('notifications')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (Schema::hasTable('audit_logs')) {
                    DB::table('audit_logs')
                        ->whereIn('restaurant_id', $demoRestaurantIds)
                        ->orWhere('action', 'system.initialized')
                        ->delete();
                }
                if (Schema::hasTable('activity_logs')) {
                    DB::table('activity_logs')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (Schema::hasTable('stock_movements')) {
                    DB::table('stock_movements')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (Schema::hasTable('payments')) {
                    DB::table('payments')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (Schema::hasTable('orders')) {
                    $orderIds = DB::table('orders')->whereIn('restaurant_id', $demoRestaurantIds)->pluck('id')->all();
                    if (!empty($orderIds) && Schema::hasTable('order_items')) {
                        $itemIds = DB::table('order_items')->whereIn('order_id', $orderIds)->pluck('id')->all();
                        if (!empty($itemIds) && Schema::hasTable('order_item_addons')) {
                            DB::table('order_item_addons')->whereIn('order_item_id', $itemIds)->delete();
                        }
                        DB::table('order_items')->whereIn('order_id', $orderIds)->delete();
                    }
                    DB::table('orders')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (Schema::hasTable('reservations')) {
                    DB::table('reservations')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (Schema::hasTable('purchase_orders')) {
                    $poIds = DB::table('purchase_orders')->whereIn('restaurant_id', $demoRestaurantIds)->pluck('id')->all();
                    if (!empty($poIds) && Schema::hasTable('purchase_order_items')) {
                        DB::table('purchase_order_items')->whereIn('purchase_order_id', $poIds)->delete();
                    }
                    DB::table('purchase_orders')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (Schema::hasTable('inventory_items')) {
                    $invIds = DB::table('inventory_items')->whereIn('restaurant_id', $demoRestaurantIds)->pluck('id')->all();
                    if (!empty($invIds) && Schema::hasTable('recipe_ingredients')) {
                        DB::table('recipe_ingredients')->whereIn('inventory_item_id', $invIds)->delete();
                    }
                    DB::table('inventory_items')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (Schema::hasTable('suppliers')) {
                    DB::table('suppliers')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (Schema::hasTable('menu_items')) {
                    $menuIds = DB::table('menu_items')->whereIn('restaurant_id', $demoRestaurantIds)->pluck('id')->all();
                    if (!empty($menuIds)) {
                        if (Schema::hasTable('menu_item_addons')) {
                            DB::table('menu_item_addons')->whereIn('menu_item_id', $menuIds)->delete();
                        }
                        if (Schema::hasTable('menu_variants')) {
                            DB::table('menu_variants')->whereIn('menu_item_id', $menuIds)->delete();
                        }
                        if (Schema::hasTable('recipe_ingredients')) {
                            DB::table('recipe_ingredients')->whereIn('menu_item_id', $menuIds)->delete();
                        }
                    }
                    DB::table('menu_items')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (Schema::hasTable('addons')) {
                    DB::table('addons')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (Schema::hasTable('categories')) {
                    DB::table('categories')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (Schema::hasTable('dining_tables')) {
                    DB::table('dining_tables')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (Schema::hasTable('restaurant_subscriptions')) {
                    DB::table('restaurant_subscriptions')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (!empty($branchIds) && Schema::hasTable('branch_settings')) {
                    DB::table('branch_settings')->whereIn('branch_id', $branchIds)->delete();
                }
                if (!empty($branchIds) && Schema::hasTable('user_branches')) {
                    DB::table('user_branches')->whereIn('branch_id', $branchIds)->delete();
                }
                if (Schema::hasTable('restaurant_settings')) {
                    DB::table('restaurant_settings')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (Schema::hasTable('user_restaurants')) {
                    DB::table('user_restaurants')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                if (Schema::hasTable('branches')) {
                    DB::table('branches')->whereIn('restaurant_id', $demoRestaurantIds)->delete();
                }
                DB::table('restaurants')->whereIn('id', $demoRestaurantIds)->delete();
            }

            if (!empty($demoUserIds)) {
                if (Schema::hasTable('personal_access_tokens')) {
                    DB::table('personal_access_tokens')->whereIn('tokenable_id', $demoUserIds)->delete();
                }
                if (Schema::hasTable('model_has_roles')) {
                    DB::table('model_has_roles')->whereIn('model_id', $demoUserIds)->delete();
                }
                if (Schema::hasTable('model_has_permissions')) {
                    DB::table('model_has_permissions')->whereIn('model_id', $demoUserIds)->delete();
                }
                if (Schema::hasTable('user_restaurants')) {
                    DB::table('user_restaurants')->whereIn('user_id', $demoUserIds)->delete();
                }
                if (Schema::hasTable('user_branches')) {
                    DB::table('user_branches')->whereIn('user_id', $demoUserIds)->delete();
                }
                DB::table('users')->whereIn('id', $demoUserIds)->delete();
            }
        });
    }

    public function down(): void
    {
        // Purged demo data is not restored on rollback.
    }
};
