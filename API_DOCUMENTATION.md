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

---

## 10. Public Guest & Contactless QR Ordering Portal

All endpoints under `/public/` do not require Sanctum user authentication.

### 10.1 Restaurant Public Brand Profile
- **Endpoint:** `GET /public/restaurant/{slugOrId}`
- **Auth:** None (Public)
- **Response `200 OK`:** Returns restaurant details, branding tokens, active branch addresses, phone numbers, opening hours, and active menu items grouped by category with variants and add-ons.

### 10.2 Table QR Token Resolution
- **Endpoint:** `GET /public/table/{qrToken}`
- **Auth:** None (Public)
- **Response `200 OK`:** Validates the 36-character random table token (`tbl_...`), returns the assigned restaurant, branch, table number, capacity, and any currently active order session on that table.

### 10.3 Contactless Table Order Placement
- **Endpoint:** `POST /public/table/{qrToken}/order`
- **Auth:** None (Public)
- **Request Body:**
```json
{
  "customer_name": "Suresh Kumar",
  "customer_phone": "9888877777",
  "special_instructions": "Table guest order",
  "items": [
    {
      "menu_item_id": 1,
      "menu_variant_id": 2,
      "quantity": 2,
      "special_instructions": "Extra raita please",
      "addon_ids": [1, 3]
    }
  ]
}
```
- **Response `201 Created`:** Creates a new Dine-in Order or appends an additional order round (`Round 2`, `Round 3`) if the table is already occupied. Dispatches a new KOT number and updates table status to `occupied`.

### 10.4 Live Order Preparation Tracking
- **Endpoint:** `GET /public/orders/{orderNumber}/track`
- **Auth:** None (Public)
- **Response `200 OK`:** Returns real-time 4-stage cooking progress (`pending`, `preparing`, `ready`, `completed`), elapsed cooking time, current KOT, and list of round items with their individual preparation states.

### 10.5 Digital Table Bell Service Request
- **Endpoint:** `POST /public/table/{qrToken}/service-request`
- **Auth:** None (Public)
- **Request Body:**
```json
{
  "request_type": "call_waiter", // "call_waiter", "water", "bill", "custom"
  "message": "Need additional cutlery"
}
```
- **Response `200 OK`:** Records service bell notification and logs audit event for floor staff.

### 10.6 Table Reservation Booking
- **Endpoint:** `POST /public/reservations`
- **Auth:** None (Public)
- **Request Body:**
```json
{
  "restaurant_id": 1,
  "branch_id": 1,
  "customer_name": "Meera Krishnan",
  "customer_phone": "+91 91234 56789",
  "customer_email": "meera@example.com",
  "guest_count": 4,
  "reservation_date": "2026-11-27",
  "reservation_time": "20:00",
  "special_requests": "Quiet booth preferred"
}
```
- **Response `201 Created`:** Confirms reservation with booking timestamp, branch, and guest details.

---

## 11. Table Reservations & Inventory Management (Phase 7)

### 11.1 Table Reservations Management
- `GET /reservations` – List reservations with filtering (`date`, `branch_id`, `status`, `search`).
- `POST /reservations` – Create reservation with party size, time slot, and table conflict validation.
- `GET /reservations/{id}` – View single reservation with table and branch details.
- `PUT /reservations/{id}` – Update reservation details.
- `PATCH /reservations/{id}/status` – Transition status (`confirmed`, `checked_in`, `seated`, `completed`, `cancelled`, `no_show`). Automatically marks table `occupied` on `seated`.
- `POST /reservations/{id}/assign-table` – Assign dining table with seating capacity fit check and 90-minute time-slot conflict safeguard.
- `DELETE /reservations/{id}` – Soft delete reservation.

### 11.2 Suppliers Directory
- `GET /suppliers` – List suppliers with active item counts and payment terms.
- `POST /suppliers` – Register new vendor (`name`, `contact_person`, `phone`, `email`, `address`, `tax_number`, `payment_terms`).
- `GET /suppliers/{id}` – View supplier with supplied inventory items and purchase orders.
- `PUT /suppliers/{id}` – Update supplier attributes.
- `DELETE /suppliers/{id}` – Soft delete supplier.

