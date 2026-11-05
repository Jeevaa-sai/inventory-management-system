// =====================================================
// Inventory Management System - Frontend (HTML/CSS/JS)
// =====================================================

// ---------- Global State ----------
let currentUser = null;
let csrfToken = "";
let activeTab = "inventory";

let products = [];
let suppliers = [];
let purchaseOrders = [];
let usersList = [];

let page = 1;
let totalPages = 1;
let search = "";
let categoryFilter = "ALL";
let statusFilter = "ALL";
let sortBy = "name_asc";
let timelineDays = 30;

let selectedProduct = null;   // product used by adjust / restock / delete modals
let editProductId = null;     // null = add mode, otherwise edit mode
let editSupplierId = null;
let resetPwdUser = null;
let charts = {};              // Chart.js instances

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);

const inrFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
});
function formatINR(val) {
    return inrFormatter.format(Number(val) || 0);
}

// Prevents HTML injection when inserting text into innerHTML
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function reorderLevel(p) {
    return p.reorder_level || p.minStock || 5;
}

function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    $("toastContainer").appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function openModal(id) { $(id).classList.remove("hidden"); }
function closeModal(id) { $(id).classList.add("hidden"); }

// Fetch wrapper: sends JSON and CSRF token, throws on error
async function apiRequest(url, method = "GET", body = null) {
    const headers = { "Content-Type": "application/json" };
    if (csrfToken && method !== "GET") headers["x-csrf-token"] = csrfToken;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Request failed with status ${res.status}`);
    return data;
}

// ---------- Authentication ----------
async function checkSession() {
    try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
            const data = await res.json();
            if (data.user) {
                setLoggedIn(data.user, data.csrfToken);
                return;
            }
        }
    } catch {
        // not logged in
    }
    showLogin();
}

function showLogin() {
    $("loginView").classList.remove("hidden");
    $("appView").classList.add("hidden");
}

function setLoggedIn(user, token) {
    currentUser = user;
    csrfToken = token;

    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");

    $("userName").textContent = user.fullName || user.username;
    $("userRole").textContent = user.role;
    $("userRole").className = `role-badge role-${user.role}`;

    // Show / hide buttons depending on role
    document.querySelectorAll(".admin-only").forEach(el =>
        el.classList.toggle("hidden", user.role !== "admin"));
    document.querySelectorAll(".no-staff").forEach(el =>
        el.classList.toggle("hidden", user.role === "staff"));

    switchTab("inventory");
    loadProducts();
    loadStats();
    loadSuppliers();
    loadPurchaseOrders();
}

$("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("loginError").classList.add("hidden");
    try {
        const data = await apiRequest("/api/auth/login", "POST", {
            username: $("loginUsername").value,
            password: $("loginPassword").value
        });
        setLoggedIn(data.user, data.csrfToken);
        showToast(`Welcome back, ${data.user.fullName || data.user.username}!`, "success");
    } catch (err) {
        $("loginError").textContent = err.message;
        $("loginError").classList.remove("hidden");
    }
});

$("logoutBtn").addEventListener("click", async () => {
    try { await apiRequest("/api/auth/logout", "POST"); } catch { /* ignore */ }
    currentUser = null;
    csrfToken = "";
    showLogin();
    showToast("Logged out successfully", "info");
});

// ---------- Tabs ----------
function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll(".tab-btn").forEach(btn =>
        btn.classList.toggle("active", btn.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach(panel =>
        panel.classList.toggle("hidden", panel.id !== `tab-${tab}`));
    $("statsSection").classList.toggle("hidden", !(tab === "inventory" || tab === "analytics"));

    if (tab === "orders") loadPurchaseOrders();
    if (tab === "users" && currentUser.role === "admin") loadUsers();
    if (tab === "analytics") {
        loadAnalytics();
        loadRecentMovements();
        renderReorderSuggestions();
    }
}

document.querySelectorAll(".tab-btn").forEach(btn =>
    btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

// ---------- KPI Cards ----------
async function loadStats() {
    try {
        const data = await apiRequest("/api/stats");
        if (!data.cards) return;
        $("statTotalProducts").textContent = data.cards.totalProducts;
        $("statTotalQuantity").textContent = data.cards.totalQuantity;
        $("statLowStock").textContent = data.cards.lowStockCount;
        $("statTotalValue").textContent = formatINR(data.cards.totalValue);
    } catch {
        // ignore
    }
}

function applyFilters(status, resetCategory) {
    statusFilter = status;
    $("statusFilter").value = status;
    if (resetCategory) {
        categoryFilter = "ALL";
        $("categoryFilter").value = "ALL";
    }
    page = 1;
    switchTab("inventory");
    loadProducts();
}

$("cardTotal").addEventListener("click", () => applyFilters("ALL", true));
$("cardInStock").addEventListener("click", () => applyFilters("in_stock", false));
$("cardLowStock").addEventListener("click", () => applyFilters("low_stock", false));
$("cardValue").addEventListener("click", () => switchTab("analytics"));

// ---------- Products ----------
async function loadProducts() {
    try {
        const query = new URLSearchParams({
            page, limit: 10, search,
            category: categoryFilter,
            status: statusFilter,
            sort: sortBy
        });
        const data = await apiRequest(`/api/products?${query}`);
        products = data.products || [];
        totalPages = data.totalPages || 1;
        renderProducts(data.total || 0);
    } catch (err) {
        showToast(err.message, "error");
    }
}

function renderProducts(totalCount) {
    const tbody = $("productTableBody");
    const role = currentUser.role;

    if (products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-row">No matching products found. Try clearing your search filter.</td></tr>`;
    } else {
        tbody.innerHTML = products.map((p, idx) => {
            const minLevel = reorderLevel(p);
            const isOut = p.quantity === 0;
            const isLow = !isOut && p.quantity <= minLevel;
            const rowClass = isOut ? "out-stock-row" : (isLow ? "low-stock-row" : "");
            const badgeClass = isOut ? "badge-out-stock" : (isLow ? "badge-low-stock" : "badge-in-stock");
            const badgeText = isOut ? "Out of Stock" : (isLow ? "Low Stock" : "In Stock");

            return `
            <tr class="${rowClass}">
                <td>${(page - 1) * 10 + idx + 1}</td>
                <td><span class="sku-code">${escapeHtml(p.sku)}</span></td>
                <td>
                    <b>${escapeHtml(p.name)}</b>
                    ${isLow ? `<span style="margin-left:6px;font-size:11px;color:#d97706;">⚠️ Reorder</span>` : ""}
                </td>
                <td><span class="category-tag">${escapeHtml(p.category)}</span></td>
                <td><b>${formatINR(p.price)}</b></td>
                <td>
                    <span style="font-size:14px;font-weight:700;">${p.quantity}</span>
                    <span style="font-size:11px;color:#94a3b8;margin-left:4px;">/ min ${minLevel}</span>
                </td>
                <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline" data-action="plus" data-id="${p._id}" title="Quick Return (+1)">+1</button>
                    <button class="btn btn-sm btn-outline" style="margin:0 4px;" data-action="minus" data-id="${p._id}" ${isOut ? "disabled" : ""} title="Quick Sale (-1)">-1</button>
                    <button class="btn btn-sm btn-outline" data-action="adjust" data-id="${p._id}">Adjust…</button>
                    ${role !== "staff" ? `<button class="btn btn-sm btn-success" style="margin-left:4px;" data-action="restock" data-id="${p._id}">Restock</button>` : ""}
                </td>
                <td>
                    <button class="btn btn-sm btn-outline" data-action="history" data-id="${p._id}">History</button>
                    ${role === "admin" ? `
                        <button class="btn btn-sm btn-primary" style="margin-left:4px;" data-action="edit" data-id="${p._id}">Edit</button>
                        <button class="btn btn-sm btn-danger" style="margin-left:4px;" data-action="delete" data-id="${p._id}">Del</button>
                    ` : ""}
                </td>
            </tr>`;
        }).join("");
    }

    $("pageInfo").textContent = `Showing page ${page} of ${totalPages} (${totalCount} total items)`;
    $("pageLabel").textContent = `Page ${page} / ${totalPages}`;
    $("prevPageBtn").disabled = page <= 1;
    $("nextPageBtn").disabled = page >= totalPages;

    // Sort arrows in table headers
    document.querySelectorAll("th.sortable").forEach(th => {
        const key = th.dataset.sort;
        th.querySelector("span").textContent =
            sortBy.startsWith(key) ? (sortBy.endsWith("asc") ? "▲" : "▼") : "";
    });
}

