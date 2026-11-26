<?php

/**
 * Restaurant OS - Hostinger Shared Hosting Cron Bridge
 *
 * Setup in Hostinger hPanel -> Advanced -> Cron Jobs:
 * Command: /usr/bin/php /home/u123456789/domains/yourdomain.com/public_html/cron.php
 * Schedule: * * * * * (Every minute)
 */

define('LARAVEL_START', microtime(true));

// Protect HTTP web access with secret key if accessed via browser/URL
$secretKey = getenv('CRON_SECRET_KEY') ?: 'resto_cron_secret_token_2026';
if (php_sapi_name() !== 'cli') {
    if (!isset($_GET['key']) || $_GET['key'] !== $secretKey) {
        http_response_code(403);
        die(json_encode(['error' => 'Unauthorized cron execution. Valid secret key required.']));
    }
}

// Determine framework base directory
$baseDir = dirname(__DIR__);

// Load Composer autoloader
if (!file_exists($baseDir . '/vendor/autoload.php')) {
    http_response_code(500);
    die(json_encode(['error' => 'Composer vendor autoloader not found. Run composer install.']));
}

require $baseDir . '/vendor/autoload.php';

// Bootstrap Laravel Application
$app = require_once $baseDir . '/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);

// Execute scheduled tasks and hostinger maintenance
try {
    $kernel->call('schedule:run');
    $kernel->call('resto:hostinger-cron');

    $output = [
        'success' => true,
        'message' => 'Hostinger cron executed successfully.',
        'timestamp' => date('Y-m-d H:i:s'),
        'execution_time_ms' => round((microtime(true) - LARAVEL_START) * 1000, 2),
    ];

    if (php_sapi_name() === 'cli') {
        echo json_encode($output, JSON_PRETTY_PRINT) . PHP_EOL;
    } else {
        header('Content-Type: application/json');
        echo json_encode($output);
    }
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
