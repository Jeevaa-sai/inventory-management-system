const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const port = 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// connect to mongodb
mongoose.connect("mongodb://127.0.0.1:27017/inventoryDB")
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch((err) => {
        console.log("DB connection error:", err);
    });

// routes
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

app.listen(port, () => {
    console.log("Server running on http://localhost:" + port);
});
