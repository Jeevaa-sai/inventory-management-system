const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const { csrfProtection } = require("./middleware/auth");

const app = express();
const port = 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express Session Configuration
app.use(session({
    name: "inventory.sid",
    secret: "inventory-mern-webtech-secret-key-2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: "lax",
        secure: false // Set to true if on HTTPS
    }
}));

// CSRF Protection on mutating requests (POST, PUT, DELETE, PATCH)
app.use(csrfProtection);

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/inventoryDB")
    .then(() => console.log("Connected to MongoDB successfully"))
    .catch((err) => console.error("MongoDB connection error:", err));

// Mount REST API Routes
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const statRoutes = require("./routes/statRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const purchaseOrderRoutes = require("./routes/purchaseOrderRoutes");
const userRoutes = require("./routes/userRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api", statRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/users", userRoutes);

// Fallback: serve the frontend for any non-API route
app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(__dirname, "public/index.html"));
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
