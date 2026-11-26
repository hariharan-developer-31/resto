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
        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                if (!Schema::hasColumn('orders', 'guest_count')) {
                    $table->unsignedSmallInteger('guest_count')->nullable()->after('customer_phone');
                }
                if (!Schema::hasColumn('orders', 'settled_at')) {
                    $table->timestamp('settled_at')->nullable()->index()->after('invoice_number');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                if (Schema::hasColumn('orders', 'settled_at')) {
                    $table->dropIndex(['settled_at']);
                    $table->dropColumn('settled_at');
                }
                if (Schema::hasColumn('orders', 'guest_count')) {
                    $table->dropColumn('guest_count');
                }
            });
        }
    }
};
