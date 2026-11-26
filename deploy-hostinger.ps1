# ==============================================================================
# Restaurant OS - Hostinger Shared Hosting Build & Packaging Script (PowerShell)
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Building Restaurant OS for Hostinger Unlimited Hosting   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$buildDir = "build_hostinger"
if (Test-Path $buildDir) {
    Remove-Item -Recurse -Force $buildDir
}
New-Item -ItemType Directory -Path $buildDir | Out-Null
New-Item -ItemType Directory -Path "$buildDir/app_backend" | Out-Null
New-Item -ItemType Directory -Path "$buildDir/public_html" | Out-Null

# 1. Build Frontend Next.js Production Bundle
Write-Host "`n[1/4] Building Next.js Frontend Production Build..." -ForegroundColor Yellow
Set-Location frontend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..

# Copy frontend standalone or static assets to public_html / web app
Write-Host "Copying frontend build output..." -ForegroundColor Green
Copy-Item -Recurse -Force "frontend/.next" "$buildDir/public_html/.next"
Copy-Item -Recurse -Force "frontend/public" "$buildDir/public_html/public"

# 2. Package Laravel Backend (Zero-Daemon Architecture)
Write-Host "`n[2/4] Packaging Laravel 13 Backend for Hostinger..." -ForegroundColor Yellow
$excludeList = @(
    "node_modules",
    ".git",
    "tests",
    ".env.example",
    "phpunit.xml"
)

Get-ChildItem -Path "backend" | Where-Object { $excludeList -notcontains $_.Name } | ForEach-Object {
    Copy-Item -Recurse -Force $_.FullName "$buildDir/app_backend"
}

# 3. Setup Hostinger Public Webroot Bridge
Write-Host "`n[3/4] Setting up Hostinger public_html index.php & cron bridge..." -ForegroundColor Yellow
Copy-Item -Force "backend/public/.htaccess" "$buildDir/public_html/.htaccess"
Copy-Item -Force "backend/public/cron.php" "$buildDir/public_html/cron.php"

# Create Hostinger production index.php bridge
$hostingerIndexContent = @'
<?php

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Determine if application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../app_backend/storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register Composer Autoloader...
require __DIR__.'/../app_backend/vendor/autoload.php';

// Bootstrap Laravel and handle request...
(require_once __DIR__.'/../app_backend/bootstrap/app.php')
    ->handleRequest(Request::capture());
'@

Set-Content -Path "$buildDir/public_html/index.php" -Value $hostingerIndexContent

Write-Host "`n[4/4] Hostinger Package Built Successfully!" -ForegroundColor Green
Write-Host "Output directory: $buildDir" -ForegroundColor Cyan
Write-Host "Upload contents of $buildDir/public_html to Hostinger public_html/" -ForegroundColor White
Write-Host "Upload contents of $buildDir/app_backend to private folder above public_html/" -ForegroundColor White
