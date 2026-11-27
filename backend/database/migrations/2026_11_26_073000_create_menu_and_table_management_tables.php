<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Categories & Subcategories
        if (!Schema::hasTable('categories')) {
            Schema::create('categories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('restaurant_id')->constrained('restaurants')->cascadeOnDelete();
                $table->unsignedBigInteger('parent_id')->nullable()->index();
                $table->string('name');
                $table->string('slug');
                $table->text('description')->nullable();
                $table->string('image')->nullable();
                $table->integer('sort_order')->default(0);
                $table->boolean('is_active')->default(true)->index();
                $table->timestamps();
                $table->softDeletes();

                $table->unique(['restaurant_id', 'slug']);
                $table->index(['restaurant_id', 'is_active', 'sort_order']);
            });

            Schema::table('categories', function (Blueprint $table) {
                $table->foreign('parent_id')->references('id')->on('categories')->nullOnDelete();
            });
        }

        // 2. Menu Items Catalog
        if (!Schema::hasTable('menu_items')) {
            Schema::create('menu_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('restaurant_id')->constrained('restaurants')->cascadeOnDelete();
                $table->foreignId('category_id')->constrained('categories')->cascadeOnDelete();
                $table->string('name');
                $table->string('slug');
                $table->text('description')->nullable();
                $table->string('image')->nullable();
                $table->decimal('base_price', 10, 2);
                $table->string('type', 20)->default('veg')->index(); // veg, non_veg, egg, vegan
                $table->integer('preparation_time')->default(15); // in minutes
                $table->boolean('is_available')->default(true)->index();
                $table->boolean('is_featured')->default(false)->index();
                $table->boolean('is_combo')->default(false);
                $table->decimal('tax_rate', 5, 2)->nullable();
                $table->string('kitchen_station', 50)->default('main')->index(); // main, grill, beverage, dessert
                $table->integer('sort_order')->default(0);
                $table->timestamps();
                $table->softDeletes();

                $table->unique(['restaurant_id', 'slug']);
                $table->index(['restaurant_id', 'category_id', 'is_available']);
            });
        }

        // 3. Menu Variants
        if (!Schema::hasTable('menu_variants')) {
            Schema::create('menu_variants', function (Blueprint $table) {
                $table->id();
                $table->foreignId('menu_item_id')->constrained('menu_items')->cascadeOnDelete();
                $table->string('name'); // Regular, Large, Half, Full, Family Pack
                $table->decimal('price', 10, 2);
                $table->boolean('is_default')->default(false);
                $table->timestamps();
                $table->softDeletes();

                $table->index(['menu_item_id', 'is_default']);
            });
        }

        // 4. Addons Catalog
        if (!Schema::hasTable('addons')) {
            Schema::create('addons', function (Blueprint $table) {
                $table->id();
                $table->foreignId('restaurant_id')->constrained('restaurants')->cascadeOnDelete();
                $table->string('name');
                $table->decimal('price', 10, 2);
                $table->boolean('is_active')->default(true)->index();
                $table->timestamps();
                $table->softDeletes();

                $table->index(['restaurant_id', 'is_active']);
            });
        }

        // 5. Pivot: Menu Items <-> Addons
        if (!Schema::hasTable('menu_item_addons')) {
            Schema::create('menu_item_addons', function (Blueprint $table) {
                $table->id();
                $table->foreignId('menu_item_id')->constrained('menu_items')->cascadeOnDelete();
                $table->foreignId('addon_id')->constrained('addons')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['menu_item_id', 'addon_id']);
            });
        }

        // 6. Extend dining_tables with location, waiter assignment and qr generation telemetry
        Schema::table('dining_tables', function (Blueprint $table) {
            if (!Schema::hasColumn('dining_tables', 'location')) {
                $table->string('location', 64)->default('Indoor')->after('seating_capacity')->index();
            }
            if (!Schema::hasColumn('dining_tables', 'waiter_id')) {
                $table->foreignId('waiter_id')->nullable()->after('branch_id')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('dining_tables', 'qr_generated_at')) {
                $table->timestamp('qr_generated_at')->nullable()->after('qr_token');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dining_tables', function (Blueprint $table) {
            if (Schema::hasColumn('dining_tables', 'qr_generated_at')) {
                $table->dropColumn('qr_generated_at');
            }
            if (Schema::hasColumn('dining_tables', 'waiter_id')) {
                $table->dropForeign(['waiter_id']);
                $table->dropColumn('waiter_id');
            }
            if (Schema::hasColumn('dining_tables', 'location')) {
                $table->dropColumn('location');
            }
        });

        Schema::dropIfExists('menu_item_addons');
        Schema::dropIfExists('addons');
        Schema::dropIfExists('menu_variants');
        Schema::dropIfExists('menu_items');
        Schema::dropIfExists('categories');
    }
};
