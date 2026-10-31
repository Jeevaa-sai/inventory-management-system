// routes/productRoutes.js
// This file handles all RESTful API endpoints for Products (CRUD Operations).
// Matches Module 4 (Slide 26-27 & Task 4) and Module 5 (Slide 4) of syllabus.

const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// Route 1: GET /api/products (READ ALL)
// Retrieves all products from the MongoDB collection.
router.get("/", async (req, res) => {
    try {
        const products = await Product.find();
        // 200 = Success (default status)
        res.json(products);
    } catch (error) {
        // 500 = Server Error
        res.status(500).json({ message: "Error fetching products", error: error.message });
    }
});

// Route 2: GET /api/products/:id (READ ONE)
// Retrieves a single product by its MongoDB _id using req.params.id
router.get("/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            // 404 = Not Found
            return res.status(404).json({ message: "Product not found" });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: "Error fetching product", error: error.message });
    }
});

// Route 3: POST /api/products (CREATE)
// Creates a new product and saves it in MongoDB.
router.post("/", async (req, res) => {
    try {
        const { name, category, price, quantity, minStock } = req.body;

        // Basic validation
        if (!name || !category || price === undefined || quantity === undefined) {
            // 400 = Bad Request
            return res.status(400).json({ message: "Please fill all required fields" });
        }

        const newProduct = new Product({
            name: name,
            category: category,
            price: Number(price),
            quantity: Number(quantity),
            minStock: minStock !== undefined ? Number(minStock) : 5
        });

        const savedProduct = await newProduct.save();
        // 201 = Resource Created (taught in Module 5 Slide 4 & 22)
        res.status(201).json({
            message: "Product created successfully",
            product: savedProduct
        });
    } catch (error) {
        res.status(500).json({ message: "Error creating product", error: error.message });
    }
});

// Route 4: PUT /api/products/:id (UPDATE)
// Updates an existing product using findByIdAndUpdate.
// { new: true } returns the updated document instead of the old one.
router.put("/:id", async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json({
            message: "Product updated successfully",
            product: updatedProduct
        });
    } catch (error) {
        res.status(500).json({ message: "Error updating product", error: error.message });
    }
});

// Route 5: DELETE /api/products/:id (DELETE)
// Deletes a product from MongoDB using findByIdAndDelete.
router.delete("/:id", async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);

        if (!deletedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json({ message: "Product deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting product", error: error.message });
    }
});

// Route 6: PATCH /api/products/:id/stock (QUICK STOCK IN / STOCK OUT)
// Increases or decreases product stock quantity directly.
router.patch("/:id/stock", async (req, res) => {
    try {
        const { change } = req.body; // e.g. +1 or -1
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const newQuantity = product.quantity + Number(change);
        if (newQuantity < 0) {
            return res.status(400).json({ message: "Stock quantity cannot fall below 0" });
        }

        product.quantity = newQuantity;
        await product.save();

        res.json({
            message: "Stock updated successfully",
            product: product
        });
    } catch (error) {
        res.status(500).json({ message: "Error adjusting stock", error: error.message });
    }
});

// Route 7: POST /api/products/seed (INITIALIZE SAMPLE PRODUCTS)
// Populates 5 demo products if database has none, so you don't start with an empty table.
router.post("/seed", async (req, res) => {
    try {
        const count = await Product.countDocuments();
        if (count === 0) {
            await Product.create([
                { name: "Wireless Optical Mouse", category: "Electronics", price: 650, quantity: 24, minStock: 5 },
                { name: "Mechanical Gaming Keyboard", category: "Electronics", price: 2400, quantity: 8, minStock: 3 },
                { name: "USB-C Fast Charging Cable (1m)", category: "Electronics", price: 299, quantity: 3, minStock: 5 }, // Low stock sample!
                { name: "A4 Size Copier Paper Ream (500 sheets)", category: "Stationery", price: 320, quantity: 15, minStock: 5 },
                { name: "Gel Ink Rollerball Pens (Pack of 10)", category: "Stationery", price: 150, quantity: 2, minStock: 5 } // Low stock sample!
            ]);
            return res.json({ message: "Sample products added successfully" });
        }
        res.json({ message: "Products already exist in database" });
    } catch (error) {
        res.status(500).json({ message: "Error seeding products", error: error.message });
    }
});

module.exports = router;

