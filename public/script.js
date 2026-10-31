// public/script.js
// Client-side JavaScript for Inventory Management System.
// Handles API calls using fetch(), DOM manipulation, and dynamic UI updates.
// Directly matches Module 3 (DOM & ES6) and Module 5 (Slides 4, 7, 12, 13) of syllabus.

// State variables stored in browser memory
let allProducts = [];
let currentUser = null;

// ========================================================
// 1. APPLICATION INITIALIZATION
// ========================================================
window.addEventListener("DOMContentLoaded", async () => {
    // Automatically seed default demo users and products on backend
    try {
        await fetch("/api/auth/init", { method: "POST" });
        await fetch("/api/products/seed", { method: "POST" });
    } catch (e) {
        console.log("Initialization check completed");
    }

    // Check if user is already logged in from previous session
    const savedUser = sessionStorage.getItem("inventory_user");
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDashboard();
    }
});


// ========================================================
// 2. AUTHENTICATION (LOGIN & LOGOUT)
// ========================================================

// Handle Login Form Submission
async function handleLogin(event) {
    // Stop form from refreshing the browser page
    event.preventDefault();

    const usernameInput = document.getElementById("loginUsername").value.trim();
    const passwordInput = document.getElementById("loginPassword").value.trim();
    const loginMessage = document.getElementById("loginMessage");

    try {
        // Send POST request with JSON credentials to backend
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: usernameInput,
                password: passwordInput
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Save user info in browser's sessionStorage
            currentUser = data.user;
            sessionStorage.setItem("inventory_user", JSON.stringify(currentUser));
            showDashboard();
        } else {
            // Display error message from server
            loginMessage.className = "message error";
            loginMessage.innerText = data.message || "Invalid credentials";
        }
    } catch (error) {
        loginMessage.className = "message error";
        loginMessage.innerText = "Cannot connect to server. Ensure Node server is running.";
    }
}

// Show Dashboard & Hide Login Section
function showDashboard() {
    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("appSection").classList.remove("hidden");

    // Display logged-in user name and role badge
    const badge = document.getElementById("userBadge");
    badge.innerText = `${currentUser.fullName || currentUser.username} (${currentUser.role.toUpperCase()})`;

    // Role-Based Access Control on UI:
    // If staff, hide the "Add Product" form since staff only adjusts stock
    const formCard = document.getElementById("formCard");
    if (currentUser.role === "staff") {
        formCard.classList.add("hidden");
    } else {
        formCard.classList.remove("hidden");
    }

    // Load products from database
    loadProducts();
}

// Handle Logout
function handleLogout() {
    sessionStorage.removeItem("inventory_user");
    currentUser = null;
    document.getElementById("loginSection").classList.remove("hidden");
    document.getElementById("appSection").classList.add("hidden");
    document.getElementById("loginUsername").value = "";
    document.getElementById("loginPassword").value = "";
    document.getElementById("loginMessage").className = "message";
}


// ========================================================
// 3. READ PRODUCTS (GET) & UPDATE STATS
// ========================================================

// Fetch all products from GET /api/products
async function loadProducts() {
    try {
        const response = await fetch("/api/products");
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        allProducts = await response.json();

        // Update dashboard statistics
        updateStats(allProducts);

        // Render products in the table
        renderTable(allProducts);
    } catch (error) {
        console.error("Error loading products:", error);
    }
}

// Calculate and update the 4 summary cards
function updateStats(products) {
    const totalProducts = products.length;

    // Total quantity: sum of all product quantities
    const totalQuantity = products.reduce((sum, item) => sum + item.quantity, 0);

    // Count products whose stock is less than or equal to minStock
    const lowStockCount = products.filter(item => item.quantity <= item.minStock).length;

    // Total inventory value: sum of (price * quantity)
    const totalValue = products.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Update DOM text
    document.getElementById("statTotalProducts").innerText = totalProducts;
    document.getElementById("statTotalQuantity").innerText = totalQuantity;
    document.getElementById("statLowStock").innerText = lowStockCount;
    document.getElementById("statTotalValue").innerText = `₹${totalValue.toLocaleString("en-IN")}`;
}

