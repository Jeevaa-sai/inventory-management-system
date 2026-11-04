import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [minStock, setMinStock] = useState(5);
  const [formMessage, setFormMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/init", { method: "POST" }).catch(() => {});
    fetch("/api/products/seed", { method: "POST" }).catch(() => {});

    const saved = sessionStorage.getItem("inventory_user");
    if (saved) {
      setUser(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadProducts();
    }
  }, [user]);

  async function loadProducts() {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(data);
    } catch (err) {
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
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok) {
        setUser(data.user);
        sessionStorage.setItem("inventory_user", JSON.stringify(data.user));
      } else {
        setLoginError(data.message || "Invalid credentials");
      }
    } catch (err) {
      setLoginError("Error connecting to server");
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("inventory_user");
    setUser(null);
    setUsername("");
    setPassword("");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const payload = {
      name,
      category,
      price: Number(price),
      quantity: Number(quantity),
      minStock: Number(minStock) || 5
    };

    try {
      let res;
      if (id) {
        res = await fetch(`/api/products/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (res.ok) {
        setFormMessage(data.message);
        resetForm();
        loadProducts();
      } else {
        setFormMessage(data.message || "Failed to save");
      }
    } catch (err) {
      setFormMessage("Error connecting to server");
    }

    setTimeout(() => setFormMessage(""), 3000);
  }

  function handleEdit(product) {
    setId(product._id);
    setName(product.name);
    setCategory(product.category);
    setPrice(product.price);
    setQuantity(product.quantity);
    setMinStock(product.minStock);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setId("");
    setName("");
    setCategory("");
    setPrice("");
    setQuantity("");
    setMinStock(5);
  }

  async function handleDelete(productId) {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
      if (res.ok) {
        loadProducts();
      } else {
        alert("Failed to delete");
      }
    } catch (err) {
      alert("Error connecting to server");
    }
  }

  async function handleStockAdjust(productId, change) {
    try {
      const res = await fetch(`/api/products/${productId}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ change })
      });

      if (res.ok) {
        loadProducts();
      } else {
        const data = await res.json();
        alert(data.message || "Stock error");
      }
    } catch (err) {
      alert("Error connecting to server");
    }
  }

  const totalProducts = products.length;
  const totalQuantity = products.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockCount = products.filter(item => item.quantity <= item.minStock).length;
  const totalValue = products.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const matchesCategory = categoryFilter === "ALL" || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (!user) {
    return (
      <div className="container">
        <div className="card login-card">
          <h2>User Login</h2>
          {loginError && <div className="message error">{loginError}</div>}
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }}>
              Login
            </button>
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
          <span>Welcome, <b>{user.fullName || user.username} ({user.role})</b></span>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Products</div>
          <div className="stat-number">{totalProducts}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Total Stock</div>
          <div className="stat-number">{totalQuantity}</div>
        </div>
        <div className="stat-card alert">
          <div className="stat-label">Low Stock Items</div>
          <div className="stat-number">{lowStockCount}</div>
        </div>
        <div className="stat-card value">
          <div className="stat-label">Total Value</div>
          <div className="stat-number">₹{totalValue.toLocaleString("en-IN")}</div>
        </div>
      </div>

      {user.role === "admin" && (
        <div className="card">
          <h2>{id ? "Edit Product" : "Add Product"}</h2>
          {formMessage && <div className="message success">{formMessage}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Product Name</label>
                <input
                  type="text"
                  placeholder="Product name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} required>
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
                  placeholder="Price"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  placeholder="Quantity"
                  min="0"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Alert Level</label>
                <input
                  type="number"
                  placeholder="Minimum stock"
                  min="1"
                  value={minStock}
                  onChange={e => setMinStock(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              {id ? "Update Product" : "Save Product"}
            </button>
            {id && (
              <button type="button" className="btn btn-secondary" onClick={resetForm} style={{ marginLeft: "8px" }}>
                Cancel
              </button>
            )}
          </form>
        </div>
      )}

      <div className="card">
        <h2>Product List</h2>
        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="ALL">All Categories</option>
            <option value="Electronics">Electronics</option>
            <option value="Stationery">Stationery</option>
            <option value="Grocery">Grocery</option>
            <option value="Clothing">Clothing</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Stock Adjust</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", color: "#888" }}>
                  No products found
                </td>
              </tr>
            ) : (
              filteredProducts.map((p, index) => {
                const isLow = p.quantity <= p.minStock;
                return (
                  <tr key={p._id} className={isLow ? "low-stock-row" : ""}>
                    <td>{index + 1}</td>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.category}</td>
                    <td>₹{Number(p.price).toFixed(2)}</td>
                    <td><b>{p.quantity}</b></td>
                    <td>
                      <span className={`badge ${isLow ? "badge-low-stock" : "badge-in-stock"}`}>
                        {isLow ? "Low Stock" : "In Stock"}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-success btn-sm" onClick={() => handleStockAdjust(p._id, 1)}>+1</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleStockAdjust(p._id, -1)}>-1</button>
                    </td>
                    <td>
                      {user.role === "admin" ? (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => handleEdit(p)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p._id)}>Delete</button>
                        </>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#888" }}>View Only</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
