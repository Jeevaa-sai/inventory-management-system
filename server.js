const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "client/dist")));
app.use(express.static(path.join(__dirname, "public")));

mongoose.connect("mongodb://127.0.0.1:27017/inventoryDB")
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch((err) => {
        console.log("DB connection error:", err);
    });

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

app.listen(port, () => {
    console.log("Server running on http://localhost:" + port);
});