// One click handler for every button inside the product table (event delegation)
$("productTableBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const product = products.find(p => p._id === btn.dataset.id);
    if (!product) return;

    switch (btn.dataset.action) {
        case "plus": quickAdjust(product, 1, "returned"); break;
        case "minus": quickAdjust(product, -1, "sold"); break;
        case "adjust": openAdjustModal(product); break;
        case "restock": openRestockModal(product); break;
        case "history": openHistoryDrawer(product); break;
        case "edit": openProductModal(product); break;
        case "delete": openDeleteModal(product); break;
    }
});

// Filters, search, sort, pagination
let searchTimer = null;
$("searchInput").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {   // debounce: wait until user stops typing
        search = e.target.value;
        page = 1;
        loadProducts();
    }, 300);
});
$("categoryFilter").addEventListener("change", (e) => { categoryFilter = e.target.value; page = 1; loadProducts(); });
$("statusFilter").addEventListener("change", (e) => { statusFilter = e.target.value; page = 1; loadProducts(); });
$("sortSelect").addEventListener("change", (e) => { sortBy = e.target.value; loadProducts(); });

document.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
        const key = th.dataset.sort;
        sortBy = sortBy === `${key}_asc` ? `${key}_desc` : `${key}_asc`;
        $("sortSelect").value = sortBy;
        loadProducts();
    });
});

