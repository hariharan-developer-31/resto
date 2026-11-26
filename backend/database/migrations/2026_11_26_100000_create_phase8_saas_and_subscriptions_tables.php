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
        // 1. Subscription Plans Table
        Schema::create('subscription_plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique()->index();
            $table->text('description')->nullable();
            $table->decimal('monthly_price', 10, 2)->default(0.00);
            $table->decimal('annual_price', 10, 2)->default(0.00);
            $table->string('currency', 10)->default('INR');
            $table->integer('max_branches')->default(1);
            $table->integer('max_tables_per_branch')->default(10);
            $table->integer('max_staff_members')->default(5);
            $table->json('features')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });

        // 2. Restaurant Subscriptions Table
        Schema::create('restaurant_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('restaurant_id')->constrained('restaurants')->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('subscription_plans')->cascadeOnDelete();
            $table->string('billing_cycle', 20)->default('monthly'); // monthly, annual
            $table->decimal('amount_paid', 10, 2)->default(0.00);
            $table->string('status', 20)->default('active')->index(); // trialing, active, past_due, cancelled, expired
            $table->dateTime('trial_ends_at')->nullable();
            $table->dateTime('starts_at');
            $table->dateTime('renews_at')->nullable();
            $table->dateTime('cancelled_at')->nullable();
            $table->string('cancellation_reason')->nullable();
            $table->string('payment_gateway', 50)->nullable(); // razorpay, cashfree, manual
            $table->string('payment_reference', 100)->nullable();
            $table->timestamps();

            $table->index(['restaurant_id', 'status']);
        });

        // 3. Attach Current Plan reference to Restaurants
        if (Schema::hasTable('restaurants')) {
            Schema::table('restaurants', function (Blueprint $table) {
                if (!Schema::hasColumn('restaurants', 'current_plan_id')) {
                    $table->foreignId('current_plan_id')->nullable()->after('primary_color')->constrained('subscription_plans')->nullOnDelete();
                }
                if (!Schema::hasColumn('restaurants', 'subscription_status')) {
                    $table->string('subscription_status', 30)->default('active')->after('current_plan_id')->index();
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('restaurants')) {
            Schema::table('restaurants', function (Blueprint $table) {
                if (Schema::hasColumn('restaurants', 'current_plan_id')) {
                    $table->dropForeign(['current_plan_id']);
                    $table->dropColumn('current_plan_id');
                }
                if (Schema::hasColumn('restaurants', 'subscription_status')) {
                    $table->dropColumn('subscription_status');
                }
            });
        }

        Schema::dropIfExists('restaurant_subscriptions');
        Schema::dropIfExists('subscription_plans');
    }
};
