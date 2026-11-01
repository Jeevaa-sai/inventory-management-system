let allProducts = [];
let currentUser = null;

// run on page load
window.addEventListener("DOMContentLoaded", async () => {
    try {
        await fetch("/api/auth/init", { method: "POST" });
        await fetch("/api/products/seed", { method: "POST" });
    } catch (e) {
        console.log("Initialization complete");
    }

    const savedUser = sessionStorage.getItem("inventory_user");
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDashboard();
    }
});

// login function
async function handleLogin(event) {
    event.preventDefault();

    const usernameInput = document.getElementById("loginUsername").value.trim();
    const passwordInput = document.getElementById("loginPassword").value.trim();
    const loginMessage = document.getElementById("loginMessage");

    try {
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
            currentUser = data.user;
            sessionStorage.setItem("inventory_user", JSON.stringify(currentUser));
            showDashboard();
        } else {
            loginMessage.className = "message error";
            loginMessage.innerText = data.message || "Invalid credentials";
        }
    } catch (error) {
        loginMessage.className = "message error";
        loginMessage.innerText = "Error connecting to server";
    }
}

// show dashboard screen
function showDashboard() {
    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("appSection").classList.remove("hidden");

    const badge = document.getElementById("userBadge");
    badge.innerText = `${currentUser.fullName || currentUser.username} (${currentUser.role})`;

    // hide add product form for staff
    const formCard = document.getElementById("formCard");
    if (currentUser.role === "staff") {
        formCard.classList.add("hidden");
    } else {
        formCard.classList.remove("hidden");
    }

    loadProducts();
}

// logout
function handleLogout() {
    sessionStorage.removeItem("inventory_user");
    currentUser = null;
    document.getElementById("loginSection").classList.remove("hidden");
    document.getElementById("appSection").classList.add("hidden");
    document.getElementById("loginUsername").value = "";
    document.getElementById("loginPassword").value = "";
    document.getElementById("loginMessage").className = "message";
}

// fetch all products
async function loadProducts() {
    try {
        const response = await fetch("/api/products");
        allProducts = await response.json();

        updateStats(allProducts);
        renderTable(allProducts);
    } catch (error) {
        console.log("Error loading products:", error);
    }
}

// calculate summary stats
function updateStats(products) {
    const totalProducts = products.length;
    const totalQuantity = products.reduce((sum, item) => sum + item.quantity, 0);
    const lowStockCount = products.filter(item => item.quantity <= item.minStock).length;
    const totalValue = products.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    document.getElementById("statTotalProducts").innerText = totalProducts;
    document.getElementById("statTotalQuantity").innerText = totalQuantity;
    document.getElementById("statLowStock").innerText = lowStockCount;
    document.getElementById("statTotalValue").innerText = "₹" + totalValue.toLocaleString("en-IN");
}

// display products in table
function renderTable(products) {
    const tbody = document.getElementById("productTableBody");
    tbody.innerHTML = "";

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #888;">No products found</td></tr>';
        return;
    }

    products.forEach((product, index) => {
        const isLowStock = product.quantity <= product.minStock;
        const rowClass = isLowStock ? "low-stock-row" : "";
        const statusBadge = isLowStock 
            ? '<span class="badge badge-low-stock">Low Stock</span>'
            : '<span class="badge badge-in-stock">In Stock</span>';

        let actionButtons = "";
        if (currentUser && currentUser.role === "admin") {
            actionButtons = `
                <button class="btn btn-primary btn-sm" onclick="editProduct('${product._id}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct('${product._id}')">Delete</button>
            `;
        } else {
            actionButtons = '<span style="font-size: 12px; color: #888;">View Only</span>';
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
                <button class="btn btn-success btn-sm" onclick="adjustStock('${product._id}', 1)">+1</button>
                <button class="btn btn-secondary btn-sm" onclick="adjustStock('${product._id}', -1)">-1</button>
            </td>
            <td>${actionButtons}</td>
        `;

        tbody.appendChild(tr);
    });
}

// add or update product
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
            response = await fetch(`/api/products/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(productPayload)
            });
        } else {
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
            messageBox.innerText = data.message || "Error saving product";
        }
    } catch (error) {
        messageBox.className = "message error";
        messageBox.innerText = "Error connecting to server";
    }

    setTimeout(() => {
        messageBox.className = "message";
    }, 3000);
}

// edit product
function editProduct(id) {
    const product = allProducts.find(item => item._id === id);
    if (!product) return;

    document.getElementById("productId").value = product._id;
    document.getElementById("productName").value = product.name;
    document.getElementById("productCategory").value = product.category;
    document.getElementById("productPrice").value = product.price;
    document.getElementById("productQuantity").value = product.quantity;
    document.getElementById("productMinStock").value = product.minStock;

    document.getElementById("formTitle").innerText = "Edit Product";
    document.getElementById("saveButton").innerText = "Update Product";
    document.getElementById("cancelButton").classList.remove("hidden");

    document.getElementById("formCard").scrollIntoView({ behavior: "smooth" });
}

// cancel editing
function cancelEdit() {
    document.getElementById("productForm").reset();
    document.getElementById("productId").value = "";
    document.getElementById("formTitle").innerText = "Add Product";
    document.getElementById("saveButton").innerText = "Save Product";
    document.getElementById("cancelButton").classList.add("hidden");
}

// delete product
async function deleteProduct(id) {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
        const response = await fetch(`/api/products/${id}`, {
            method: "DELETE"
        });

        if (response.ok) {
            loadProducts();
        } else {
            alert("Could not delete product");
        }
    } catch (error) {
        alert("Error connecting to server");
    }
}

// adjust stock quantity
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
            alert(data.message || "Could not adjust stock");
        }
    } catch (error) {
        alert("Error connecting to server");
    }
}

// search and category filter
function filterProducts() {
    const searchQuery = document.getElementById("searchInput").value.toLowerCase().trim();
    const selectedCategory = document.getElementById("categoryFilter").value;

    const filtered = allProducts.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery);
        const matchesCategory = (selectedCategory === "ALL") || (product.category === selectedCategory);
        return matchesSearch && matchesCategory;
    });

    renderTable(filtered);
}