$("prevPageBtn").addEventListener("click", () => { if (page > 1) { page--; loadProducts(); } });
$("nextPageBtn").addEventListener("click", () => { if (page < totalPages) { page++; loadProducts(); } });

// ---------- Stock Adjustments ----------
async function adjustStock(product, change, reason, note) {
    const data = await apiRequest(`/api/products/${product._id}/adjust`, "POST", { change, reason, note });
    loadProducts();
    loadStats();
    return data;
}

async function quickAdjust(product, change, reason) {
    try {
        await adjustStock(product, change, reason, `Quick ${reason}`);
        showToast(`${product.name}: ${change > 0 ? "+" + change : change} units (${reason})`, "success");
    } catch (err) {
        showToast(err.message, "error");
    }
}

function openAdjustModal(product) {
    selectedProduct = product;
    $("adjustTitle").textContent = `Adjust Stock: ${product.name}`;
    $("adjustInfo").innerHTML = `Current Quantity: <b>${product.quantity}</b> units (SKU: ${escapeHtml(product.sku)})`;
    $("adjustChange").value = 1;
    $("adjustReason").value = "sold";
    $("adjustNote").value = "";
    openModal("adjustModal");
}

$("adjustForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const change = Number($("adjustChange").value);
    try {
        await adjustStock(selectedProduct, change, $("adjustReason").value, $("adjustNote").value);
        showToast(`Stock updated: ${change > 0 ? "+" + change : change} units`, "success");
        closeModal("adjustModal");
    } catch (err) {
        showToast(err.message, "error");
    }
});

// ---------- Restock ----------
function setRestockQty(qty) {
    $("restockQty").value = qty;
    $("restockSubmitBtn").textContent = `Add +${qty} Stock`;
    document.querySelectorAll("#restockPresets button").forEach(b => {
        b.className = `btn btn-sm ${Number(b.dataset.qty) === Number(qty) ? "btn-primary" : "btn-outline"}`;
    });
}

function openRestockModal(product) {
    selectedProduct = product;
    $("restockTitle").textContent = `Restock Delivery: ${product.name}`;
    $("restockInfo").innerHTML = `Current Stock: <b>${product.quantity}</b> units`;
    $("restockSupplier").innerHTML = `<option value="">Direct / Walk-in Restock</option>` +
        suppliers.map(s => `<option value="${s._id}">${escapeHtml(s.name)}</option>`).join("");
    setRestockQty(10);
    openModal("restockModal");
}

