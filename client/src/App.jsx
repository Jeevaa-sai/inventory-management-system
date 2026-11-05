import { useState, useEffect } from "react";
import "./App.css";

const emptyForm = { name: "", category: "", price: "", quantity: "", minStock: 5 };

function App() {
  const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem("inventory_user") || "null"));
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");

  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [formMsg, setFormMsg] = useState("");

  const [restockItem, setRestockItem] = useState(null);
  const [customQty, setCustomQty] = useState(10);

  useEffect(() => {
    fetch("/api/auth/init", { method: "POST" }).catch(() => {});
    fetch("/api/products/seed", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) loadProducts();
  }, [user]);

  async function loadProducts() {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(data);
    } catch {
      console.log("Error loading products");
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData)
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        sessionStorage.setItem("inventory_user", JSON.stringify(data.user));
      } else {
        setLoginError(data.message || "Invalid credentials");
      }
    } catch {
      setLoginError("Server connection error");
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("inventory_user");
    setUser(null);
    setLoginData({ username: "", password: "" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      price: Number(form.price),
      quantity: Number(form.quantity),
      minStock: Number(form.minStock) || 5
    };

    try {
      const url = editId ? `/api/products/${editId}` : "/api/products";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setFormMsg(data.message);
        setForm(emptyForm);
        setEditId(null);
        loadProducts();
      } else {
        setFormMsg(data.message || "Failed to save");
      }
    } catch {
      setFormMsg("Error connecting to server");
    }
    setTimeout(() => setFormMsg(""), 3000);
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (res.ok) loadProducts();
    } catch {
      alert("Error deleting product");
    }
  }

  async function handleStockAdjust(id, change) {
    try {
      const res = await fetch(`/api/products/${id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ change })
      });
      if (res.ok) loadProducts();
      else {
        const data = await res.json();
        alert(data.message || "Stock error");
      }
    } catch {
      alert("Error adjusting stock");
    }
  }

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase().trim());
    const matchCat = category === "ALL" || p.category === category;
    return matchSearch && matchCat;
  });

  const totalQty = products.reduce((sum, p) => sum + p.quantity, 0);
  const lowStock = products.filter(p => p.quantity <= p.minStock).length;
  const totalVal = products.reduce((sum, p) => sum + p.price * p.quantity, 0);

  if (!user) {
    return (
      <div className="container">
        <div className="card login-card">
          <h2>User Login</h2>
          {loginError && <div className="message error">{loginError}</div>}
          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: "14px" }}>
              <label>Username</label>
              <input
                type="text"
                placeholder="Enter username"
                value={loginData.username}
                onChange={e => setLoginData({ ...loginData, username: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: "18px" }}>
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={loginData.password}
                onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header>
        <h1>Inventory Management System</h1>
        <div className="user-info">
          <span>Welcome, <b>{user.fullName || user.username}</b> ({user.role})</span>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Products</div>
          <div className="stat-number">{products.length}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Total Stock Units</div>
          <div className="stat-number">{totalQty}</div>
        </div>
        <div className="stat-card alert">
          <div className="stat-label">Low Stock Items</div>
          <div className="stat-number">{lowStock}</div>
        </div>
        <div className="stat-card value">
          <div className="stat-label">Total Inventory Value</div>
          <div className="stat-number">₹{totalVal.toLocaleString("en-IN")}</div>
        </div>
      </section>

      {user.role === "admin" && (
        <section className="card">
          <h2>{editId ? "Edit Product" : "Add New Product"}</h2>
          {formMsg && <div className="message success">{formMsg}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Product Name</label>
                <input
                  type="text"
                  placeholder="e.g. Wireless Mouse"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  required
                >
                  <option value="">Select Category</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Stationery">Stationery</option>
                  <option value="Grocery">Grocery</option>
                  <option value="Clothing">Clothing</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Min Stock Alert</label>
                <input
                  type="number"
                  min="1"
                  placeholder="5"
                  value={form.minStock}
                  onChange={e => setForm({ ...form, minStock: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              {editId ? "Update Product" : "Save Product"}
            </button>
            {editId && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginLeft: "8px" }}
                onClick={() => { setEditId(null); setForm(emptyForm); }}
              >
                Cancel
              </button>
            )}
          </form>
        </section>
      )}

      <section className="card">
        <h2>Product Inventory</h2>
        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search by product name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="ALL">All Categories</option>
            <option value="Electronics">Electronics</option>
            <option value="Stationery">Stationery</option>
            <option value="Grocery">Grocery</option>
            <option value="Clothing">Clothing</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Adjust Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", color: "#64748b", padding: "24px" }}>
                    No products found matching your search.
                  </td>
                </tr>
              ) : (
                filtered.map((p, index) => {
                  const isLow = p.quantity <= p.minStock;
                  return (
                    <tr key={p._id} className={isLow ? "low-stock-row" : ""}>
                      <td>{index + 1}</td>
                      <td><b>{p.name}</b></td>
                      <td><span className="category-tag">{p.category}</span></td>
                      <td>₹{Number(p.price).toFixed(2)}</td>
                      <td><b>{p.quantity}</b></td>
                      <td>
                        <span className={`badge ${isLow ? "badge-low-stock" : "badge-in-stock"}`}>
                          {isLow ? "Low Stock" : "In Stock"}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={() => handleStockAdjust(p._id, 1)}>+1</button>
                        <button className="btn btn-sm btn-outline" style={{ margin: "0 4px" }} onClick={() => handleStockAdjust(p._id, -1)}>-1</button>
                        <button className="btn btn-sm btn-success" onClick={() => { setRestockItem(p); setCustomQty(10); }}>
                          + Restock
                        </button>
                      </td>
                      <td>
                        {user.role === "admin" ? (
                          <>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => {
                                setEditId(p._id);
                                setForm({ name: p.name, category: p.category, price: p.price, quantity: p.quantity, minStock: p.minStock });
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              style={{ marginLeft: "4px" }}
                              onClick={() => handleDelete(p._id)}
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#64748b" }}>View Only</span>
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

      {restockItem && (
        <div className="modal-overlay" onClick={() => setRestockItem(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Restock: {restockItem.name}</h3>
            <p>Current Quantity: <b>{restockItem.quantity}</b> units</p>
            <label>Quick Presets</label>
            <div className="preset-grid">
              {[5, 10, 25, 50, 100].map(qty => (
                <button
                  key={qty}
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    handleStockAdjust(restockItem._id, qty);
                    setRestockItem(null);
                  }}
                >
                  +{qty}
                </button>
              ))}
            </div>
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label>Or Enter Custom Quantity to Add</label>
              <input
                type="number"
                min="1"
                value={customQty}
                onChange={e => setCustomQty(Number(e.target.value))}
              />
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setRestockItem(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (customQty > 0) {
                    handleStockAdjust(restockItem._id, customQty);
                    setRestockItem(null);
                  }
                }}
              >
                Add {customQty} Units
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
