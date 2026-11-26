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
    "version": "1.0.0-phase5",
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

- `POST /auth/login` – Rate-limited user authentication (`login`, `password`).
- `GET /auth/me` – Current authenticated user details and active permissions.
- `POST /auth/change-password` – Self-service password change.
- `POST /auth/forgot-password` – Request password reset email.
- `POST /auth/reset-password` – Set new password with token.
- `POST /auth/logout` – Invalidate active Sanctum token.

---

## 3. Super Admin Analytics

- `GET /super-admin/dashboard` – Global platform metrics, revenue trends, restaurant performance table, active orders feed, and recent audit activity.

---

## 4. Restaurant & Branch Governance

- `GET /restaurants` – Paginated list of restaurants.
- `POST /restaurants` – Create restaurant entity.
- `GET /restaurants/{id}` – Single restaurant details with branches.
- `PUT /restaurants/{id}` – Update restaurant attributes.
- `DELETE /restaurants/{id}` – Archive restaurant (safeguarded against active orders).
- `POST /restaurants/{id}/toggle-status` – Toggle restaurant active status.
- `GET /restaurants/{restaurant}/branches` – List branches for restaurant.
- `POST /restaurants/{restaurant}/branches` – Create branch with code, hours, and tax rate.
- `GET /restaurants/{restaurant}/branches/{branch}` – Branch details.
- `PUT /restaurants/{restaurant}/branches/{branch}` – Update branch.
- `DELETE /restaurants/{restaurant}/branches/{branch}` – Archive branch.
- `POST /restaurants/{restaurant}/branches/{branch}/toggle-status` – Toggle branch active status.

---

## 5. Staff & Permissions Matrix

- `GET /users` – List staff with role and restaurant filters.
- `POST /users` – Provision staff user with restaurant and branch assignments.
- `GET /users/{id}` – User profile and scopes.
- `PUT /users/{id}` – Update user profile.
- `DELETE /users/{id}` – Archive user (safeguards against self-deletion).
- `POST /users/{id}/toggle-status` – Deactivate/activate user account.
- `POST /users/{id}/reset-password` – Admin direct password reset.
- `GET /roles` – List roles and permissions grouped across 14 modules.
- `POST /roles` – Create custom role.
- `PUT /roles/{id}` – Update role permissions.
- `DELETE /roles/{id}` – Delete custom role (system roles protected).

---

## 6. Menu Catalog & Dining Tables

- `GET /categories` – List categories with active item counts.
- `POST /categories` – Create category.
- `PUT /categories/{id}` – Update category.
- `DELETE /categories/{id}` – Delete category (safeguards against deleting with active items).
- `GET /menu-items` – List menu items with variants, addons, and category details.
- `POST /menu-items` – Create menu item with variants and addons.
- `PUT /menu-items/{id}` – Update menu item.
- `DELETE /menu-items/{id}` – Soft-delete menu item.
- `POST /menu-items/{id}/toggle-availability` – Instant in-stock/out-of-stock toggle.
- `GET /addons` – List customizable addons.
- `POST /addons` – Create addon.
- `PUT /addons/{id}` – Update addon.
- `DELETE /addons/{id}` – Delete addon.
- `GET /tables` – List dining tables with branch, location, status filters, and assigned waiter.
- `POST /tables` – Create dining table (generates unique unpredictable QR token automatically).
- `POST /tables/{id}/qr` – Regenerate unpredictable QR token.
- `POST /tables/{id}/assign-waiter` – Assign staff waiter.
- `POST /tables/{id}/status` – Update table floor status (`available`, `occupied`, `reserved`, `billed`, `cleaning`).
- `DELETE /tables/{id}` – Delete table (safeguarded against deleting occupied tables).

---

## 7. Orders, POS & Billing Operations

- `GET /orders` – Paginated list of orders with filters (`branch_id`, `order_status`, `payment_status`, `order_type`, `table_id`, `active_only`, `search`).
- `POST /orders` – Create order or append round to occupied table. Generates KOT number (`KOT-YYYYMMDD-XXX`).
- `GET /orders/{id}` – Full order object with items grouped by round and payment records.
- `PATCH /order-items/{id}/status` – Update item preparation status (`pending`, `preparing`, `ready`, `served`, `cancelled`).
- `POST /orders/{id}/settle` – Settle bill via Cash, Card, UPI, or Split payment. Generates tax invoice (`INV-YYYYMMDD-XXXX`) and resets table.
- `POST /orders/{id}/cancel` – Cancel order with mandatory reason and frees dining table.

---

## 8. Kitchen Display System (KDS)

### 8.1 List KDS Tickets
- **Endpoint:** `GET /kds/tickets`
- **Auth:** `Bearer <token>` (`kitchen.view`)
- **Query Parameters:**
  - `station`: `all` (default), `main`, `grill`, `tandoor`, `biryani`, `beverage`, `dessert`
  - `mode`: `active` (default, pending/preparing tickets) or `completed` (ready/served within 4 hours)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "KDS tickets retrieved successfully.",
  "data": {
    "station": "all",
    "mode": "active",
    "tickets_count": 2,
    "tickets": [
      {
        "kot_number": "KOT-20261126-001",
        "order_id": 4,
        "order_number": "ORD-20261126-0004",
        "order_type": "dine_in",
        "table_number": "T-01",
        "table_location": "Main Dining Hall",
        "waiter_name": "Arun Waiter",
        "round_number": 1,
        "created_at": "2026-11-26T13:00:00+05:30",
        "elapsed_minutes": 8,
        "urgency": "normal",
        "total_items": 3,
        "items": [
          {
            "id": 12,
            "name": "Chicken Dum Biryani",
            "variant_name": "Family Pack",
            "quantity": 2,
            "status": "preparing",
            "kitchen_station": "biryani",
            "special_instructions": "Less spicy, please",
            "addons": [
              { "name": "Extra Salan Gravy", "quantity": 2 }
            ]
          }
        ],
        "all_preparing": true,
        "all_ready": false
      }
    ]
  }
}
```

### 8.2 Update Dish Item Status
- **Endpoint:** `PATCH /kds/items/{id}/status`
- **Auth:** `Bearer <token>` (`kitchen.view`)
- **Request Body:**
```json
{
  "status": "ready"
}
```
*Allowed statuses:* `pending`, `preparing`, `ready`, `served`, `cancelled`. Automatically synchronizes overall order status to `preparing` or `ready`.

### 8.3 Batch Mark Whole Ticket Ready
- **Endpoint:** `POST /kds/tickets/{kot_number}/ready`
- **Auth:** `Bearer <token>` (`kitchen.view`)
- **Query / Body Parameters:**
  - `station`: Optional station scope (e.g. `biryani` or `all`).
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "KOT ticket KOT-20261126-001 marked as Ready for pickup.",
  "data": {
    "kot_number": "KOT-20261126-001",
    "updated_items_count": 2
  }
}
```

### 8.4 KDS Station Summary Metrics
- **Endpoint:** `GET /kds/summary`
- **Auth:** `Bearer <token>` (`kitchen.view`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "KDS summary metrics retrieved.",
  "data": {
    "pending_items": 4,
    "preparing_items": 6,
    "ready_items": 2,
    "overdue_tickets": 1,
    "station_counts": {
      "main": 3,
      "grill": 1,
      "tandoor": 2,
      "biryani": 4,
      "beverage": 0,
      "dessert": 0
    }
  }
}
```

---

## 9. Auditing & Security

- `GET /audit-logs?action=kds.item_status_updated&page=1` – Paginated audit events.
- `GET /tenant/verify` – Tenant isolation verification header test.