$("restockPresets").addEventListener("click", (e) => {
    if (e.target.dataset.qty) setRestockQty(e.target.dataset.qty);
});
$("restockQty").addEventListener("input", (e) => setRestockQty(e.target.value));

$("restockForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const qty = Number($("restockQty").value);
    const supplier = suppliers.find(s => s._id === $("restockSupplier").value);
    const note = supplier ? `Restocked from ${supplier.name}` : "Direct restock";
    try {
        await adjustStock(selectedProduct, qty, "restock", note);
        showToast(`Restocked +${qty} units for ${selectedProduct.name}`, "success");
        closeModal("restockModal");
    } catch (err) {
        showToast(err.message, "error");
    }
});

// ---------- Add / Edit / Delete Product ----------
function openProductModal(product = null) {
    editProductId = product ? product._id : null;
    $("productModalTitle").textContent = product ? "Edit Product" : "Add New Product";
    $("productSubmitBtn").textContent = product ? "Update Product" : "Save Product";
    $("pName").value = product ? product.name : "";
    $("pSku").value = product ? product.sku : "";
    $("pCategory").value = product ? product.category : "Electronics";
    $("pPrice").value = product ? product.price : "";
    $("pQuantity").value = product ? product.quantity : "";
    $("pReorder").value = product ? reorderLevel(product) : 5;
    openModal("productModal");
}

$("addProductBtn").addEventListener("click", () => openProductModal());
$("pSku").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase(); });

$("productForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = {
        name: $("pName").value,
        sku: $("pSku").value,
        category: $("pCategory").value,
        price: $("pPrice").value,
        quantity: $("pQuantity").value,
        reorder_level: $("pReorder").value
    };
    try {
        if (editProductId) {
            await apiRequest(`/api/products/${editProductId}`, "PUT", form);
            showToast("Product updated successfully", "success");
        } else {
            await apiRequest("/api/products", "POST", form);
            showToast("Product created successfully", "success");
        }
        closeModal("productModal");
        loadProducts();
        loadStats();
    } catch (err) {
        showToast(err.message, "error");
    }
});

function openDeleteModal(product) {
    selectedProduct = product;
    $("deleteInfo").innerHTML = `Are you sure you want to permanently delete <b>${escapeHtml(product.name)}</b> (SKU: ${escapeHtml(product.sku)})? This action cannot be undone.`;
    openModal("deleteModal");
}

$("confirmDeleteBtn").addEventListener("click", async () => {
    try {
        await apiRequest(`/api/products/${selectedProduct._id}`, "DELETE");
        showToast(`Deleted ${selectedProduct.name}`, "success");
        closeModal("deleteModal");
        loadProducts();
        loadStats();
    } catch (err) {
        showToast(err.message, "error");
    }
});

// ---------- Product History Drawer ----------
async function openHistoryDrawer(product) {
    try {
        const movements = await apiRequest(`/api/products/${product._id}/movements`);
        $("historyName").textContent = product.name;
        $("historySku").textContent = product.sku;
        $("historyCategory").textContent = product.category;
        $("historySummary").innerHTML = `
            <div>Current In-Stock: <b>${product.quantity} units</b></div>
            <div>Price: <b>${formatINR(product.price)}</b></div>
            <div>Reorder Alert Level: <b>${reorderLevel(product)} units</b></div>`;

        $("historyTableBody").innerHTML = movements.length === 0
            ? `<tr><td colspan="5" class="empty-row">No movements logged.</td></tr>`
            : movements.map(m => `
                <tr>
                    <td style="font-size:11px;">${new Date(m.created_at).toLocaleDateString()}</td>
                    <td>${escapeHtml(m.user_id?.fullName || m.user_id?.username || "System")}</td>
                    <td><span class="change-pill ${m.change > 0 ? "change-plus" : "change-minus"}">${m.change > 0 ? "+" + m.change : m.change}</span></td>
                    <td>${escapeHtml(m.reason)}</td>
                    <td><b>${m.stock_after}</b></td>
                </tr>`).join("");

        openModal("historyDrawer");
    } catch (err) {
        showToast(err.message, "error");
    }
}

