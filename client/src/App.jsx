import { useState, useEffect, useRef } from "react";
import "./App.css";

// Currency Formatter as required by Ground Rules
const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

function formatINR(val) {
  return inrFormatter.format(Number(val) || 0);
}

const emptyProductForm = {
  name: "",
  sku: "",
  category: "Electronics",
  price: "",
  quantity: "",
  reorder_level: 5
};

function App() {
  // Session & Auth State
  const [user, setUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [loginCreds, setLoginCreds] = useState({ username: "admin", password: "admin123" });
  const [loginError, setLoginError] = useState("");

  // Navigation
  const [activeTab, setActiveTab] = useState("inventory");

  // Inventory Table State
  const [products, setProducts] = useState([]);
  const [totalProductsCount, setTotalProductsCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("name_asc");
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalQuantity: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalValue: 0
  });

  // Modals & Drawers
  const [productModal, setProductModal] = useState({ open: false, editId: null, form: emptyProductForm });
  const [adjustModal, setAdjustModal] = useState({ open: false, product: null, change: 1, reason: "sold", note: "" });
  const [restockModal, setRestockModal] = useState({ open: false, product: null, quantity: 10, supplier_id: "" });
  const [deleteModal, setDeleteModal] = useState({ open: false, product: null });
  const [historyDrawer, setHistoryDrawer] = useState({ open: false, product: null, movements: [] });

  // Phase 4: Suppliers, POs, Users State
  const [suppliers, setSuppliers] = useState([]);
  const [supplierModal, setSupplierModal] = useState({ open: false, editId: null, name: "", contact_person: "", phone: "", email: "" });
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [poModal, setPoModal] = useState({ open: false, product_id: "", supplier_id: "", quantity: 10 });
  const [usersList, setUsersList] = useState([]);
  const [userModal, setUserModal] = useState({ open: false, username: "", password: "", role: "staff", fullName: "" });
  const [resetPwdModal, setResetPwdModal] = useState({ open: false, user: null, newPassword: "" });

  // Phase 5: Dashboard Analytics & Reports State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [recentMovements, setRecentMovements] = useState([]);
  const [timelineDays, setTimelineDays] = useState(30);
  const [csvImportModal, setCsvImportModal] = useState({ open: false, preview: [], rawText: "", error: "" });

  // Toast Notifications
  const [toasts, setToasts] = useState([]);

  // Chart Canvas Refs
  const chartValRef = useRef(null);
  const chartUnitsRef = useRef(null);
  const chartTimelineRef = useRef(null);
  const chartInstances = useRef({});

  // 1. Initial Auth & Session Verification
  useEffect(() => {
    fetchSession();
  }, []);

  async function fetchSession() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setCsrfToken(data.csrfToken);
      }
    } catch {
      // Not logged in
    }
  }

  function showToast(message, type = "info") {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }

  // 2. Fetch Data when logged in or filters change
  useEffect(() => {
    if (!user) return;
    loadProducts();
    loadStats();
    loadSuppliers();
  }, [user, page, search, categoryFilter, statusFilter, sortBy]);

  // Tab change handlers
  useEffect(() => {
    if (!user) return;
    if (activeTab === "orders") loadPurchaseOrders();
    if (activeTab === "users" && user.role === "admin") loadUsers();
    if (activeTab === "analytics") {
      loadAnalytics();
      loadRecentMovements();
    }
  }, [activeTab, user, timelineDays]);

  // Debounced Search
  const searchTimeoutRef = useRef(null);
  function handleSearchChange(e) {
    const val = e.target.value;
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 300);
  }

  // API Call Helpers
  async function apiRequest(url, method = "GET", body = null) {
    const headers = { "Content-Type": "application/json" };
    if (csrfToken && method !== "GET") {
      headers["x-csrf-token"] = csrfToken;
    }
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data;
  }

  // Products Loader
  async function loadProducts() {
    try {
      const query = new URLSearchParams({
        page,
        limit: 10,
        search,
        category: categoryFilter,
        status: statusFilter,
        sort: sortBy
      });
      const data = await apiRequest(`/api/products?${query.toString()}`);
      setProducts(data.products || []);
      setTotalProductsCount(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Stats Loader
  async function loadStats() {
    try {
      const data = await apiRequest("/api/stats");
      if (data.cards) setStats(data.cards);
    } catch {
      // Ignore
    }
  }

  // Suppliers & POs Loader
  async function loadSuppliers() {
    try {
      const data = await apiRequest("/api/suppliers");
      setSuppliers(data || []);
    } catch {
      // Ignore
    }
  }

  async function loadPurchaseOrders() {
    try {
      const data = await apiRequest("/api/purchase-orders");
      setPurchaseOrders(data || []);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Users Loader
  async function loadUsers() {
    try {
      const data = await apiRequest("/api/users");
      setUsersList(data || []);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Analytics & Recent Movements Loader
  async function loadAnalytics() {
    try {
      const data = await apiRequest(`/api/stats?days=${timelineDays}`);
      setAnalyticsData(data);
      renderCharts(data);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function loadRecentMovements() {
    try {
      const data = await apiRequest("/api/movements/recent");
      setRecentMovements(data || []);
    } catch {
      // Ignore
    }
  }

  // Render Chart.js charts
  function renderCharts(data) {
    if (!window.Chart || !data || !data.charts) return;

    // Destroy existing instances to prevent canvas reuse errors
    Object.values(chartInstances.current).forEach(c => c && c.destroy());
    chartInstances.current = {};

    const { categoryStats, timeline } = data.charts;

    // 1. Category Value Doughnut
    if (chartValRef.current) {
      chartInstances.current.val = new window.Chart(chartValRef.current, {
        type: "doughnut",
        data: {
          labels: categoryStats.map(c => c.category),
          datasets: [{
            data: categoryStats.map(c => c.value),
            backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#64748b"]
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "bottom" } }
        }
      });
    }

    // 2. Category Units Bar
    if (chartUnitsRef.current) {
      chartInstances.current.units = new window.Chart(chartUnitsRef.current, {
        type: "bar",
        data: {
          labels: categoryStats.map(c => c.category),
          datasets: [{
            label: "Stock Units",
            data: categoryStats.map(c => c.units),
            backgroundColor: "#2563eb",
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } }
        }
      });
    }

    // 3. Stock In vs Out Timeline
    if (chartTimelineRef.current) {
      chartInstances.current.timeline = new window.Chart(chartTimelineRef.current, {
        type: "line",
        data: {
          labels: timeline.map(t => t.date.slice(5)),
          datasets: [
            {
              label: "Stock In (+)",
              data: timeline.map(t => t.in),
              borderColor: "#10b981",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              tension: 0.3,
              fill: true
            },
            {
              label: "Stock Out (-)",
              data: timeline.map(t => t.out),
              borderColor: "#ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              tension: 0.3,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { position: "top" } }
        }
      });
    }
  }

  // Login Handler
  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    try {
      const data = await apiRequest("/api/auth/login", "POST", loginCreds);
      setUser(data.user);
      setCsrfToken(data.csrfToken);
      showToast(`Welcome back, ${data.user.fullName || data.user.username}!`, "success");
    } catch (err) {
      setLoginError(err.message);
    }
  }

  // Logout Handler
  async function handleLogout() {
    try {
      await apiRequest("/api/auth/logout", "POST");
    } catch {
      // Ignore
    }
    setUser(null);
    setCsrfToken("");
    showToast("Logged out successfully", "info");
  }

  // Quick Stock Adjustment (+1 returned, -1 sold)
  async function handleQuickAdjust(product, change, reason) {
    try {
      const data = await apiRequest(`/api/products/${product._id}/adjust`, "POST", {
        change,
        reason,
        note: `Quick ${reason}`
      });
      showToast(`${product.name}: ${change > 0 ? "+" + change : change} units (${reason})`, "success");
      // Update affected product in table without full reload
      setProducts(prev => prev.map(p => p._id === product._id ? data.product : p));
      loadStats();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Modal Stock Adjust
  async function handleCustomAdjust(e) {
    e.preventDefault();
    const { product, change, reason, note } = adjustModal;
    try {
      const data = await apiRequest(`/api/products/${product._id}/adjust`, "POST", {
        change: Number(change),
        reason,
        note
      });
      showToast(`Stock updated: ${change > 0 ? "+" + change : change} units`, "success");
      setProducts(prev => prev.map(p => p._id === product._id ? data.product : p));
      setAdjustModal({ open: false, product: null, change: 1, reason: "sold", note: "" });
      loadStats();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Restock Modal Submit
  async function handleRestockSubmit(e) {
    e.preventDefault();
    const { product, quantity, supplier_id } = restockModal;
    const sup = suppliers.find(s => s._id === supplier_id);
    const note = sup ? `Restocked from ${sup.name}` : "Direct restock";
    try {
      const data = await apiRequest(`/api/products/${product._id}/adjust`, "POST", {
        change: Number(quantity),
        reason: "restock",
        note
      });
      showToast(`Restocked +${quantity} units for ${product.name}`, "success");
      setProducts(prev => prev.map(p => p._id === product._id ? data.product : p));
      setRestockModal({ open: false, product: null, quantity: 10, supplier_id: "" });
      loadStats();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Save / Update Product
  async function handleProductSave(e) {
    e.preventDefault();
    const { editId, form } = productModal;
    try {
      if (editId) {
        const data = await apiRequest(`/api/products/${editId}`, "PUT", form);
        showToast("Product updated successfully", "success");
        setProducts(prev => prev.map(p => p._id === editId ? data.product : p));
      } else {
        const data = await apiRequest("/api/products", "POST", form);
        showToast("Product created successfully", "success");
        setProducts(prev => [data.product, ...prev]);
      }
      setProductModal({ open: false, editId: null, form: emptyProductForm });
      loadStats();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Delete Product
  async function handleDeleteConfirm() {
    const { product } = deleteModal;
    if (!product) return;
    try {
      await apiRequest(`/api/products/${product._id}`, "DELETE");
      showToast(`Deleted ${product.name}`, "success");
      setProducts(prev => prev.filter(p => p._id !== product._id));
      setDeleteModal({ open: false, product: null });
      loadStats();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Product History Drawer
  async function openHistoryDrawer(product) {
    try {
      const movements = await apiRequest(`/api/products/${product._id}/movements`);
      setHistoryDrawer({ open: true, product, movements });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Purchase Order Actions
  async function handleCreatePO(e) {
    e.preventDefault();
    try {
      const data = await apiRequest("/api/purchase-orders", "POST", poModal);
      showToast("Purchase order created", "success");
      setPurchaseOrders(prev => [data.purchaseOrder, ...prev]);
      setPoModal({ open: false, product_id: "", supplier_id: "", quantity: 10 });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleReceivePO(po) {
    try {
      const data = await apiRequest(`/api/purchase-orders/${po._id}/receive`, "POST");
      showToast(data.message, "success");
      setPurchaseOrders(prev => prev.map(o => o._id === po._id ? data.purchaseOrder : o));
      loadProducts();
      loadStats();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // CSV Export & Import (Phase 5)
  function exportProductsCSV() {
    if (!products.length) return showToast("No products to export", "error");
    const headers = ["ID", "SKU", "Name", "Category", "Price", "Quantity", "Reorder_Level"];
    const rows = products.map(p => [
      p._id,
      `"${p.sku}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      p.price,
      p.quantity,
      p.reorder_level || p.minStock || 5
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_products_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast("Products CSV exported successfully", "success");
  }

  function handleCSVFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return setCsvImportModal(prev => ({ ...prev, error: "CSV has no data rows" }));

      const previewRows = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map(p => p.trim().replace(/^["']|["']$/g, ""));
        const [name, sku, category, price, quantity, reorder_level] = parts;
        const numPrice = Number(price);
        const numQty = Number(quantity);
        let error = "";
        if (!name) error = "Missing Name";
        else if (!sku) error = "Missing SKU";
        else if (isNaN(numPrice) || numPrice <= 0) error = "Invalid Price";
        else if (isNaN(numQty) || numQty < 0) error = "Invalid Quantity";

        previewRows.push({ name, sku, category: category || "Other", price: numPrice, quantity: numQty, reorder_level: Number(reorder_level) || 5, error });
      }
      setCsvImportModal({ open: true, preview: previewRows, rawText: text, error: "" });
    };
    reader.readAsText(file);
  }

  async function submitCSVImport() {
    const validRows = csvImportModal.preview.filter(r => !r.error);
    if (!validRows.length) return showToast("No valid rows to import", "error");

    let imported = 0;
    for (const row of validRows) {
      try {
        await apiRequest("/api/products", "POST", row);
        imported++;
      } catch {
        // Continue
      }
    }
    showToast(`Successfully imported ${imported} products!`, "success");
    setCsvImportModal({ open: false, preview: [], rawText: "", error: "" });
    loadProducts();
    loadStats();
  }

  // If Not Authenticated, show Login Card
  if (!user) {
    return (
      <div className="container">
        <div className="card login-card">
          <h2>User Authentication</h2>
          {loginError && <div className="toast error" style={{ position: "static", marginBottom: "14px" }}>{loginError}</div>}
          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: "14px" }}>
              <label>Username</label>
              <input
                type="text"
                value={loginCreds.username}
                onChange={e => setLoginCreds({ ...loginCreds, username: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label>Password</label>
              <input
                type="password"
                value={loginCreds.password}
                onChange={e => setLoginCreds({ ...loginCreds, password: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "10px" }}>
              Sign In
            </button>
          </form>

          <div className="login-demo-bar">
            <strong>Demo Credentials:</strong><br />
            &bull; <b>admin</b> / <code>admin123</code> (Full Administrator)<br />
            &bull; <b>manager</b> / <code>manager123</code> (Restock, Suppliers, POs)<br />
            &bull; <b>staff</b> / <code>staff123</code> (Stock adjustments & View)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Toast Notification Stack */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
        ))}
      </div>

      {/* Top Header */}
      <header>
        <div className="brand-section">
          <h1>Inventory Management System</h1>
          <span className="version-pill">v2.0 Demo-Ready</span>
        </div>
        <div className="user-info">
          <span>{user.fullName || user.username}</span>
          <span className={`role-badge role-${user.role}`}>{user.role}</span>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <button
          className={`tab-btn ${activeTab === "inventory" ? "active" : ""}`}
          onClick={() => setActiveTab("inventory")}
        >
          📦 Inventory & Stock
        </button>
        <button
          className={`tab-btn ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
          📊 Dashboard & Reports
        </button>
        <button
          className={`tab-btn ${activeTab === "orders" ? "active" : ""}`}
          onClick={() => setActiveTab("orders")}
        >
          📋 Purchase Orders ({purchaseOrders.filter(o => o.status === "pending").length} Pending)
        </button>
        <button
          className={`tab-btn ${activeTab === "suppliers" ? "active" : ""}`}
          onClick={() => setActiveTab("suppliers")}
        >
          🏢 Suppliers ({suppliers.length})
        </button>
        {user.role === "admin" && (
          <button
            className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            👥 User Management
          </button>
        )}
      </nav>

      {/* 4 Clickable KPI Cards */}
      <section className="stats-grid">
        <div
          className="stat-card"
          onClick={() => { setStatusFilter("ALL"); setCategoryFilter("ALL"); setPage(1); setActiveTab("inventory"); }}
          title="Click to view all products"
        >
          <div className="stat-label">Total Products</div>
          <div className="stat-number">{stats.totalProducts}</div>
          <div className="stat-hint">Click to show all</div>
        </div>
        <div
          className="stat-card success"
          onClick={() => { setStatusFilter("in_stock"); setPage(1); setActiveTab("inventory"); }}
          title="Click to filter in-stock items"
        >
          <div className="stat-label">Total Stock Units</div>
          <div className="stat-number">{stats.totalQuantity}</div>
          <div className="stat-hint">In-stock filter</div>
        </div>
        <div
          className="stat-card alert"
          onClick={() => { setStatusFilter("low_stock"); setPage(1); setActiveTab("inventory"); }}
          title="Click to filter low stock items"
        >
          <div className="stat-label">Low Stock Items</div>
          <div className="stat-number">{stats.lowStockCount}</div>
          <div className="stat-hint">Click for reorder alert</div>
        </div>
        <div
          className="stat-card value"
          onClick={() => setActiveTab("analytics")}
          title="Click to view valuation breakdown"
        >
          <div className="stat-label">Total Inventory Value</div>
          <div className="stat-number">{formatINR(stats.totalValue)}</div>
          <div className="stat-hint">View analytics breakdown</div>
        </div>
      </section>

      {/* ================= TAB 1: INVENTORY & STOCK ================= */}
      {activeTab === "inventory" && (
        <section className="card">
          <h2>
            <span>Product Catalog</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn btn-outline btn-sm" onClick={exportProductsCSV}>📥 Export CSV</button>
              {user.role === "admin" && (
                <>
                  <label className="btn btn-outline btn-sm" style={{ cursor: "pointer" }}>
                    📤 Import CSV
                    <input type="file" accept=".csv" onChange={handleCSVFile} style={{ display: "none" }} />
                  </label>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setProductModal({ open: true, editId: null, form: emptyProductForm })}
                  >
                    + Add Product
                  </button>
                </>
              )}
            </div>
          </h2>

          {/* Search, Filter, Sort Toolbar */}
          <div className="filter-bar">
            <input
              type="text"
              placeholder="Search by product name or SKU..."
              defaultValue={search}
              onChange={handleSearchChange}
            />
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
              <option value="ALL">All Categories</option>
              <option value="Electronics">Electronics</option>
              <option value="Stationery">Stationery</option>
              <option value="Furniture">Furniture</option>
              <option value="Cleaning Supplies">Cleaning Supplies</option>
              <option value="Office Pantry">Office Pantry</option>
            </select>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="ALL">All Statuses</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock (≤ Alert Level)</option>
              <option value="out_of_stock">Out of Stock (0)</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="name_asc">Sort: Name (A-Z)</option>
              <option value="name_desc">Sort: Name (Z-A)</option>
              <option value="price_asc">Sort: Price (Low → High)</option>
              <option value="price_desc">Sort: Price (High → Low)</option>
              <option value="stock_asc">Sort: Stock (Low → High)</option>
              <option value="stock_desc">Sort: Stock (High → Low)</option>
            </select>
          </div>

          {/* Product Data Table */}
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>SKU</th>
                  <th className="sortable" onClick={() => setSortBy(sortBy === "name_asc" ? "name_desc" : "name_asc")}>
                    Name {sortBy.startsWith("name") ? (sortBy.endsWith("asc") ? "▲" : "▼") : ""}
                  </th>
                  <th>Category</th>
                  <th className="sortable" onClick={() => setSortBy(sortBy === "price_asc" ? "price_desc" : "price_asc")}>
                    Price {sortBy.startsWith("price") ? (sortBy.endsWith("asc") ? "▲" : "▼") : ""}
                  </th>
                  <th className="sortable" onClick={() => setSortBy(sortBy === "stock_asc" ? "stock_desc" : "stock_asc")}>
                    Stock {sortBy.startsWith("stock") ? (sortBy.endsWith("asc") ? "▲" : "▼") : ""}
                  </th>
                  <th>Status</th>
                  <th>Quick Adjust</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", padding: "28px", color: "#64748b" }}>
                      No matching products found. Try clearing your search filter.
                    </td>
                  </tr>
                ) : (
                  products.map((p, idx) => {
                    const isOut = p.quantity === 0;
                    const isLow = !isOut && p.quantity <= (p.reorder_level || p.minStock || 5);
                    const rowClass = isOut ? "out-stock-row" : (isLow ? "low-stock-row" : "");
                    const badgeClass = isOut ? "badge-out-stock" : (isLow ? "badge-low-stock" : "badge-in-stock");
                    const badgeText = isOut ? "Out of Stock" : (isLow ? "Low Stock" : "In Stock");

                    return (
                      <tr key={p._id} className={rowClass}>
                        <td>{(page - 1) * 10 + idx + 1}</td>
                        <td><span className="sku-code">{p.sku}</span></td>
                        <td>
                          <b>{p.name}</b>
                          {isLow && <span style={{ marginLeft: "6px", fontSize: "11px", color: "#d97706" }}>⚠️ Reorder</span>}
                        </td>
                        <td><span className="category-tag">{p.category}</span></td>
                        <td><b>{formatINR(p.price)}</b></td>
                        <td>
                          <span style={{ fontSize: "14px", fontWeight: "700" }}>{p.quantity}</span>
                          <span style={{ fontSize: "11px", color: "#94a3b8", marginLeft: "4px" }}>/ min {p.reorder_level || p.minStock || 5}</span>
                        </td>
                        <td><span className={`badge ${badgeClass}`}>{badgeText}</span></td>
                        <td>
                          {/* Quick Buttons: +1 = returned, -1 = sold */}
                          <button
                            className="btn btn-sm btn-outline"
                            title="Quick Return (+1)"
                            onClick={() => handleQuickAdjust(p, 1, "returned")}
                          >
                            +1
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            style={{ margin: "0 4px" }}
                            title={isOut ? "Cannot deduct from 0 stock" : "Quick Sale (-1)"}
                            disabled={isOut}
                            onClick={() => handleQuickAdjust(p, -1, "sold")}
                          >
                            -1
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => setAdjustModal({ open: true, product: p, change: 1, reason: "sold", note: "" })}
                          >
                            Adjust…
                          </button>
                          {user.role !== "staff" && (
                            <button
                              className="btn btn-sm btn-success"
                              style={{ marginLeft: "4px" }}
                              onClick={() => setRestockModal({ open: true, product: p, quantity: 10, supplier_id: "" })}
                            >
                              Restock
                            </button>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => openHistoryDrawer(p)}
                            title="View audit trail"
                          >
                            History
                          </button>
                          {user.role === "admin" && (
                            <>
                              <button
                                className="btn btn-sm btn-primary"
                                style={{ marginLeft: "4px" }}
                                onClick={() => setProductModal({
                                  open: true,
                                  editId: p._id,
                                  form: {
                                    name: p.name,
                                    sku: p.sku,
                                    category: p.category,
                                    price: p.price,
                                    quantity: p.quantity,
                                    reorder_level: p.reorder_level || p.minStock || 5
                                  }
                                })}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                style={{ marginLeft: "4px" }}
                                onClick={() => setDeleteModal({ open: true, product: p })}
                              >
                                Del
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="pagination-bar">
            <span>Showing page {page} of {totalPages} ({totalProductsCount} total items)</span>
            <div className="pagination-controls">
              <button
                className="btn btn-sm btn-outline"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                &larr; Previous
              </button>
              <span style={{ margin: "0 6px" }}>Page {page} / {totalPages}</span>
              <button
                className="btn btn-sm btn-outline"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ================= TAB 2: ANALYTICS & REPORTS ================= */}
      {activeTab === "analytics" && (
        <div>
          {/* Charts Row */}
          <div className="charts-grid">
            <div className="chart-card">
              <h3>Doughnut: Valuation by Category</h3>
              <canvas ref={chartValRef} height="220"></canvas>
            </div>
            <div className="chart-card">
              <h3>Bar: Stock Units by Category</h3>
              <canvas ref={chartUnitsRef} height="220"></canvas>
            </div>
          </div>

          <div className="chart-card" style={{ marginBottom: "18px" }}>
            <h3>
              <span>Line: Stock In (+) vs Stock Out (-) Trend</span>
              <div>
                <button
                  className={`btn btn-sm ${timelineDays === 7 ? "btn-primary" : "btn-outline"}`}
                  onClick={() => setTimelineDays(7)}
                >
                  7 Days
                </button>
                <button
                  className={`btn btn-sm ${timelineDays === 30 ? "btn-primary" : "btn-outline"}`}
                  style={{ marginLeft: "6px" }}
                  onClick={() => setTimelineDays(30)}
                >
                  30 Days
                </button>
              </div>
            </h3>
            <canvas ref={chartTimelineRef} height="120"></canvas>
          </div>

          {/* Two-Column Analytics Layout: Reorder Suggestions & Recent Activity */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "16px" }}>
            {/* Reorder Suggestions */}
            <div className="card">
              <h2>
                <span>⚠️ Reorder Suggestions</span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Formula: 2×Reorder - Stock</span>
              </h2>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Stock</th>
                      <th>Alert</th>
                      <th>Suggest Qty</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.filter(p => p.quantity <= (p.reorder_level || 5)).slice(0, 6).map(p => {
                      const suggest = Math.max(10, 2 * (p.reorder_level || 5) - p.quantity);
                      return (
                        <tr key={p._id}>
                          <td><b>{p.name}</b></td>
                          <td style={{ color: p.quantity === 0 ? "#dc2626" : "#d97706", fontWeight: "700" }}>{p.quantity}</td>
                          <td>{p.reorder_level || 5}</td>
                          <td><span className="badge badge-low-stock">+{suggest} units</span></td>
                          <td>
                            {user.role !== "staff" && (
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => {
                                  setActiveTab("orders");
                                  setPoModal({ open: true, product_id: p._id, supplier_id: suppliers[0]?._id || "", quantity: suggest });
                                }}
                              >
                                Create PO
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Activity Log */}
            <div className="card">
              <h2>Recent Audit Trail (Last 15 Movements)</h2>
              <div className="activity-list">
                {recentMovements.length === 0 ? (
                  <p style={{ color: "#64748b" }}>No movements recorded yet.</p>
                ) : (
                  recentMovements.map(m => (
                    <div key={m._id} className="activity-item">
                      <div>
                        <span className="user">{m.user_id?.fullName || m.user_id?.username || "System"}</span>{" "}
                        <span>{m.product_id?.name || "Product"}</span>{" "}
                        <span style={{ color: "#64748b" }}>({m.reason})</span>
                        {m.note && <div style={{ fontSize: "11px", color: "#94a3b8" }}>&ldquo;{m.note}&rdquo;</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span className={`change-pill ${m.change > 0 ? "change-plus" : "change-minus"}`}>
                          {m.change > 0 ? "+" + m.change : m.change}
                        </span>
                        <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: PURCHASE ORDERS ================= */}
      {activeTab === "orders" && (
        <section className="card">
          <h2>
            <span>Purchase Orders Tracker</span>
            {user.role !== "staff" && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setPoModal({ open: true, product_id: products[0]?._id || "", supplier_id: suppliers[0]?._id || "", quantity: 20 })}
              >
                + New Purchase Order
              </button>
            )}
          </h2>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>PO #</th>
                  <th>Product</th>
                  <th>Supplier</th>
                  <th>Quantity</th>
                  <th>Created By</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                      No purchase orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map((po, idx) => {
                    const isPending = po.status === "pending";
                    return (
                      <tr key={po._id}>
                        <td><b>PO-{(idx + 101)}</b></td>
                        <td><b>{po.product_id?.name || "Product"}</b> ({po.product_id?.sku})</td>
                        <td>{po.supplier_id?.name || "Supplier"}</td>
                        <td><b>{po.quantity} units</b></td>
                        <td>{po.created_by?.fullName || po.created_by?.username}</td>
                        <td>
                          <span className={`badge ${po.status === "received" ? "badge-in-stock" : (po.status === "pending" ? "badge-low-stock" : "badge-out-stock")}`}>
                            {po.status.toUpperCase()}
                          </span>
                        </td>
                        <td>{new Date(po.created_at).toLocaleDateString()}</td>
                        <td>
                          {isPending && user.role !== "staff" && (
                            <button className="btn btn-sm btn-success" onClick={() => handleReceivePO(po)}>
                              ✓ Mark Received
                            </button>
                          )}
                          {po.status === "received" && (
                            <span style={{ fontSize: "11px", color: "#166534" }}>Stock Added</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ================= TAB 4: SUPPLIERS ================= */}
      {activeTab === "suppliers" && (
        <section className="card">
          <h2>
            <span>Suppliers Directory</span>
            {user.role !== "staff" && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setSupplierModal({ open: true, editId: null, name: "", contact_person: "", phone: "", email: "" })}
              >
                + Add Supplier
              </button>
            )}
          </h2>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Contact Person</th>
                  <th>Phone Number</th>
                  <th>Email</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s._id}>
                    <td><b>{s.name}</b></td>
                    <td>{s.contact_person || "—"}</td>
                    <td>{s.phone || "—"}</td>
                    <td>{s.email || "—"}</td>
                    <td>
                      {user.role !== "staff" ? (
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => setSupplierModal({
                            open: true,
                            editId: s._id,
                            name: s.name,
                            contact_person: s.contact_person,
                            phone: s.phone,
                            email: s.email
                          })}
                        >
                          Edit
                        </button>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#64748b" }}>View Only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ================= TAB 5: USER MANAGEMENT (ADMIN ONLY) ================= */}
      {activeTab === "users" && user.role === "admin" && (
        <section className="card">
          <h2>
            <span>User Accounts & RBAC</span>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setUserModal({ open: true, username: "", password: "", role: "staff", fullName: "" })}
            >
              + Create User
            </button>
          </h2>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Assigned Role</th>
                  <th>Account Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map(u => (
                  <tr key={u._id}>
                    <td><b>{u.username}</b></td>
                    <td>{u.fullName || "—"}</td>
                    <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                    <td>
                      <span className={`badge ${u.active ? "badge-in-stock" : "badge-out-stock"}`}>
                        {u.active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => setResetPwdModal({ open: true, user: u, newPassword: "" })}
                      >
                        Reset Password
                      </button>
                      {u._id !== user.id && (
                        <button
                          className={`btn btn-sm ${u.active ? "btn-danger" : "btn-success"}`}
                          style={{ marginLeft: "6px" }}
                          onClick={async () => {
                            try {
                              const res = await apiRequest(`/api/users/${u._id}`, "PUT", { active: !u.active });
                              setUsersList(prev => prev.map(usr => usr._id === u._id ? res.user : usr));
                              showToast(`User ${u.username} ${u.active ? "deactivated" : "activated"}`, "info");
                            } catch (err) {
                              showToast(err.message, "error");
                            }
                          }}
                        >
                          {u.active ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ================= ALL MODALS & DRAWERS ================= */}

      {/* 1. Add / Edit Product Modal */}
      {productModal.open && (
        <div className="modal-overlay" onClick={() => setProductModal({ open: false, editId: null, form: emptyProductForm })}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>{productModal.editId ? "Edit Product" : "Add New Product"}</h3>
            <p>Fill out the details below. All fields with validation.</p>
            <form onSubmit={handleProductSave}>
              <div className="form-group" style={{ marginBottom: "10px" }}>
                <label>Product Name</label>
                <input
                  type="text"
                  required
                  value={productModal.form.name}
                  onChange={e => setProductModal({ ...productModal, form: { ...productModal.form, name: e.target.value } })}
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Unique SKU</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ELE-099"
                    value={productModal.form.sku}
                    onChange={e => setProductModal({ ...productModal, form: { ...productModal.form, sku: e.target.value.toUpperCase() } })}
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={productModal.form.category}
                    onChange={e => setProductModal({ ...productModal, form: { ...productModal.form, category: e.target.value } })}
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Stationery">Stationery</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Cleaning Supplies">Cleaning Supplies</option>
                    <option value="Office Pantry">Office Pantry</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Price (₹)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={productModal.form.price}
                    onChange={e => setProductModal({ ...productModal, form: { ...productModal.form, price: e.target.value } })}
                  />
                </div>
                <div className="form-group">
                  <label>Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={productModal.form.quantity}
                    onChange={e => setProductModal({ ...productModal, form: { ...productModal.form, quantity: e.target.value } })}
                  />
                </div>
                <div className="form-group">
                  <label>Reorder Alert Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={productModal.form.reorder_level}
                    onChange={e => setProductModal({ ...productModal, form: { ...productModal.form, reorder_level: e.target.value } })}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setProductModal({ open: false, editId: null, form: emptyProductForm })}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {productModal.editId ? "Update Product" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Custom Stock Adjust Modal */}
      {adjustModal.open && (
        <div className="modal-overlay" onClick={() => setAdjustModal({ open: false, product: null, change: 1, reason: "sold", note: "" })}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Adjust Stock: {adjustModal.product?.name}</h3>
            <p>Current Quantity: <b>{adjustModal.product?.quantity}</b> units (SKU: {adjustModal.product?.sku})</p>
            <form onSubmit={handleCustomAdjust}>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label>Change (+ for Restock/Return, - for Sold/Damaged)</label>
                <input
                  type="number"
                  required
                  placeholder="+5 or -3"
                  value={adjustModal.change}
                  onChange={e => setAdjustModal({ ...adjustModal, change: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label>Reason for Movement</label>
                <select
                  value={adjustModal.reason}
                  onChange={e => setAdjustModal({ ...adjustModal, reason: e.target.value })}
                >
                  <option value="sold">sold (Customer Sale)</option>
                  <option value="returned">returned (Customer Return)</option>
                  <option value="restock">restock (Inventory Delivery)</option>
                  <option value="damaged">damaged (Damaged / Written-off)</option>
                  <option value="correction">correction (Cycle Count Audit)</option>
                  <option value="purchase_order">purchase_order (PO Intake)</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Audit Note / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Invoice #203, Broken box"
                  value={adjustModal.note}
                  onChange={e => setAdjustModal({ ...adjustModal, note: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAdjustModal({ open: false, product: null, change: 1, reason: "sold", note: "" })}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Confirm Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Restock Modal with Presets & Supplier */}
      {restockModal.open && (
        <div className="modal-overlay" onClick={() => setRestockModal({ open: false, product: null, quantity: 10, supplier_id: "" })}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Restock Delivery: {restockModal.product?.name}</h3>
            <p>Current Stock: <b>{restockModal.product?.quantity}</b> units</p>
            <form onSubmit={handleRestockSubmit}>
              <label>Quick Preset Batches</label>
              <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}>
                {[5, 10, 25, 50, 100].map(qty => (
                  <button
                    key={qty}
                    type="button"
                    className={`btn btn-sm ${restockModal.quantity === qty ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setRestockModal({ ...restockModal, quantity: qty })}
                  >
                    +{qty}
                  </button>
                ))}
              </div>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label>Units to Add</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockModal.quantity}
                  onChange={e => setRestockModal({ ...restockModal, quantity: Number(e.target.value) })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Supplier (Optional)</label>
                <select
                  value={restockModal.supplier_id}
                  onChange={e => setRestockModal({ ...restockModal, supplier_id: e.target.value })}
                >
                  <option value="">Direct / Walk-in Restock</option>
                  {suppliers.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRestockModal({ open: false, product: null, quantity: 10, supplier_id: "" })}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">Add +{restockModal.quantity} Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="modal-overlay" onClick={() => setDeleteModal({ open: false, product: null })}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Confirm Product Deletion</h3>
            <p>Are you sure you want to permanently delete <b>{deleteModal.product?.name}</b> (SKU: {deleteModal.product?.sku})? This action cannot be undone.</p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setDeleteModal({ open: false, product: null })}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>
                Yes, Delete Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Product History Side Drawer */}
      {historyDrawer.open && (
        <div className="drawer-overlay" onClick={() => setHistoryDrawer({ open: false, product: null, movements: [] })}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3 style={{ fontSize: "17px", color: "#0f172a", marginBottom: "4px" }}>{historyDrawer.product?.name}</h3>
                <span className="sku-code">{historyDrawer.product?.sku}</span> &bull; <span className="category-tag">{historyDrawer.product?.category}</span>
              </div>
              <button className="btn btn-sm btn-outline" onClick={() => setHistoryDrawer({ open: false, product: null, movements: [] })}>
                ✕ Close
              </button>
            </div>

            <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "6px", marginBottom: "16px", fontSize: "13px" }}>
              <div>Current In-Stock: <b>{historyDrawer.product?.quantity} units</b></div>
              <div>Price: <b>{formatINR(historyDrawer.product?.price)}</b></div>
              <div>Reorder Alert Level: <b>{historyDrawer.product?.reorder_level || 5} units</b></div>
            </div>

            <h4 style={{ fontSize: "14px", marginBottom: "10px", color: "#334155" }}>Movement Audit Trail</h4>
            <div className="table-responsive" style={{ flex: 1, overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>User</th>
                    <th>Change</th>
                    <th>Reason</th>
                    <th>Stock After</th>
                  </tr>
                </thead>
                <tbody>
                  {historyDrawer.movements.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: "center", color: "#64748b" }}>No movements logged.</td></tr>
                  ) : (
                    historyDrawer.movements.map(m => (
                      <tr key={m._id}>
                        <td style={{ fontSize: "11px" }}>{new Date(m.created_at).toLocaleDateString()}</td>
                        <td>{m.user_id?.fullName || m.user_id?.username || "System"}</td>
                        <td>
                          <span className={`change-pill ${m.change > 0 ? "change-plus" : "change-minus"}`}>
                            {m.change > 0 ? "+" + m.change : m.change}
                          </span>
                        </td>
                        <td>{m.reason}</td>
                        <td><b>{m.stock_after}</b></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. Purchase Order Modal */}
      {poModal.open && (
        <div className="modal-overlay" onClick={() => setPoModal({ open: false, product_id: "", supplier_id: "", quantity: 10 })}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Create Purchase Order</h3>
            <p>Generate a purchase order to replenish inventory.</p>
            <form onSubmit={handleCreatePO}>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label>Product to Order</label>
                <select
                  required
                  value={poModal.product_id}
                  onChange={e => setPoModal({ ...poModal, product_id: e.target.value })}
                >
                  <option value="">Select a product</option>
                  {products.map(p => (
                    <option key={p._id} value={p._id}>{p.name} ({p.sku}) - Qty: {p.quantity}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label>Supplier</label>
                <select
                  required
                  value={poModal.supplier_id}
                  onChange={e => setPoModal({ ...poModal, supplier_id: e.target.value })}
                >
                  <option value="">Select a supplier</option>
                  {suppliers.map(s => (
                    <option key={s._id} value={s._id}>{s.name} ({s.contact_person})</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Order Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={poModal.quantity}
                  onChange={e => setPoModal({ ...poModal, quantity: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPoModal({ open: false, product_id: "", supplier_id: "", quantity: 10 })}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Issue Purchase Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Supplier Modal */}
      {supplierModal.open && (
        <div className="modal-overlay" onClick={() => setSupplierModal({ open: false, editId: null, name: "", contact_person: "", phone: "", email: "" })}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>{supplierModal.editId ? "Edit Supplier" : "Add New Supplier"}</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (supplierModal.editId) {
                  const res = await apiRequest(`/api/suppliers/${supplierModal.editId}`, "PUT", supplierModal);
                  setSuppliers(prev => prev.map(s => s._id === supplierModal.editId ? res.supplier : s));
                  showToast("Supplier updated", "success");
                } else {
                  const res = await apiRequest("/api/suppliers", "POST", supplierModal);
                  setSuppliers(prev => [...prev, res.supplier]);
                  showToast("Supplier created", "success");
                }
                setSupplierModal({ open: false, editId: null, name: "", contact_person: "", phone: "", email: "" });
              } catch (err) {
                showToast(err.message, "error");
              }
            }}>
              <div className="form-group" style={{ marginBottom: "10px" }}>
                <label>Company / Supplier Name</label>
                <input
                  type="text"
                  required
                  value={supplierModal.name}
                  onChange={e => setSupplierModal({ ...supplierModal, name: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "10px" }}>
                <label>Contact Person</label>
                <input
                  type="text"
                  value={supplierModal.contact_person}
                  onChange={e => setSupplierModal({ ...supplierModal, contact_person: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "10px" }}>
                <label>Phone Number</label>
                <input
                  type="text"
                  value={supplierModal.phone}
                  onChange={e => setSupplierModal({ ...supplierModal, phone: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Email Address</label>
                <input
                  type="email"
                  value={supplierModal.email}
                  onChange={e => setSupplierModal({ ...supplierModal, email: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSupplierModal({ open: false, editId: null, name: "", contact_person: "", phone: "", email: "" })}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. User Create Modal */}
      {userModal.open && (
        <div className="modal-overlay" onClick={() => setUserModal({ open: false, username: "", password: "", role: "staff", fullName: "" })}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Add New System User</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await apiRequest("/api/users", "POST", userModal);
                setUsersList(prev => [res.user, ...prev]);
                showToast("User account created", "success");
                setUserModal({ open: false, username: "", password: "", role: "staff", fullName: "" });
              } catch (err) {
                showToast(err.message, "error");
              }
            }}>
              <div className="form-group" style={{ marginBottom: "10px" }}>
                <label>Username</label>
                <input
                  type="text"
                  required
                  value={userModal.username}
                  onChange={e => setUserModal({ ...userModal, username: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "10px" }}>
                <label>Full Name</label>
                <input
                  type="text"
                  value={userModal.fullName}
                  onChange={e => setUserModal({ ...userModal, fullName: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "10px" }}>
                <label>Password (Min 6 chars)</label>
                <input
                  type="password"
                  required
                  value={userModal.password}
                  onChange={e => setUserModal({ ...userModal, password: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Role</label>
                <select
                  value={userModal.role}
                  onChange={e => setUserModal({ ...userModal, role: e.target.value })}
                >
                  <option value="staff">Staff (Stock Adjust & View)</option>
                  <option value="manager">Manager (Restock, Suppliers, POs)</option>
                  <option value="admin">Admin (Full Control, Products, Users)</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setUserModal({ open: false, username: "", password: "", role: "staff", fullName: "" })}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Reset Password Modal */}
      {resetPwdModal.open && (
        <div className="modal-overlay" onClick={() => setResetPwdModal({ open: false, user: null, newPassword: "" })}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Reset Password for {resetPwdModal.user?.username}</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await apiRequest(`/api/users/${resetPwdModal.user._id}/reset-password`, "POST", {
                  newPassword: resetPwdModal.newPassword
                });
                showToast(res.message, "success");
                setResetPwdModal({ open: false, user: null, newPassword: "" });
              } catch (err) {
                showToast(err.message, "error");
              }
            }}>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>New Password (Min 6 characters)</label>
                <input
                  type="password"
                  required
                  value={resetPwdModal.newPassword}
                  onChange={e => setResetPwdModal({ ...resetPwdModal, newPassword: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setResetPwdModal({ open: false, user: null, newPassword: "" })}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Save New Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. CSV Import Preview Modal */}
      {csvImportModal.open && (
        <div className="modal-overlay" onClick={() => setCsvImportModal({ open: false, preview: [], rawText: "", error: "" })}>
          <div className="modal-box" style={{ maxWidth: "680px" }} onClick={e => e.stopPropagation()}>
            <h3>Preview CSV Import ({csvImportModal.preview.length} Rows)</h3>
            <p>Review the parsed rows and validation status before importing.</p>
            <div className="table-responsive" style={{ maxHeight: "280px", overflowY: "auto", marginBottom: "16px" }}>
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {csvImportModal.preview.map((r, i) => (
                    <tr key={i} style={{ background: r.error ? "#fef2f2" : "#fff" }}>
                      <td><span className="sku-code">{r.sku}</span></td>
                      <td>{r.name}</td>
                      <td>{r.category}</td>
                      <td>₹{r.price}</td>
                      <td>{r.quantity}</td>
                      <td>
                        {r.error ? (
                          <span style={{ color: "#dc2626", fontWeight: "600", fontSize: "11px" }}>❌ {r.error}</span>
                        ) : (
                          <span style={{ color: "#16a34a", fontWeight: "600", fontSize: "11px" }}>✓ Valid</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setCsvImportModal({ open: false, preview: [], rawText: "", error: "" })}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitCSVImport}>
                Import {csvImportModal.preview.filter(r => !r.error).length} Valid Products
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
