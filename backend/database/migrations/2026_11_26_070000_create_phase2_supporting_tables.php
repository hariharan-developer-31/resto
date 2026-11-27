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
        if (!Schema::hasTable('dining_tables')) {
            Schema::create('dining_tables', function (Blueprint $table) {
                $table->id();
                $table->foreignId('restaurant_id')->constrained('restaurants')->cascadeOnDelete();
                $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
                $table->string('table_number', 50);
                $table->integer('seating_capacity')->default(4);
                $table->string('status', 30)->default('available')->index(); // available, occupied, reserved, billing, cleaning, out_of_service
                $table->string('qr_token', 64)->nullable()->unique();
                $table->timestamps();
                $table->softDeletes();

                $table->unique(['branch_id', 'table_number']);
                $table->index(['restaurant_id', 'branch_id', 'status']);
            });
        }

        if (!Schema::hasTable('orders')) {
            Schema::create('orders', function (Blueprint $table) {
                $table->id();
                $table->foreignId('restaurant_id')->constrained('restaurants')->cascadeOnDelete();
                $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
                $table->foreignId('table_id')->nullable()->constrained('dining_tables')->nullOnDelete();
                $table->foreignId('waiter_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('order_number', 64)->unique()->index();
                $table->string('order_type', 30)->default('dine_in')->index(); // dine_in, takeaway, delivery
                $table->string('order_status', 30)->default('pending')->index(); // pending, preparing, ready, completed, cancelled
                $table->string('payment_status', 30)->default('unpaid')->index(); // unpaid, paid, partially_paid, refunded
                $table->decimal('subtotal', 10, 2)->default(0.00);
                $table->decimal('tax_amount', 10, 2)->default(0.00);
                $table->decimal('discount_amount', 10, 2)->default(0.00);
                $table->decimal('total_amount', 10, 2)->default(0.00);
                $table->text('cancellation_reason')->nullable();
                $table->timestamp('cancelled_at')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->index(['restaurant_id', 'branch_id', 'created_at']);
                $table->index(['order_status', 'payment_status']);
            });
        }

        if (!Schema::hasTable('reservations')) {
            Schema::create('reservations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('restaurant_id')->constrained('restaurants')->cascadeOnDelete();
                $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
                $table->foreignId('table_id')->nullable()->constrained('dining_tables')->nullOnDelete();
                $table->string('customer_name');
                $table->string('customer_phone', 30);
                $table->string('customer_email')->nullable();
                $table->integer('guest_count')->default(2);
                $table->date('reservation_date')->index();
                $table->string('reservation_time', 20);
                $table->string('status', 30)->default('pending')->index(); // pending, confirmed, checked_in, seated, completed, cancelled, no_show
                $table->text('special_requests')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->index(['restaurant_id', 'branch_id', 'reservation_date', 'status']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reservations');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('dining_tables');
    }
};