// ---------- Dashboard & Charts ----------
async function loadAnalytics() {
    try {
        const data = await apiRequest(`/api/stats?days=${timelineDays}`);
        renderCharts(data);
    } catch (err) {
        showToast(err.message, "error");
    }
}

function renderCharts(data) {
    if (!window.Chart || !data.charts) return;

    // Destroy old charts before drawing new ones on the same canvas
    Object.values(charts).forEach(c => c.destroy());
    charts = {};

    const { categoryStats, timeline } = data.charts;

    charts.value = new Chart($("chartValue"), {
        type: "doughnut",
        data: {
            labels: categoryStats.map(c => c.category),
            datasets: [{
                data: categoryStats.map(c => c.value),
                backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#64748b"]
            }]
        },
        options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });

    charts.units = new Chart($("chartUnits"), {
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
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    charts.timeline = new Chart($("chartTimeline"), {
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

document.querySelectorAll(".days-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        timelineDays = Number(btn.dataset.days);
        document.querySelectorAll(".days-btn").forEach(b =>
            b.className = `btn btn-sm days-btn ${b === btn ? "btn-primary" : "btn-outline"}`);
        loadAnalytics();
    });
});

async function renderReorderSuggestions() {
    let allProducts = products;
    try {
        const data = await apiRequest("/api/products?all=true&sort=stock_asc");
        allProducts = data.products || products;
    } catch { /* fall back to current page */ }
    const lowItems = allProducts.filter(p => p.quantity <= reorderLevel(p)).slice(0, 6);
    $("reorderTableBody").innerHTML = lowItems.length === 0
        ? `<tr><td colspan="5" class="empty-row">No items need reordering.</td></tr>`
        : lowItems.map(p => {
            const suggest = Math.max(10, 2 * reorderLevel(p) - p.quantity);
            return `
            <tr>
                <td><b>${escapeHtml(p.name)}</b></td>
                <td style="color:${p.quantity === 0 ? "#dc2626" : "#d97706"};font-weight:700;">${p.quantity}</td>
                <td>${reorderLevel(p)}</td>
                <td><span class="badge badge-low-stock">+${suggest} units</span></td>
                <td>${currentUser.role !== "staff"
                    ? `<button class="btn btn-sm btn-primary" data-id="${p._id}" data-qty="${suggest}">Create PO</button>`
                    : ""}</td>
            </tr>`;
        }).join("");
}

$("reorderTableBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    switchTab("orders");
    openPoModal(btn.dataset.id, Number(btn.dataset.qty));
});

async function loadRecentMovements() {
    try {
        const movements = await apiRequest("/api/movements/recent");
        $("activityList").innerHTML = movements.length === 0
            ? `<p style="color:#64748b;">No movements recorded yet.</p>`
            : movements.map(m => `
                <div class="activity-item">
                    <div>
                        <span class="user">${escapeHtml(m.user_id?.fullName || m.user_id?.username || "System")}</span>
                        <span>${escapeHtml(m.product_id?.name || "Product")}</span>
                        <span style="color:#64748b;">(${escapeHtml(m.reason)})</span>
                        ${m.note ? `<div style="font-size:11px;color:#94a3b8;">&ldquo;${escapeHtml(m.note)}&rdquo;</div>` : ""}
                    </div>
                    <div style="text-align:right;">
                        <span class="change-pill ${m.change > 0 ? "change-plus" : "change-minus"}">${m.change > 0 ? "+" + m.change : m.change}</span>
                        <div style="font-size:10px;color:#94a3b8;">
                            ${new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                    </div>
                </div>`).join("");
    } catch {
        // ignore
    }
}

// ---------- Purchase Orders ----------
async function loadPurchaseOrders() {
    try {
        purchaseOrders = await apiRequest("/api/purchase-orders");
        renderPurchaseOrders();
    } catch (err) {
        showToast(err.message, "error");
    }
}

function renderPurchaseOrders() {
    $("pendingCount").textContent = purchaseOrders.filter(o => o.status === "pending").length;

    $("poTableBody").innerHTML = purchaseOrders.length === 0
        ? `<tr><td colspan="8" class="empty-row">No purchase orders recorded yet.</td></tr>`
        : purchaseOrders.map((po, idx) => {
            const badge = po.status === "received" ? "badge-in-stock"
                : (po.status === "pending" ? "badge-low-stock" : "badge-out-stock");
            let action = "";
            if (po.status === "pending" && currentUser.role !== "staff") {
                action = `<button class="btn btn-sm btn-success" data-id="${po._id}">✓ Mark Received</button>`;
            } else if (po.status === "received") {
                action = `<span style="font-size:11px;color:#166534;">Stock Added</span>`;
            }
            return `
            <tr>
                <td><b>PO-${idx + 101}</b></td>
                <td><b>${escapeHtml(po.product_id?.name || "Product")}</b> (${escapeHtml(po.product_id?.sku)})</td>
                <td>${escapeHtml(po.supplier_id?.name || "Supplier")}</td>
                <td><b>${po.quantity} units</b></td>
                <td>${escapeHtml(po.created_by?.fullName || po.created_by?.username)}</td>
                <td><span class="badge ${badge}">${po.status.toUpperCase()}</span></td>
                <td>${new Date(po.created_at).toLocaleDateString()}</td>
                <td>${action}</td>
            </tr>`;
        }).join("");
}

$("poTableBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    try {
        const data = await apiRequest(`/api/purchase-orders/${btn.dataset.id}/receive`, "POST");
        showToast(data.message, "success");
        loadPurchaseOrders();
        loadProducts();
        loadStats();
    } catch (err) {
        showToast(err.message, "error");
    }
});

