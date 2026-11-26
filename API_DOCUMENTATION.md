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
    "version": "1.0.0-phase4",
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

## 7. Orders, POS & KOT Operations

### 7.1 List Orders
- **Endpoint:** `GET /orders`
- **Query Parameters:**
  - `branch_id`: Filter by physical branch
  - `order_status`: Filter by `pending`, `preparing`, `ready`, `completed`, `cancelled`
  - `payment_status`: Filter by `unpaid`, `paid`, `partially_paid`
  - `order_type`: Filter by `dine_in`, `takeaway`, `delivery`
  - `table_id`: Filter by dining table
  - `active_only`: Boolean (`true` returns only active dining sessions)
  - `search`: Searches order numbers, invoice numbers, customer name, and phone
- **Response `200 OK`:** Paginated list with items, table details, and assigned waiter.

### 7.2 Create Order or Append Round
- **Endpoint:** `POST /orders`
- **Auth:** `Bearer <token>` (`orders.create`)
- **Request Body:**
```json
{
  "order_type": "dine_in",
  "table_id": 1,
  "customer_name": "Rahul Sharma",
  "customer_phone": "9876543210",
  "discount_amount": 0.00,
  "service_charge": 0.00,
  "packaging_charge": 0.00,
  "items": [
    {
      "menu_item_id": 1,
      "menu_variant_id": 2,
      "quantity": 2,
      "special_instructions": "Less spicy, extra crisp",
      "addon_ids": [1, 2]
    }
  ]
}
```
*Note:*
- If `table_id` is specified for `dine_in` and the table already has an active open order, items are automatically appended as an incremental **Order Round** (e.g. Round 2, Round 3).
- Generates a sequential **KOT Ticket** (`KOT-YYYYMMDD-XXX`) for the items in this round.
- Automatically marks dining table status as `occupied`.

### 7.3 Get Order Details & Rounds
- **Endpoint:** `GET /orders/{id}`
- **Response `200 OK`:** Returns full order object with items grouped by round number and payment records.

### 7.4 Update Item Preparation Status
- **Endpoint:** `PATCH /order-items/{id}/status`
- **Request Body:**
```json
{
  "status": "served"
}
```
*Allowed statuses:* `pending`, `preparing`, `ready`, `served`, `cancelled`.  
*Note:* Setting status to `served` records `served_at = now()`.

### 7.5 Settle Bill & Collect Payment
- **Endpoint:** `POST /orders/{id}/settle`
- **Auth:** `Bearer <token>` (`orders.edit` or `payments.create`)
- **Request Body (Single Cash Payment):**
```json
{
  "payment_method": "cash",
  "paid_amount": 1000.00,
  "discount_amount": 50.00,
  "table_status_after": "cleaning"
}
```
- **Request Body (Split Payment):**
```json
{
  "payment_method": "split",
  "payments": [
    { "payment_method": "cash", "amount": 500.00 },
    { "payment_method": "upi", "amount": 320.00, "transaction_reference": "UPI998877665544" }
  ],
  "table_status_after": "cleaning"
}
```
*Response `200 OK`:*
- Generates unique tax invoice number (`INV-YYYYMMDD-XXXX`).
- Calculates change amount returned to customer.
- Marks `payment_status = 'paid'` and `order_status = 'completed'`.
- Automatically transitions table status to `cleaning`.

### 7.6 Cancel Order
- **Endpoint:** `POST /orders/{id}/cancel`
- **Request Body:**
```json
{
  "cancellation_reason": "Customer had an emergency before food was prepared."
}
```
*Safeguards:*
- Prevents cancelling an already paid/settled order.
- Cancels all associated order items and frees dining table back to `available`.

---

## 8. Auditing & Security

- `GET /audit-logs?action=order.created&page=1` – Paginated audit events.
- `GET /tenant/verify` – Tenant isolation verification header test.
