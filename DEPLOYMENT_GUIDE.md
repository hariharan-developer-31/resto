# RESTAURANT OS - DEPLOYMENT GUIDE

This guide provides complete instructions for:
1. **Current Deployment:** Frontend on **Vercel** + Backend on **Railway** (MySQL/SQLite).
2. **Future Migration:** Full deployment to **Hostinger Unlimited Shared Hosting**.

---

## PART 1: DEPLOYING BACKEND TO RAILWAY

Railway is an ideal cloud platform for running Laravel with MySQL.

### Step 1: Push Project to GitHub
Initialize your Git repository and push your project to GitHub:
```bash
git add .
git commit -m "Complete Phase 1: Foundation, Auth & Tenant Isolation"
git branch -M main
git remote add origin https://github.com/<your-username>/restaurant-os.git
git push -u origin main
```

### Step 2: Create Railway Project
1. Log in to [Railway.app](https://railway.app).
2. Click **New Project** → **Provision MySQL** (to add a managed MySQL database).
3. Click **New Service** → **GitHub Repo** → select your `restaurant-os` repository.
4. Set the **Root Directory** of the service to: `backend`.

### Step 3: Configure Environment Variables in Railway
Under the Laravel service's **Variables** tab, set:
```env
APP_NAME="Restaurant OS"
APP_ENV=production
APP_KEY=<Generated key using: php artisan key:generate --show>
APP_DEBUG=false
APP_URL=https://<your-railway-backend-url>.up.railway.app
FRONTEND_URL=https://<your-vercel-frontend-url>.vercel.app

# Database Variables (Link to Railway MySQL)
DB_CONNECTION=mysql
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_DATABASE=${{MySQL.MYSQLDATABASE}}
DB_USERNAME=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database
```

### Step 4: Run Initial Seeding on Railway
Once deployed, open Railway's terminal for the Laravel service:
```bash
php artisan migrate:fresh --seed --force
```
Your backend API will now be live at `https://<your-railway-backend-url>.up.railway.app/api/v1/health`.

---

## PART 2: DEPLOYING FRONTEND TO VERCEL

### Step 1: Import Project in Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New** → **Project** → Select your `restaurant-os` repository.
3. Configure the Project Settings:
   - **Framework Preset:** Next.js
   - **Root Directory:** Edit to select `frontend`

### Step 2: Configure Environment Variables in Vercel
Add the following variable under **Environment Variables**:
```env
NEXT_PUBLIC_API_URL=https://<your-railway-backend-url>.up.railway.app/api/v1
```

### Step 3: Deploy
Click **Deploy**. Vercel will run `npm run build` and publish your frontend to a global edge CDN.

---

## PART 3: FUTURE MIGRATION TO HOSTINGER UNLIMITED SHARED HOSTING

When you are ready to migrate the system completely to Hostinger:

### 1. Backend Migration (Laravel on Hostinger PHP Hosting)
1. **Upload Files:**
   - In Hostinger hPanel File Manager, upload the `backend` folder outside the `public_html` root (e.g., in `/home/u123456789/resto_backend`).
2. **Document Root:**
   - Either point your domain/subdomain's document root to `/home/u123456789/resto_backend/public`, OR copy the contents of `backend/public/` directly into `public_html/api` and update `index.php` paths.
3. **Database Setup:**
   - Create a MySQL database and user in Hostinger **MySQL Databases**.
   - Edit `/home/u123456789/resto_backend/.env` with your Hostinger DB credentials.
   - Run migrations via SSH: `php artisan migrate --force --seed`.
4. **Storage Permissions:**
   - Run: `chmod -R 775 storage bootstrap/cache`.
   - Run: `php artisan storage:link`.
5. **Hostinger Cron Setup:**
   - Under Hostinger **Cron Jobs**, add a cron running every minute:
     ```bash
     * * * * * cd /home/u123456789/resto_backend && php artisan schedule:run >> /dev/null 2>&1
     ```

### 2. Frontend Migration (Next.js on Hostinger Node.js Web App)
1. In Hostinger hPanel, go to **Node.js Web App**.
2. Select Node version **20.x** or **22.x**.
3. Set Application root to your frontend folder and startup file to `node_modules/next/dist/bin/next` with argument `start`.
4. Set Environment Variable: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1`.
5. Run build and start the application.