async function openPoModal(productId = "", quantity = 20) {
    // Load all products (not just the current page) for the dropdown
    let allProducts = products;
    try {
        const data = await apiRequest("/api/products?all=true");
        allProducts = data.products || products;
    } catch { /* fall back to current page */ }

    $("poProduct").innerHTML = `<option value="">Select a product</option>` +
        allProducts.map(p => `<option value="${p._id}">${escapeHtml(p.name)} (${escapeHtml(p.sku)}) - Qty: ${p.quantity}</option>`).join("");
    $("poSupplier").innerHTML = `<option value="">Select a supplier</option>` +
        suppliers.map(s => `<option value="${s._id}">${escapeHtml(s.name)} (${escapeHtml(s.contact_person)})</option>`).join("");

    $("poProduct").value = productId || (allProducts[0]?._id ?? "");
    $("poSupplier").value = suppliers[0]?._id ?? "";
    $("poQuantity").value = quantity;
    openModal("poModal");
}

$("newPoBtn").addEventListener("click", () => openPoModal());

$("poForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        await apiRequest("/api/purchase-orders", "POST", {
            product_id: $("poProduct").value,
            supplier_id: $("poSupplier").value,
            quantity: $("poQuantity").value
        });
        showToast("Purchase order created", "success");
        closeModal("poModal");
        loadPurchaseOrders();
    } catch (err) {
        showToast(err.message, "error");
    }
});

// ---------- Suppliers ----------
async function loadSuppliers() {
    try {
        suppliers = await apiRequest("/api/suppliers");
        renderSuppliers();
    } catch {
        // ignore
    }
}

function renderSuppliers() {
    $("supplierCount").textContent = suppliers.length;
    $("supplierTableBody").innerHTML = suppliers.map(s => `
        <tr>
            <td><b>${escapeHtml(s.name)}</b></td>
            <td>${escapeHtml(s.contact_person || "—")}</td>
            <td>${escapeHtml(s.phone || "—")}</td>
            <td>${escapeHtml(s.email || "—")}</td>
            <td>${currentUser.role !== "staff"
                ? `<button class="btn btn-sm btn-outline" data-id="${s._id}">Edit</button>`
                : `<span style="font-size:12px;color:#64748b;">View Only</span>`}</td>
        </tr>`).join("");
}

