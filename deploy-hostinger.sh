#!/bin/bash
# ==============================================================================
# Restaurant OS - Hostinger Shared Hosting Build & Packaging Script (Bash)
# ==============================================================================

set -e

echo "=========================================================="
echo " Building Restaurant OS for Hostinger Unlimited Hosting   "
echo "=========================================================="

BUILD_DIR="build_hostinger"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/app_backend"
mkdir -p "$BUILD_DIR/public_html"

echo "\n[1/4] Building Next.js Frontend Production Build..."
cd frontend
npm run build
cd ..

cp -r frontend/.next "$BUILD_DIR/public_html/.next"
cp -r frontend/public "$BUILD_DIR/public_html/public"

echo "\n[2/4] Packaging Laravel 13 Backend for Hostinger..."
rsync -av --exclude='node_modules' --exclude='.git' --exclude='tests' backend/ "$BUILD_DIR/app_backend/"

echo "\n[3/4] Setting up Hostinger public_html index.php & cron bridge..."
cp backend/public/.htaccess "$BUILD_DIR/public_html/.htaccess"
cp backend/public/cron.php "$BUILD_DIR/public_html/cron.php"

cat << 'EOF' > "$BUILD_DIR/public_html/index.php"
<?php

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

if (file_exists($maintenance = __DIR__.'/../app_backend/storage/framework/maintenance.php')) {
    require $maintenance;
}

require __DIR__.'/../app_backend/vendor/autoload.php';

(require_once __DIR__.'/../app_backend/bootstrap/app.php')
    ->handleRequest(Request::capture());
EOF

echo "\n[4/4] Hostinger Package Built Successfully into $BUILD_DIR/"