### 11.3 Raw Materials & Stock Management
- `GET /inventory` – List inventory items with category filter, stock status filter, and pagination.
- `POST /inventory` – Register raw material / ingredient (`name`, `sku`, `category`, `unit`, `current_stock`, `minimum_stock`, `unit_cost`, `storage_location`, `supplier_id`).
- `GET /inventory/alerts` – Fast query for critical shortages where `current_stock <= minimum_stock`.
- `POST /inventory/adjust` – Record manual stock movement (`audit_adjustment`, `wastage`, `spoilage`, `purchase_in`, `return`) with delta quantity, reason, and notes.
- `GET /inventory/{id}` – Item details with 20 most recent audited stock movements.
- `PUT /inventory/{id}` – Update item specifications and thresholds.
- `DELETE /inventory/{id}` – Soft delete item.

### 11.4 Recipe Bill of Materials (BOM)
- `GET /menu-items/{id}/recipe` – Retrieve recipe ingredients and consumed quantities per portion.
- `POST /menu-items/{id}/recipe` – Save / replace recipe ingredients array (`inventory_item_id`, `menu_variant_id`, `quantity_required`, `unit`).

### 11.5 Purchase Orders & Goods Intake
- `GET /purchase-orders` – List purchase orders with status filtering.
- `POST /purchase-orders` – Issue PO with line items (`inventory_item_id`, `quantity_ordered`, `unit_cost`), computes subtotal + 5% input GST.
- `GET /purchase-orders/{id}` – View PO with items and supplier details.
- `POST /purchase-orders/{id}/receive` – Receive shipment goods. Updates received quantities, marks PO as `received` (or `partially_received`), automatically increments inventory `current_stock`, and records audited `purchase_in` stock movements.

---

## 12. Business Analytics, Executive Reports & SaaS Subscriptions (Phase 8)

### 12.1 Revenue & Sales Overview Analytics
- **Endpoint:** `GET /analytics/overview`
- **Auth:** `Bearer <token>` (`dashboard.view`)
- **Query Parameters:**
  - `start_date`: e.g. `2026-11-01`
  - `end_date`: e.g. `2026-11-26`
  - `branch_id`: Optional branch filter
- **Response `200 OK`:** Returns aggregated gross revenue, net food sales, tax liabilities, average order value (AOV), total guests served, Recharts-ready daily revenue trend array, order type distributions (Dine-in vs Takeaway vs Delivery), payment tender breakdown (Cash vs UPI vs Card), and 24-hour dining volume rush.

### 12.2 Menu Engineering & Product Mix
- **Endpoint:** `GET /analytics/menu-engineering`
- **Auth:** `Bearer <token>` (`dashboard.view`)
- **Response `200 OK`:** Returns top 15 ranked dishes by cumulative sales revenue and portions sold, average unit price, and category contribution percentages.

### 12.3 Table Turnaround & Occupancy Efficiency
- **Endpoint:** `GET /analytics/table-efficiency`
- **Auth:** `Bearer <token>` (`dashboard.view`)
- **Response `200 OK`:** Returns average table turnaround duration in minutes (from seating to settlement), floor occupancy percentage, and section-by-section table utilization.

### 12.4 End-of-Day (EOD) Z-Report
- **Endpoint:** `GET /reports/eod`
- **Auth:** `Bearer <token>` (`dashboard.view`)
- **Query Parameters:** `date` (defaults to today)
- **Response `200 OK`:** Returns printable register balance sheet including gross sales, net sales, discounts, CGST (2.5%), SGST (2.5%), total tax collected, tender reconciliation (cash, UPI, card), order statistics, and cancelled orders audit.

### 12.5 GST & Tax Compliance Ledger
- **Endpoint:** `GET /reports/tax`
- **Auth:** `Bearer <token>` (`dashboard.view`)
- **Query Parameters:** `start_date`, `end_date`
- **Response `200 OK`:** Returns taxable sales value, CGST (2.5%), SGST (2.5%), total tax liability, and tax invoice counts.

### 12.6 Multi-Restaurant SaaS Subscription & Quotas
- `GET /subscription/plans` – Returns public / tenant list of available subscription tiers (`Starter`, `Growth Pro`, `Enterprise Elite`).
- `GET /subscription/current` – Returns tenant's active subscription tier, billing cycle, renewal date, and live resource quota meters for branches, dining tables, and staff member accounts.
- `POST /subscription/upgrade` – Upgrade or switch subscription tier with payment reference. Immediately expands tenant quotas.
- `POST /super-admin/plans` – Super Admin endpoint to create new custom subscription tiers.
