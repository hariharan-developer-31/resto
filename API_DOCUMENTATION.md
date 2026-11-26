# RESTAURANT OS - API SPECIFICATION (v1)

**Base URL:** `/api/v1`  
**Authentication Scheme:** `Bearer <Sanctum_Token>`  
**Tenant Scoping Headers:**
- `X-Restaurant-ID`: Target Restaurant ID or Slug (Validated against user's access)
- `X-Branch-ID`: Target Branch ID (Validated against user's access)

---

## 1. Public & System

### 1.1 System Health
- **Endpoint:** `GET /health`
- **Auth:** None
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "System health status",
  "data": {
    "status": "healthy",
    "version": "1.0.0-phase3",
    "environment": "production",
    "database": "connected",
    "timestamp": "2026-11-26T12:00:00+05:30"
  }
}
```

### 1.2 Public Bootstrap Meta
- **Endpoint:** `GET /bootstrap`
- **Auth:** None
- **Response `200 OK`:** Returns platform configuration, design tokens, and active restaurant list.

---

## 2. Authentication

### 2.1 User Login
- **Endpoint:** `POST /auth/login`
- **Auth:** None (Rate-limited: 60 req/min)
- **Request Body:**
```json
{
  "login": "superadmin@resto.com",
  "password": "password123"
}
```

### 2.2 User Profile (`Me`)
- **Endpoint:** `GET /auth/me`
- **Auth:** `Bearer <token>`

### 2.3 Logout
- **Endpoint:** `POST /auth/logout`
- **Auth:** `Bearer <token>`

### 2.4 Change Password
- **Endpoint:** `POST /auth/change-password`
- **Auth:** `Bearer <token>`

### 2.5 Forgot / Reset Password
- `POST /auth/forgot-password` (Body: `{"email": "user@resto.com"}`)
- `POST /auth/reset-password` (Body: `{"email": "...", "token": "...", "password": "...", "password_confirmation": "..."}`)

---

## 3. Super Admin Analytics

### 3.1 Global Dashboard Statistics
- **Endpoint:** `GET /super-admin/dashboard`
- **Auth:** `Bearer <token>` (Super Admin or `dashboard.view`)
- **Response `200 OK`:** Returns overview metrics (revenue, orders, active tables), 7-day revenue trends, restaurant performance table, and recent orders.

---

## 4. Restaurant Management

- `GET /restaurants?search=grand&page=1` – Paginated list of restaurants.
- `POST /restaurants` – Create restaurant (`name`, `slug`, `phone`, `email`, `currency`, `timezone`, etc.).
- `GET /restaurants/{id}` – Single restaurant details with branches and staff.
- `PUT /restaurants/{id}` – Update restaurant attributes.
- `DELETE /restaurants/{id}` – Archive restaurant (safeguarded against active orders).
- `POST /restaurants/{id}/toggle-status` – Toggle active/inactive.

---

## 5. Branch Management

- `GET /restaurants/{restaurant}/branches` – List branches for restaurant.
- `POST /restaurants/{restaurant}/branches` – Create branch with code, opening hours, tax rate.
- `GET /restaurants/{restaurant}/branches/{branch}` – Branch details.
- `PUT /restaurants/{restaurant}/branches/{branch}` – Update branch.
- `DELETE /restaurants/{restaurant}/branches/{branch}` – Archive branch.
- `POST /restaurants/{restaurant}/branches/{branch}/toggle-status` – Toggle branch active status.

---

## 6. User & Staff Management

- `GET /users?role=Waiter&search=Arun` – List users with filters.
- `POST /users` – Create staff user with roles, restaurant assignments, and branch assignments.
- `GET /users/{id}` – User details.
- `PUT /users/{id}` – Update user profile and assigned scopes.
- `DELETE /users/{id}` – Archive user (safeguarded against deleting oneself).
- `POST /users/{id}/toggle-status` – Deactivate/activate user account.
- `POST /users/{id}/reset-password` – Direct admin password reset.

---

## 7. Roles & Permissions Matrix

- `GET /roles` – List all roles and grouped permissions across 14 modules.
- `POST /roles` – Create custom role (`name`, `permissions`: `["tables.view", "orders.create"]`).
- `PUT /roles/{id}` – Update role permissions.
- `DELETE /roles/{id}` – Delete custom role (core system roles protected).

---

## 8. Menu Categories

### 8.1 List Categories
- **Endpoint:** `GET /categories`
- **Headers:** `X-Restaurant-ID` (optional for Super Admin, required for multi-tenant context)
- **Response `200 OK`:** Returns array of categories with item counts and ordering.

### 8.2 Create Category
- **Endpoint:** `POST /categories`
- **Auth:** `Bearer <token>` (`menu.create`)
- **Request Body:**
```json
{
  "name": "Biryani Specialties",
  "description": "Authentic fragrant dum biryanis",
  "sort_order": 1,
  "is_active": true
}
```

### 8.3 Update Category
- **Endpoint:** `PUT /categories/{id}`
- **Auth:** `Bearer <token>` (`menu.edit`)

### 8.4 Delete Category
- **Endpoint:** `DELETE /categories/{id}`
- **Auth:** `Bearer <token>` (`menu.delete`)
- **Safeguard:** Returns `422 Unprocessable Entity` if active menu items are associated with this category.

---

## 9. Menu Items & Dishes Catalog

### 9.1 List Menu Items
- **Endpoint:** `GET /menu-items?category_id=1&search=biryani&type=non_veg`
- **Response `200 OK`:** Returns menu items with variants, addons, and category details.

### 9.2 Create Menu Item
- **Endpoint:** `POST /menu-items`
- **Auth:** `Bearer <token>` (`menu.create`)
- **Request Body:**
```json
{
  "category_id": 1,
  "name": "Chicken Dum Biryani",
  "description": "Slow cooked basmati rice with spices and tender chicken",
  "base_price": 280.00,
  "type": "non_veg",
  "tax_rate": 5.00,
  "preparation_time": 20,
  "kitchen_station": "biryani",
  "is_featured": true,
  "variants": [
    { "name": "Regular", "price": 280.00, "is_default": true },
    { "name": "Family Pack", "price": 750.00, "is_default": false }
  ],
  "addon_ids": [1, 2]
}
```

### 9.3 Toggle Availability
- **Endpoint:** `POST /menu-items/{id}/toggle-availability`
- **Auth:** `Bearer <token>` (`menu.edit`)
- **Response `200 OK`:** Returns updated `is_available` boolean.

### 9.4 Update Menu Item
- **Endpoint:** `PUT /menu-items/{id}`
- **Auth:** `Bearer <token>` (`menu.edit`)

### 9.5 Delete Menu Item
- **Endpoint:** `DELETE /menu-items/{id}`
- **Auth:** `Bearer <token>` (`menu.delete`)

---

## 10. Addons Management

- `GET /addons` – List active restaurant customization addons.
- `POST /addons` – Create addon (`name`, `price`, `is_active`).
- `PUT /addons/{id}` – Update addon details.
- `DELETE /addons/{id}` – Delete addon.

---

## 11. Dining Tables & QR Floor System

### 11.1 List Tables
- **Endpoint:** `GET /tables?branch_id=1&location=Main Dining Hall&status=available`
- **Response `200 OK`:** Returns table array with current status, seating capacity, assigned waiter, and QR token.

### 11.2 Create Dining Table
- **Endpoint:** `POST /tables`
- **Auth:** `Bearer <token>` (`tables.create`)
- **Request Body:**
```json
{
  "table_number": "T-12",
  "seating_capacity": 4,
  "location": "Main Dining Hall"
}
```
*Note: A secure, unpredictable 36-character QR token (e.g. `tbl_a8c9e...`) is automatically generated upon creation.*

### 11.3 Regenerate Table QR Token
- **Endpoint:** `POST /tables/{id}/qr` (or `POST /tables/{id}/generate-qr`)
- **Auth:** `Bearer <token>` (`tables.edit`)
- **Response `200 OK`:** Returns new unpredictable QR token and timestamp, invalidating old standees.

### 11.4 Update Table Status
- **Endpoint:** `POST /tables/{id}/status` (or `PATCH /tables/{id}/status`)
- **Request Body:**
```json
{
  "status": "occupied"
}
```
*Allowed statuses: `available`, `occupied`, `reserved`, `billed`, `cleaning`, `out_of_service`.*

### 11.5 Assign Waiter to Table
- **Endpoint:** `POST /tables/{id}/assign-waiter` (or `PATCH /tables/{id}/waiter`)
- **Request Body:**
```json
{
  "waiter_id": 5
}
```

### 11.6 Delete Table
- **Endpoint:** `DELETE /tables/{id}`
- **Safeguard:** Returns `422 Unprocessable Entity` if the table is currently marked as `occupied`.

---

## 12. Auditing & Security

- `GET /audit-logs?action=menu_item.created&page=1` – Paginated audit events.
- `GET /tenant/verify` – Tenant isolation verification header test.