// Render product list into the HTML table
function renderTable(products) {
    const tbody = document.getElementById("productTableBody");
    tbody.innerHTML = "";

    if (products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #888;">No products found.</td></tr>`;
        return;
    }

    products.forEach((product, index) => {
        const isLowStock = product.quantity <= product.minStock;
        const rowClass = isLowStock ? "low-stock-row" : "";
        const statusBadge = isLowStock 
            ? `<span class="badge badge-low-stock">⚠️ Low Stock (&le; ${product.minStock})</span>`
            : `<span class="badge badge-in-stock">✓ In Stock</span>`;

        // Role-based actions: Only Admin can Edit or Delete
        let actionButtons = "";
        if (currentUser && currentUser.role === "admin") {
            actionButtons = `
                <button class="btn btn-primary btn-sm" onclick="editProduct('${product._id}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct('${product._id}')">Delete</button>
            `;
        } else {
            actionButtons = `<span style="font-size: 12px; color: #888;">View Only</span>`;
        }

        const tr = document.createElement("tr");
        if (rowClass) tr.className = rowClass;

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${product.name}</strong></td>
            <td>${product.category}</td>
            <td>₹${product.price.toFixed(2)}</td>
            <td><b>${product.quantity}</b></td>
            <td>${statusBadge}</td>
            <td>
                <!-- Quick Stock In / Stock Out Buttons -->
                <button class="btn btn-success btn-sm" title="Stock In (+1)" onclick="adjustStock('${product._id}', 1)">+1</button>
                <button class="btn btn-secondary btn-sm" title="Stock Out (-1)" onclick="adjustStock('${product._id}', -1)">-1</button>
            </td>
            <td>${actionButtons}</td>
        `;

        tbody.appendChild(tr);
    });
}


// ========================================================
// 4. CREATE (POST) & UPDATE (PUT) PRODUCT
// ========================================================

async function saveProduct(event) {
    event.preventDefault();

    const id = document.getElementById("productId").value;
    const name = document.getElementById("productName").value.trim();
    const category = document.getElementById("productCategory").value;
    const price = document.getElementById("productPrice").value;
    const quantity = document.getElementById("productQuantity").value;
    const minStock = document.getElementById("productMinStock").value;
    const messageBox = document.getElementById("formMessage");

    const productPayload = {
        name: name,
        category: category,
        price: Number(price),
        quantity: Number(quantity),
        minStock: Number(minStock) || 5
    };

    try {
        let response;
        if (id) {
            // Existing product: send PUT request to update
            response = await fetch(`/api/products/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(productPayload)
            });
        } else {
            // New product: send POST request to create
            response = await fetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(productPayload)
            });
        }

        const data = await response.json();

        if (response.ok) {
            messageBox.className = "message success";
            messageBox.innerText = data.message;
            cancelEdit();
            loadProducts();
        } else {
            messageBox.className = "message error";
            messageBox.innerText = data.message || "Failed to save product";
        }
    } catch (error) {
        messageBox.className = "message error";
        messageBox.innerText = "Error connecting to server";
    }

    // Automatically hide message after 3 seconds
    setTimeout(() => {
        messageBox.className = "message";
    }, 3000);
}

// Populate form inputs for editing
function editProduct(id) {
    const product = allProducts.find(item => item._id === id);
    if (!product) return;

    document.getElementById("productId").value = product._id;
    document.getElementById("productName").value = product.name;
    document.getElementById("productCategory").value = product.category;
    document.getElementById("productPrice").value = product.price;
    document.getElementById("productQuantity").value = product.quantity;
    document.getElementById("productMinStock").value = product.minStock;

    // Change form UI to "Edit Mode"
    document.getElementById("formTitle").innerText = "Edit Product";
    document.getElementById("saveButton").innerText = "Update Product";
    document.getElementById("cancelButton").classList.remove("hidden");

    // Smooth scroll to form
    document.getElementById("formCard").scrollIntoView({ behavior: "smooth" });
}

// Reset form back to "Add Mode"
function cancelEdit() {
    document.getElementById("productForm").reset();
    document.getElementById("productId").value = "";
    document.getElementById("formTitle").innerText = "Add New Product";
    document.getElementById("saveButton").innerText = "Save Product";
    document.getElementById("cancelButton").classList.add("hidden");
}


// ========================================================
// 5. DELETE & STOCK ADJUST (DELETE & PATCH)
// ========================================================

async function deleteProduct(id) {
    const confirmed = confirm("Are you sure you want to delete this product permanently?");
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/products/${id}`, {
            method: "DELETE"
        });

        if (response.ok) {
            loadProducts();
        } else {
            alert("Failed to delete product.");
        }
    } catch (error) {
        alert("Server communication error.");
    }
}

// Adjust stock quantity (+1 or -1)
async function adjustStock(id, change) {
    try {
        const response = await fetch(`/api/products/${id}/stock`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ change: change })
        });

        if (response.ok) {
            loadProducts();
        } else {
            const data = await response.json();
            alert(data.message || "Could not adjust stock.");
        }
    } catch (error) {
        alert("Server error adjusting stock.");
    }
}


// ========================================================
// 6. LIVE SEARCH AND CATEGORY FILTERING (Module 3 Array Methods)
// ========================================================

function filterProducts() {
    const searchQuery = document.getElementById("searchInput").value.toLowerCase().trim();
    const selectedCategory = document.getElementById("categoryFilter").value;

    const filtered = allProducts.filter(product => {
        // Match search query against product name
        const matchesSearch = product.name.toLowerCase().includes(searchQuery);

        // Match category dropdown
        const matchesCategory = (selectedCategory === "ALL") || (product.category === selectedCategory);

        return matchesSearch && matchesCategory;
    });

    // Re-render table with filtered subset
    renderTable(filtered);
}

