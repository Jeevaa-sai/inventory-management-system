// server.js
// Main entry point for our Inventory Management System.
// Sets up Express server, connects to MongoDB, configures middleware, and registers routes.
// Directly follows Module 4 (Slides 12, 18, 25, 27) and Module 5 (Slide 6 & 10).

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

// Step 1: Initialize Express application
const app = express();
// Using port 5000 (alternate development port from Module 4 Slide 11)
const port = 5000;

// Step 2: Configure Built-in Middleware
// express.json(): Parses incoming HTTP requests with JSON payloads (req.body)
app.use(express.json());

// express.static(): Serves static files (HTML, CSS, JS) from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

// Step 3: Connect to MongoDB Database
// Uses local MongoDB running on default port 27017
const MONGO_URI = "mongodb://127.0.0.1:27017/inventoryDB";

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected successfully to database: inventoryDB");
    })
    .catch((error) => {
        console.error("MongoDB Connection Error:", error.message);
    });

// Step 4: Import and Mount Routes
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

// Step 5: Start the Server and listen for client requests
app.listen(port, () => {
    console.log(`Server is running at: http://localhost:${port}`);
    console.log(`Press Ctrl + C to stop the server`);
});

