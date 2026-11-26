<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\DiningTable;
use App\Models\InventoryItem;
use App\Models\Reservation;
use Illuminate\Console\Command;

class HostingerScheduledTasks extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'resto:hostinger-cron';

    /**
     * The console command description.
     */
    protected $description = 'Runs periodic maintenance tasks optimized for Hostinger shared hosting without supervisor daemons';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting Restaurant OS Hostinger Scheduled Maintenance...');

        // 1. Mark completed / expired reservations older than 4 hours
        $expiredReservations = Reservation::where('reservation_date', '<', now()->toDateString())
            ->whereIn('status', ['pending', 'confirmed'])
            ->update(['status' => 'no_show']);

        $this->info("Updated {$expiredReservations} past due reservations to no_show.");

        // 2. Free up tables left in cleaning state for over 30 mins
        $tablesCleaned = DiningTable::where('status', 'cleaning')
            ->where('updated_at', '<', now()->subMinutes(30))
            ->update(['status' => 'available']);

        $this->info("Reset {$tablesCleaned} cleaning tables to available.");

        // 3. Scan for critical low stock items
        $lowStockCount = InventoryItem::whereIn('status', ['low_stock', 'out_of_stock'])->count();
        $this->info("Inventory scan: {$lowStockCount} items currently below safety reorder threshold.");

        $this->info('Hostinger maintenance cycle completed successfully.');
        return Command::SUCCESS;
    }
}
