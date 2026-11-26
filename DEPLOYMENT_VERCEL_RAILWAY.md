# RESTAURANT OS - VERCEL & RAILWAY DEPLOYMENT GUIDE

This step-by-step guide explains how to deploy **Restaurant OS**:
- **Backend API & MySQL Database** on **Railway**
- **Frontend App** on **Vercel**

---

## Prerequisites
1. A **GitHub account** with this repository pushed to it.
2. A free **Railway account** ([railway.com](https://railway.com)).
3. A free **Vercel account** ([vercel.com](https://vercel.com)).

---

## PART 1: PUSH REPOSITORY TO GITHUB

If you haven't already pushed your code to GitHub:

```bash
git add .
git commit -m "feat: complete Restaurant OS 8-phase ready for Vercel & Railway"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

---

## PART 2: DEPLOY BACKEND & MYSQL ON RAILWAY

### Step 1: Create a Railway Project
1. Log in to [Railway.com](https://railway.com) and click **"New Project"**.
2. Select **"Deploy from GitHub repo"**.
3. Select your repository.
4. When asked, click **"Add variables"** or choose to configure later.

### Step 2: Add MySQL Database on Railway
1. In your Railway project canvas, click **"+ New"** button.
2. Select **"Database"** -> **"Add MySQL"**.
3. Railway will provision a managed MySQL 8 database within 30 seconds.

### Step 3: Configure the Backend Service
1. Click on your repository service card in Railway.
2. Go to the **"Settings"** tab:
   - Under **"Root Directory"**, enter: `backend` (and click the checkmark).
   - Under **"Networking"**, click **"Generate Domain"** to get your public backend URL (e.g. `https://resto-backend-production.up.railway.app`).

### Step 4: Add Environment Variables in Railway
1. Go to the **"Variables"** tab of your backend service.
2. Click **"New Variable"** or **"Raw Editor"** and add:

```env
APP_NAME="Restaurant OS"
APP_ENV=production
APP_KEY=base64:c7w9Z9UqTq2h3P9J1K6m8X4y0L3v5N7r2Q8w1E4t6Y0=
APP_DEBUG=false
APP_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}

# Database connection (Railway automatically links these from your MySQL service)
DB_CONNECTION=mysql
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_DATABASE=${{MySQL.MYSQLDATABASE}}
DB_USERNAME=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}

# Cache & Session settings
CACHE_STORE=file
SESSION_DRIVER=file
QUEUE_CONNECTION=sync
LOG_CHANNEL=errorlog

# CORS support for your future Vercel domain
SANCTUM_STATEFUL_DOMAINS=*.vercel.app
```

> **Note on `APP_KEY`:** You can generate a fresh key locally anytime using `php artisan key:generate --show`.

### Step 5: Seed the Initial Database on Railway
Once the deployment finishes and shows **"Active"**:
1. Click on your backend service.
2. Go to the **"Deployments"** tab, click the three dots (`...`) on the active deployment, and select **"View Logs"**.
3. Go to the **"Exec"** (or **"Terminal"**) tab in Railway and run:
```bash
php artisan db:seed --force
```
This populates the demo personas, branches, menu items, dining tables, and SaaS subscription tiers.

### Step 6: Verify Backend Health
Open in your browser:
`https://YOUR_RAILWAY_URL.up.railway.app/api/v1/health`

You should receive:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "environment": "production",
    "database": "connected"
  }
}
```

---

## PART 3: DEPLOY FRONTEND ON VERCEL

### Step 1: Import Project in Vercel
1. Log in to [Vercel.com](https://vercel.com) and click **"Add New..."** -> **"Project"**.
2. Select your GitHub repository and click **"Import"**.

### Step 2: Configure Project Settings in Vercel
In the **Configure Project** screen:
1. **Framework Preset:** `Next.js` (detected automatically).
2. **Root Directory:** Click **"Edit"** next to Root Directory, select the **`frontend`** folder, and click **"Continue"**.

### Step 3: Configure Environment Variables
Under **"Environment Variables"**, add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://YOUR_RAILWAY_URL.up.railway.app/api/v1` | Your live Railway backend API URL |

*(Make sure to append `/api/v1` to your Railway domain)*.

### Step 4: Click "Deploy"
1. Click **"Deploy"**.
2. Vercel will install dependencies, compile TypeScript, and pre-render all 24 static routes in ~60 seconds.
3. You will receive a live URL: `https://your-resto-app.vercel.app`.

---

## PART 4: LOG IN & EXPLORE YOUR LIVE APP

Open your Vercel deployment URL (`https://your-resto-app.vercel.app`):

### Demo Accounts (`password123` for all):
- **Super Admin:** `superadmin@resto.com`
  - Access platform analytics, restaurants list, role permissions, and SaaS subscriptions.
- **Restaurant Admin:** `admin@grandfeast.com`
  - Manage menu catalog, staff accounts, tables layout, and reports.
- **Branch Manager:** `manager@grandfeast.com`
  - Manage live reservations, inventory, suppliers, and End-of-Day Z-reports.
- **Cashier / POS Operator:** `cashier@grandfeast.com`
  - Open `/pos` for touch-friendly dine-in and takeaway ordering, KOT firing, split bill settlement, and thermal invoice printing.
- **Floor Waiter:** `waiter@grandfeast.com`
  - Open `/waiter` for mobile handheld table ordering and live dish serving.
- **Kitchen Chef:** `kitchen@grandfeast.com`
  - Open `/kitchen` for real-time station routing (Biryani, Tandoor, Curries, Beverage) and synthesizer chimes.
- **Guest / Diner:** Open `/order/tbl_grand_flagship_t01` or `/reserve` directly on your phone without login.

---

## Summary of URL Mappings

| Role / Feature | Live URL Route |
| :--- | :--- |
| **Public Restaurant Website** | `https://your-app.vercel.app/` |
| **Table Reservation Booking** | `https://your-app.vercel.app/reserve` |
| **Contactless QR Ordering** | `https://your-app.vercel.app/order/[qrToken]` |
| **Cashier POS Terminal** | `https://your-app.vercel.app/pos` |
| **Waiter Mobile Terminal** | `https://your-app.vercel.app/waiter` |
| **Kitchen Display System (KDS)** | `https://your-app.vercel.app/kitchen` |
| **Table Seating & Conflict Manager** | `https://your-app.vercel.app/reservations` |
| **Inventory, Stock & POs** | `https://your-app.vercel.app/inventory` |
| **Reports, EOD Z-Reports & Taxes** | `https://your-app.vercel.app/reports` |
| **SaaS Subscription & Quotas** | `https://your-app.vercel.app/subscription` |
| **Super Admin Platform Overview** | `https://your-app.vercel.app/dashboard` |