function openSupplierModal(supplier = null) {
    editSupplierId = supplier ? supplier._id : null;
    $("supplierModalTitle").textContent = supplier ? "Edit Supplier" : "Add New Supplier";
    $("sName").value = supplier ? supplier.name : "";
    $("sContact").value = supplier ? supplier.contact_person : "";
    $("sPhone").value = supplier ? supplier.phone : "";
    $("sEmail").value = supplier ? supplier.email : "";
    openModal("supplierModal");
}

$("addSupplierBtn").addEventListener("click", () => openSupplierModal());
$("supplierTableBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-id]");
    if (btn) openSupplierModal(suppliers.find(s => s._id === btn.dataset.id));
});

$("supplierForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
        name: $("sName").value,
        contact_person: $("sContact").value,
        phone: $("sPhone").value,
        email: $("sEmail").value
    };
    try {
        if (editSupplierId) {
            await apiRequest(`/api/suppliers/${editSupplierId}`, "PUT", body);
            showToast("Supplier updated", "success");
        } else {
            await apiRequest("/api/suppliers", "POST", body);
            showToast("Supplier created", "success");
        }
        closeModal("supplierModal");
        loadSuppliers();
    } catch (err) {
        showToast(err.message, "error");
    }
});

// ---------- Users (Admin only) ----------
async function loadUsers() {
    try {
        usersList = await apiRequest("/api/users");
        renderUsers();
    } catch (err) {
        showToast(err.message, "error");
    }
}

function renderUsers() {
    $("userTableBody").innerHTML = usersList.map(u => `
        <tr>
            <td><b>${escapeHtml(u.username)}</b></td>
            <td>${escapeHtml(u.fullName || "—")}</td>
            <td><span class="role-badge role-${u.role}">${u.role}</span></td>
            <td><span class="badge ${u.active ? "badge-in-stock" : "badge-out-stock"}">${u.active ? "Active" : "Deactivated"}</span></td>
            <td>
                <button class="btn btn-sm btn-outline" data-action="reset" data-id="${u._id}">Reset Password</button>
                ${u._id !== currentUser.id ? `
                    <button class="btn btn-sm ${u.active ? "btn-danger" : "btn-success"}" style="margin-left:6px;" data-action="toggle" data-id="${u._id}">
                        ${u.active ? "Deactivate" : "Activate"}
                    </button>` : ""}
            </td>
        </tr>`).join("");
}

$("userTableBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const user = usersList.find(u => u._id === btn.dataset.id);

    if (btn.dataset.action === "reset") {
        resetPwdUser = user;
        $("resetPwdTitle").textContent = `Reset Password for ${user.username}`;
        $("newPassword").value = "";
        openModal("resetPwdModal");
    } else {
        try {
            await apiRequest(`/api/users/${user._id}`, "PUT", { active: !user.active });
            showToast(`User ${user.username} ${user.active ? "deactivated" : "activated"}`, "info");
            loadUsers();
        } catch (err) {
            showToast(err.message, "error");
        }
    }
});

$("addUserBtn").addEventListener("click", () => {
    $("userForm").reset();
    openModal("userModal");
});

$("userForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        await apiRequest("/api/users", "POST", {
            username: $("uUsername").value,
            fullName: $("uFullName").value,
            password: $("uPassword").value,
            role: $("uRole").value
        });
        showToast("User account created", "success");
        closeModal("userModal");
        loadUsers();
    } catch (err) {
        showToast(err.message, "error");
    }
});

$("resetPwdForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        const res = await apiRequest(`/api/users/${resetPwdUser._id}/reset-password`, "POST", {
            newPassword: $("newPassword").value
        });
        showToast(res.message, "success");
        closeModal("resetPwdModal");
    } catch (err) {
        showToast(err.message, "error");
    }
});

// ---------- Close modals: Cancel buttons and clicking the dark background ----------
document.querySelectorAll(".modal-overlay, .drawer-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target.closest("[data-close]")) {
            overlay.classList.add("hidden");
        }
    });
});

// ---------- Start ----------
checkSession();
