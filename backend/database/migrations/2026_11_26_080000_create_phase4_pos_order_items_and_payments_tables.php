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
        // 1. Extend orders table with customer and billing fields
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'customer_name')) {
                $table->string('customer_name')->nullable()->after('waiter_id');
            }
            if (!Schema::hasColumn('orders', 'customer_phone')) {
                $table->string('customer_phone', 30)->nullable()->after('customer_name');
            }
            if (!Schema::hasColumn('orders', 'service_charge')) {
                $table->decimal('service_charge', 10, 2)->default(0.00)->after('discount_amount');
            }
            if (!Schema::hasColumn('orders', 'packaging_charge')) {
                $table->decimal('packaging_charge', 10, 2)->default(0.00)->after('service_charge');
            }
            if (!Schema::hasColumn('orders', 'round_count')) {
                $table->integer('round_count')->default(1)->after('total_amount');
            }
            if (!Schema::hasColumn('orders', 'paid_amount')) {
                $table->decimal('paid_amount', 10, 2)->default(0.00)->after('round_count');
            }
            if (!Schema::hasColumn('orders', 'change_amount')) {
                $table->decimal('change_amount', 10, 2)->default(0.00)->after('paid_amount');
            }
            if (!Schema::hasColumn('orders', 'invoice_number')) {
                $table->string('invoice_number', 64)->nullable()->unique()->after('change_amount');
            }
            if (!Schema::hasColumn('orders', 'special_instructions')) {
                $table->text('special_instructions')->nullable()->after('invoice_number');
            }
        });

        // 2. Create order_items table for itemized rounds and KOT
        if (!Schema::hasTable('order_items')) {
            Schema::create('order_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
                $table->foreignId('menu_item_id')->constrained('menu_items')->cascadeOnDelete();
                $table->foreignId('menu_variant_id')->nullable()->constrained('menu_variants')->nullOnDelete();
                $table->integer('round_number')->default(1)->index();
                $table->string('kot_number', 50)->nullable()->index();
                $table->string('item_name');
                $table->string('variant_name')->nullable();
                $table->integer('quantity')->default(1);
                $table->decimal('unit_price', 10, 2);
                $table->decimal('subtotal', 10, 2);
                $table->decimal('tax_rate', 5, 2)->default(5.00);
                $table->decimal('tax_amount', 10, 2)->default(0.00);
                $table->decimal('total_price', 10, 2);
                $table->string('status', 30)->default('pending')->index(); // pending, preparing, ready, served, cancelled
                $table->string('kitchen_station', 50)->default('main')->index();
                $table->text('special_instructions')->nullable();
                $table->timestamp('served_at')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->index(['order_id', 'status']);
                $table->index(['kitchen_station', 'status']);
            });
        }

        // 3. Create order_item_addons table
        if (!Schema::hasTable('order_item_addons')) {
            Schema::create('order_item_addons', function (Blueprint $table) {
                $table->id();
                $table->foreignId('order_item_id')->constrained('order_items')->cascadeOnDelete();
                $table->foreignId('addon_id')->constrained('addons')->cascadeOnDelete();
                $table->string('addon_name');
                $table->decimal('unit_price', 10, 2);
                $table->integer('quantity')->default(1);
                $table->decimal('total_price', 10, 2);
                $table->timestamps();
            });
        }

        // 4. Create payments table for multi-mode and split settlements
        if (!Schema::hasTable('payments')) {
            Schema::create('payments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('restaurant_id')->constrained('restaurants')->cascadeOnDelete();
                $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
                $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
                $table->string('payment_method', 30)->index(); // cash, card, upi, split
                $table->decimal('amount', 10, 2);
                $table->string('transaction_reference', 100)->nullable();
                $table->string('status', 30)->default('success')->index(); // success, pending, failed, refunded
                $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('notes')->nullable();
                $table->timestamp('paid_at')->index();
                $table->timestamps();

                $table->index(['restaurant_id', 'branch_id', 'paid_at']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('order_item_addons');
        Schema::dropIfExists('order_items');

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'customer_name',
                'customer_phone',
                'service_charge',
                'packaging_charge',
                'round_count',
                'paid_amount',
                'change_amount',
                'invoice_number',
                'special_instructions',
            ]);
        });
    }
};
