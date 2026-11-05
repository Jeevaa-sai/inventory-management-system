# Enterprise-Ready Inventory Management System (MERN Stack)

A full-stack, college semester-grade Web Technology project developed for inventory auditing, stock movements tracking, purchase orders, suppliers, and role-based access control.

---

## 🛠️ Technology Stack
* **Backend:** Node.js & Express.js (v5.3.0) REST API
* **Database:** MongoDB & Mongoose ODM (v9.11.4)
* **Frontend:** React 19 Single Page Application (Vite), pure modular CSS (dark navy theme)
* **Visual Analytics:** Chart.js (Doughnut, Bar, and Line charts)
* **Security & Auth:** Express-Session, Bcrypt password hashing, Double-Submit CSRF protection, and Server-side Role-Based Access Control (RBAC)

---

## 🔑 Demo Logins & Access Matrix

| Role | Username | Password | Server & UI Permissions |
|:---|:---|:---|:---|
| **Admin** | `admin` | `admin123` | Full control: Add/Edit/Delete products, CSV Import/Export, User Management, Suppliers, Purchase Orders |
| **Manager** | `manager` | `manager123` | Restock delivery, Manage Suppliers, Issue and Receive Purchase Orders, View Analytics |
| **Staff** | `staff` | `staff123` | View inventory, adjust stock (`+1`, `-1`, Custom Adjust with reasons: `sold`, `damaged`, `returned`, `correction`) |

---

## 🚀 Quick Setup & How to Run

1. **Install Dependencies:**
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

2. **Seed & Migrate Database:**
   Populates 35 realistic office products across 5 categories, 5 suppliers, 3 roles, and 30 days of movement logs:
   ```bash
   node scripts/migrateAndSeed.js
   ```

3. **Build Frontend:**
   ```bash
   npm run build
   ```

4. **Start Server:**
   ```bash
   npm start
   ```
   Open your browser at: **`http://localhost:5000`**

---

## 📋 Complete REST API Endpoints

### Authentication & Sessions
| Method | Endpoint | Description | Access |
|:---|:---|:---|:---|
| `POST` | `/api/auth/login` | Authenticate user, create session & CSRF token | Public |
| `GET` | `/api/auth/me` | Fetch active user session and CSRF token | Public / Session |
| `POST` | `/api/auth/logout` | Destroy active session and clear cookie | Logged in |
| `POST` | `/api/auth/init` | Auto-seed default administrative accounts | Public |

### Products & Inventory
| Method | Endpoint | Description | Access |
|:---|:---|:---|:---|
| `GET` | `/api/products` | Paginated product list with search, category, status & sort | All Logged In |
| `GET` | `/api/products/:id` | Fetch single product details | All Logged In |
| `POST` | `/api/products` | Create product (unique SKU, price > 0, stock ≥ 0) | Admin Only |
| `PUT` | `/api/products/:id` | Update product details and threshold | Admin Only |
| `DELETE` | `/api/products/:id` | Remove product and associated movements | Admin Only |
| `POST` | `/api/products/:id/adjust` | Adjust stock with reason, note & movement audit row | Staff, Manager, Admin |
| `GET` | `/api/products/:id/movements` | Audit history of stock movements for product | All Logged In |

### Analytics & Reports
| Method | Endpoint | Description | Access |
|:---|:---|:---|:---|
| `GET` | `/api/stats` | KPI card summaries and Chart.js aggregation data | All Logged In |
| `GET` | `/api/movements/recent` | Last 15 movements for real-time audit feed | All Logged In |

### Suppliers & Purchase Orders
| Method | Endpoint | Description | Access |
|:---|:---|:---|:---|
| `GET` | `/api/suppliers` | List all suppliers | All Logged In |
| `POST` | `/api/suppliers` | Create supplier | Manager, Admin |
| `PUT` | `/api/suppliers/:id` | Update supplier details | Manager, Admin |
| `DELETE` | `/api/suppliers/:id` | Remove supplier | Admin Only |
| `GET` | `/api/purchase-orders` | List purchase orders with status | All Logged In |
| `POST` | `/api/purchase-orders` | Create new purchase order | Manager, Admin |
| `POST` | `/api/purchase-orders/:id/receive` | Mark received: auto-increments stock & logs movement | Manager, Admin |

### User Management
| Method | Endpoint | Description | Access |
|:---|:---|:---|:---|
| `GET` | `/api/users` | List all system accounts | Admin Only |
| `POST` | `/api/users` | Create user with hashed password and role | Admin Only |
| `PUT` | `/api/users/:id` | Update role or toggle account active/deactive | Admin Only |
| `POST` | `/api/users/:id/reset-password` | Set new password for user | Admin Only |
| `DELETE` | `/api/users/:id` | Delete user account | Admin Only |
