<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Purge any orphaned orders, items, payments, tables, and branches
     * left over from deleted test restaurants.
     */
    public function up(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        DB::transaction(function () {
            if (Schema::hasTable('restaurants')) {
                $validRestaurantIds = DB::table('restaurants')->pluck('id')->all();

                if (Schema::hasTable('order_payments')) {
                    DB::table('order_payments')
                        ->whereNotIn('restaurant_id', $validRestaurantIds)
                        ->orWhere('order_id', 5)
                        ->delete();
                }

                if (Schema::hasTable('order_items')) {
                    DB::table('order_items')
                        ->where('order_id', 5)
                        ->delete();
                }

                if (Schema::hasTable('orders')) {
                    DB::table('orders')
                        ->whereNotIn('restaurant_id', $validRestaurantIds)
                        ->orWhere('id', 5)
                        ->delete();
                }

                if (Schema::hasTable('dining_tables')) {
                    DB::table('dining_tables')
                        ->whereNotIn('restaurant_id', $validRestaurantIds)
                        ->delete();
                }

                if (Schema::hasTable('branches')) {
                    DB::table('branches')
                        ->whereNotIn('restaurant_id', $validRestaurantIds)
                        ->delete();
                }
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op for data purge
    }
};
