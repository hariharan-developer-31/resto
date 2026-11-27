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
        // 1. Suppliers Table
        if (!Schema::hasTable('suppliers')) {
            Schema::create('suppliers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('restaurant_id')->constrained('restaurants')->cascadeOnDelete();
                $table->string('name');
                $table->string('contact_person')->nullable();
                $table->string('phone', 30)->nullable();
                $table->string('email')->nullable();
                $table->text('address')->nullable();
                $table->string('tax_number', 50)->nullable(); // GST / VAT
                $table->string('payment_terms', 50)->default('net_30'); // cash_on_delivery, net_15, net_30, advance
                $table->string('status', 20)->default('active')->index(); // active, inactive
                $table->timestamps();
                $table->softDeletes();

                $table->index(['restaurant_id', 'status']);
            });
        }

        // 2. Inventory Items (Raw Ingredients & Materials) Table
        if (!Schema::hasTable('inventory_items')) {
            Schema::create('inventory_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('restaurant_id')->constrained('restaurants')->cascadeOnDelete();
                $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
                $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
                $table->string('name');
                $table->string('sku', 50)->nullable();
                $table->string('category', 50)->default('general'); // meat, seafood, poultry, dairy, produce, spices, dry_goods, beverages, packaging, general
                $table->string('unit', 20)->default('kg'); // kg, g, l, ml, pcs, pack, can, bottle, box
                $table->decimal('current_stock', 12, 3)->default(0.000);
                $table->decimal('minimum_stock', 12, 3)->default(0.000); // Safety threshold for reorder alert
                $table->decimal('unit_cost', 10, 2)->default(0.00); // Cost per unit in INR
                $table->string('storage_location', 100)->nullable(); // Cold Storage, Freezer, Dry Pantry, Bar Counter
                $table->string('status', 20)->default('in_stock')->index(); // in_stock, low_stock, out_of_stock
                $table->timestamps();
                $table->softDeletes();

                $table->index(['restaurant_id', 'branch_id', 'status']);
                $table->index(['restaurant_id', 'branch_id', 'category']);
            });
        }

        // 3. Recipe Ingredients (Bill of Materials / BOM) Table
        if (!Schema::hasTable('recipe_ingredients')) {
            Schema::create('recipe_ingredients', function (Blueprint $table) {
                $table->id();
                $table->foreignId('menu_item_id')->constrained('menu_items')->cascadeOnDelete();
                $table->foreignId('menu_variant_id')->nullable()->constrained('menu_variants')->cascadeOnDelete();
                $table->foreignId('inventory_item_id')->constrained('inventory_items')->cascadeOnDelete();
                $table->decimal('quantity_required', 10, 3); // Amount of inventory item deducted per dish/portion
                $table->string('unit', 20)->default('g');
                $table->timestamps();

                $table->unique(['menu_item_id', 'menu_variant_id', 'inventory_item_id'], 'recipe_dish_variant_inv_unique');
            });
        }

        // 4. Stock Movements Ledger (Audited Additions, Deductions, Wastage) Table
        if (!Schema::hasTable('stock_movements')) {
            Schema::create('stock_movements', function (Blueprint $table) {
                $table->id();
                $table->foreignId('restaurant_id')->constrained('restaurants')->cascadeOnDelete();
                $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
                $table->foreignId('inventory_item_id')->constrained('inventory_items')->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('movement_type', 30)->index(); // purchase_in, order_deduction, wastage, spoilage, audit_adjustment, return
                $table->decimal('quantity', 12, 3); // Positive for in, negative for out
                $table->decimal('balance_after', 12, 3);
                $table->decimal('unit_cost', 10, 2)->default(0.00);
                $table->decimal('total_cost', 10, 2)->default(0.00);
                $table->string('reference_type', 50)->nullable(); // purchase_order, order, manual_audit
                $table->unsignedBigInteger('reference_id')->nullable();
                $table->string('reason')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['restaurant_id', 'branch_id', 'inventory_item_id']);
                $table->index(['movement_type', 'created_at']);
            });
        }

        // 5. Purchase Orders Table
        if (!Schema::hasTable('purchase_orders')) {
            Schema::create('purchase_orders', function (Blueprint $table) {
                $table->id();
                $table->foreignId('restaurant_id')->constrained('restaurants')->cascadeOnDelete();
                $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
                $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnDelete();
                $table->string('po_number', 50)->unique();
                $table->date('order_date');
                $table->date('expected_delivery_date')->nullable();
                $table->dateTime('received_date')->nullable();
                $table->string('status', 30)->default('draft')->index(); // draft, ordered, partially_received, received, cancelled
                $table->decimal('subtotal', 10, 2)->default(0.00);
                $table->decimal('tax_amount', 10, 2)->default(0.00);
                $table->decimal('total_amount', 10, 2)->default(0.00);
                $table->text('notes')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->softDeletes();

                $table->index(['restaurant_id', 'branch_id', 'status']);
            });
        }

        // 6. Purchase Order Items Table
        if (!Schema::hasTable('purchase_order_items')) {
            Schema::create('purchase_order_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('purchase_order_id')->constrained('purchase_orders')->cascadeOnDelete();
                $table->foreignId('inventory_item_id')->constrained('inventory_items')->cascadeOnDelete();
                $table->decimal('quantity_ordered', 10, 3);
                $table->decimal('quantity_received', 10, 3)->default(0.000);
                $table->decimal('unit_cost', 10, 2)->default(0.00);
                $table->decimal('total_price', 10, 2)->default(0.00);
                $table->timestamps();
            });
        }

        // 7. Enhance Reservations with Check-in / Seated timestamps
        if (Schema::hasTable('reservations')) {
            Schema::table('reservations', function (Blueprint $table) {
                if (!Schema::hasColumn('reservations', 'checked_in_at')) {
                    $table->dateTime('checked_in_at')->nullable()->after('reservation_time');
                }
                if (!Schema::hasColumn('reservations', 'seated_at')) {
                    $table->dateTime('seated_at')->nullable()->after('checked_in_at');
                }
                if (!Schema::hasColumn('reservations', 'cancellation_reason')) {
                    $table->string('cancellation_reason')->nullable()->after('special_requests');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('reservations')) {
            Schema::table('reservations', function (Blueprint $table) {
                if (Schema::hasColumn('reservations', 'checked_in_at')) {
                    $table->dropColumn('checked_in_at');
                }
                if (Schema::hasColumn('reservations', 'seated_at')) {
                    $table->dropColumn('seated_at');
                }
                if (Schema::hasColumn('reservations', 'cancellation_reason')) {
                    $table->dropColumn('cancellation_reason');
                }
            });
        }

        Schema::dropIfExists('purchase_order_items');
        Schema::dropIfExists('purchase_orders');
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('recipe_ingredients');
        Schema::dropIfExists('inventory_items');
        Schema::dropIfExists('suppliers');
    }
};
