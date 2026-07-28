# Mini ERP + CRM Operations Portal

A complete, responsive, full-stack Mini ERP and CRM portal designed for wholesale/distribution businesses. The application enables role-based user flows to manage customers (CRM), products, stock movements, and issue sales challans with invoice print capabilities.

---

## 🚀 Quick Start (Local Setup)

Follow these simple steps to run both the backend server and frontend client locally on your machine.

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **NPM** (v9 or higher)

### 1. Run the Backend Server
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Initialize the database (SQLite) and apply migrations:
   ```bash
   npx prisma migrate dev --name init
   ```
4. Seed the database with mock credentials and products:
   ```bash
   npm run db:seed
   ```
5. Start the server in developer mode (runs on `http://localhost:5000`):
   ```bash
   npm run dev
   ```

### 2. Run the Frontend Client
1. Open a second terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies (handles peer conflicts smoothly):
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start the Vite development server (runs on `http://localhost:5173`):
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173`.

---

## 🐳 Docker Setup (Alternative)

If you have Docker and Docker Compose installed, you can spin up the entire application (frontend + backend + SQLite) using a single command from the project root:

```bash
docker-compose up --build
```
- **Frontend** will be accessible at: `http://localhost:3000`
- **Backend** will be accessible at: `http://localhost:5000`

---

## 🔑 Test Login Credentials

To make grading and verification simple, the system features a **Quick Login Selector** on the login page. Alternatively, you can type in these credentials:

| Username | Password | Role | Privileges Description |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin123` | **Admin** | Full system permissions (CRUD Customers, Products, Stock, Challans). |
| **`sales`** | `sales123` | **Sales** | Can manage CRM contacts, follow-up logs, and create/confirm challans. View-only stock. |
| **`warehouse`** | `warehouse123` | **Warehouse** | Can create/edit products, log manual stock adjustments (IN/OUT), and view ledgers. No CRM access. |
| **`accounts`** | `accounts123` | **Accounts** | Read-only access across all views. Authorized to view and print/PDF invoices. |

---

## 🛠️ Architecture & Key Business Logics

### 1. Database Schema & Snapshot Locking
- **SQLite / PostgreSQL Compatibility**: Handled seamlessly through Prisma ORM. Switching databases is as simple as updating the `provider` field in `prisma/schema.prisma` and updating your `.env` connection string.
- **Product Details Snaplocking**: In the `ChallanItem` table, we store snapshots of the product details (`name`, `sku`, `unitPrice`) at the exact moment the Challan is generated. This ensures historical integrity if a product's price changes or it is deleted from the catalog.

### 2. Sales Challan Workflows (Atomic Transactions)
- **Automatic Auto-numbering**: Challans automatically generate sequential IDs based on the current year (e.g., `CH-2026-0001`, `CH-2026-0002`).
- **Inventory Verification**: Saving a Challan as `Confirmed` checks available stock levels. If any item is out of stock, the transaction is aborted with a clear error. If validated, stock is deducted atomically.
- **Stock Reversion**: If an admin cancels a `Confirmed` challan, the quantities are automatically restored to the warehouse catalog, and stock logs are logged as `IN`.

### 3. Print Invoice Generation (Export to PDF)
- Integrates custom `@media print` CSS configurations to construct clean, professional invoices when clicking **Print/PDF Invoice** (using browser print engine to export directly to a PDF document, hiding sidebar controls and adjusting colors to print-friendly shades).

---

## 📑 API Endpoints Documentation

All requests expect content-type `application/json`. Authenticated routes require an `Authorization: Bearer <token>` header.

### 🔒 Authentication
- **`POST /api/auth/login`**
  - **Body**: `{ "username": "admin", "password": "admin123" }`
  - **Response**: `{ "token": "JWT_TOKEN", "user": { "id": "...", "username": "...", "name": "...", "role": "..." } }`
- **`GET /api/auth/me`**
  - **Response**: `{ "user": { "id": "...", "role": "..." } }`

### 👥 Customer CRM
- **`GET /api/customers`** (Admin, Sales, Accounts)
  - **Query Params**: `search`, `status` (Lead, Active, Inactive), `type` (Retail, Wholesale, Distributor), `page`, `limit`
  - **Response**: List of customers with paginated metadata.
- **`GET /api/customers/:id`** (Admin, Sales, Accounts)
  - **Response**: Full customer details including a timeline array of `followUps`.
- **`POST /api/customers`** (Admin, Sales)
  - **Body**: Customer details object.
- **`PUT /api/customers/:id`** (Admin, Sales)
  - **Body**: Updated details.
- **`POST /api/customers/:id/notes`** (Admin, Sales)
  - **Body**: `{ "note": "Interaction details..." }`
  - **Response**: Appends a follow-up note into the history log.

### 📦 Product & Inventory
- **`GET /api/products`** (All roles)
  - **Query Params**: `search`, `category`, `lowStock` (`true` to filter items below safety stock alert limits).
- **`POST /api/products`** (Admin, Warehouse)
  - **Body**: Product details object (creates catalog entry, logs initial stock).
- **`PUT /api/products/:id`** (Admin, Warehouse)
  - **Body**: Partial product specifications.
- **`GET /api/products/:id/logs`** (Admin, Warehouse)
  - **Response**: Audit timeline list showing all stock movements for the product.
- **`POST /api/products/:id/stock`** (Admin, Warehouse)
  - **Body**: `{ "quantity": 10, "movementType": "IN" | "OUT", "reason": "Restock" }`
  - **Response**: Atomically adjusts inventory levels and registers audit entry.

### 🧾 Sales Challans
- **`GET /api/challans`** (All roles)
  - **Query Params**: `status` (Draft, Confirmed, Cancelled), `search` (challan number or business name).
- **`GET /api/challans/:id`** (All roles)
  - **Response**: Detailed invoice representation (customer info + snapshot items).
- **`POST /api/challans`** (Admin, Sales)
  - **Body**: `{ "customerId": "...", "status": "Draft" | "Confirmed", "items": [{ "productId": "...", "quantity": 5 }] }`
- **`PUT /api/challans/:id/status`** (Admin, Sales, Warehouse)
  - **Body**: `{ "status": "Confirmed" | "Cancelled" }`
  - **Response**: Processes inventory adjustments based on transition (e.g. Draft ➔ Confirmed deducts stock; Confirmed ➔ Cancelled restores stock).

---

## ⚠️ Known Limitations
- **Database Engine**: Uses SQLite for convenient, zero-dependency local setup. For high-volume multi-user environments, we recommend changing the datasource provider inside `prisma/schema.prisma` to `postgresql` or `mysql` and utilizing a managed server.
- **Session Duration**: JWT tokens are issued with a 24-hour expiration duration. Session refresh flows are currently not active.
