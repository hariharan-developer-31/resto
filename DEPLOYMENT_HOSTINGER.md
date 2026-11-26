# RESTAURANT OS - HOSTINGER UNLIMITED HOSTING DEPLOYMENT GUIDE

**Target Platform:** Hostinger Unlimited Shared Hosting / Cloud Hosting  
**Architectural Model:** Zero-Daemon Architecture (PHP 8.3 + MySQL 8 + Apache + Next.js Web App)  
**Security Standard:** HTTPS Enforced, Sanctum Token Auth, Tenant Isolation  

---

## 1. Hosting Architecture Overview

Hostinger shared hosting environments provide high performance without requiring continuously running background daemons (like Redis, Supervisor, or long-running Node/Python processes).

Restaurant OS is engineered to run seamlessly on Hostinger using:

1. **Private Backend Application Directory (`/home/uXXXX/resto_app`):** Stores application source code, Eloquent models, vendor libraries, storage logs, and database migrations securely outside the publicly accessible webroot.
2. **Public Webroot (`/home/uXXXX/public_html`):** Contains `index.php` front controller bridge, `.htaccess`, static assets, and client bundle.
3. **Hostinger Cron Bridge (`public_html/cron.php`):** Executes periodic tasks (stale table cleaning, low-stock notifications, reservation checks) on a 1-minute schedule via Hostinger hPanel without requiring Supervisor.
4. **Cloudflare CDN & SSL:** Free edge caching, DDoS protection, and HTTPS termination.

---

## 2. Directory Structure on Hostinger Server

```
/home/u123456789/
├── domains/
│   └── yourrestaurant.com/
│       ├── resto_app/                 <-- Private Laravel Core (Not web accessible)
│       │   ├── app/
│       │   ├── bootstrap/
│       │   ├── config/
│       │   ├── database/
│       │   ├── routes/
│       │   ├── storage/
│       │   ├── vendor/
│       │   ├── .env                   <-- Production Environment Variables
│       │   └── artisan
│       │
│       └── public_html/               <-- Public Webroot
│           ├── .next/                 <-- Next.js Frontend Bundle
│           ├── static/                <-- Public Images, Logos & Favicons
│           ├── .htaccess              <-- Security headers, HTTPS & rewrite rules
│           ├── cron.php               <-- Hostinger cPanel / hPanel Cron Bridge
│           └── index.php              <-- Front controller forwarding to resto_app
```

---

## 3. Step-by-Step Deployment Instructions

### Step 1: Create Hostinger MySQL Database
1. Log in to **Hostinger hPanel**.
2. Navigate to **Databases** -> **MySQL Databases**.
3. Create a new database:
   - **Database Name:** `u123456789_resto`
   - **Username:** `u123456789_restouser`
   - **Password:** Strong generated password (e.g. `Str0ngP@ssw0rd!2026`)
4. Note the database name, username, and password.

---

### Step 2: Configure Production Environment (`.env`)
Create `.env` inside `/home/u123456789/domains/yourrestaurant.com/resto_app/.env`:

```env
APP_NAME="Restaurant OS"
APP_ENV=production
APP_KEY=base64:YOUR_GENERATED_APP_KEY_HERE
APP_DEBUG=false
APP_URL=https://yourrestaurant.com

LOG_CHANNEL=daily
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=error

# Hostinger MySQL Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=u123456789_resto
DB_USERNAME=u123456789_restouser
DB_PASSWORD=Str0ngP@ssw0rd!2026

# Cache & Session on Shared Hosting (File-based, zero Redis required)
BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync
CACHE_STORE=file
CACHE_PREFIX=resto_cache
SESSION_DRIVER=file
SESSION_LIFETIME=120

# Sanctum & Tenant CORS
SANCTUM_STATEFUL_DOMAINS=yourrestaurant.com,www.yourrestaurant.com
SESSION_DOMAIN=.yourrestaurant.com

# Cron Security Token
CRON_SECRET_KEY=resto_cron_secret_token_2026
```

---

### Step 3: Run Database Migrations & Initial Seed
Connect via Hostinger SSH (Terminal) or run via web terminal:

```bash
cd /home/u123456789/domains/yourrestaurant.com/resto_app

# Run all 8 Phase migrations
php artisan migrate --force

# Seed foundation personas, menu catalog, tables, and subscription plans
php artisan db:seed --force

# Optimize Laravel for shared hosting performance
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

---

### Step 4: Configure Hostinger Cron Job (hPanel)
1. In **Hostinger hPanel**, go to **Advanced** -> **Cron Jobs**.
2. Select **Custom** type.
3. Schedule: `* * * * *` (Every minute).
4. Command:
```bash
/usr/bin/php /home/u123456789/domains/yourrestaurant.com/public_html/cron.php
```
5. Click **Save**.

This executes `php artisan schedule:run` and `php artisan resto:hostinger-cron` seamlessly every minute without requiring Redis or Supervisor!

---

### Step 5: Configure Cloudflare & SSL
1. Under Hostinger **SSL**, enable free **Let's Encrypt SSL** (Lifetime automatic renewal).
2. Point your domain's nameservers to Cloudflare:
   - Enable **Always Use HTTPS**.
   - Set SSL/TLS encryption mode to **Full (Strict)**.
   - Set Minimum TLS Version to **1.2**.
   - Enable **Brotli Compression** and **Early Hints**.

---

## 4. Verification Checklist

- [x] `GET https://yourrestaurant.com/api/v1/health` returns `{"status":"healthy","database":"connected"}`.
- [x] Login with `superadmin@resto.com` works and issues Sanctum bearer token.
- [x] POS Terminal `/pos` records orders, dispatches KOTs, and prints tax invoices.
- [x] Waiter Station `/waiter` updates dish prep states in real time.
- [x] Kitchen KDS `/kitchen` displays color-coded urgency and station routing tabs.
- [x] Contactless Table QR portal `/order/[qrToken]` opens instantly from mobile devices without login.
- [x] Table Reservations `/reservations` and Online Booking `/reserve` prevent double bookings.
- [x] Inventory `/inventory` tracks raw material balances, minimum stock alerts, and purchase orders.
- [x] Reports `/reports` generates End-of-Day Z-Reports and GST tax sheets.
- [x] SaaS Subscription `/subscription` accurately meters branch, table, and staff limits.
