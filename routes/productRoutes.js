const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// get all products
router.get("/", async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: "Error fetching products" });
    }
});

// get single product by id
router.get("/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.json(product);
    } catch (err) {
        res.status(500).json({ message: "Error fetching product" });
    }
});

// add product
router.post("/", async (req, res) => {
    try {
        const { name, category, price, quantity, minStock } = req.body;

        if (!name || !category || price === undefined || quantity === undefined) {
            return res.status(400).json({ message: "Please fill all required fields" });
        }

        const newProduct = new Product({
            name: name,
            category: category,
            price: Number(price),
            quantity: Number(quantity),
            minStock: minStock !== undefined ? Number(minStock) : 5
        });

        const saved = await newProduct.save();
        res.status(201).json({
            message: "Product added successfully",
            product: saved
        });
    } catch (err) {
        res.status(500).json({ message: "Error saving product" });
    }
});

// update product
router.put("/:id", async (req, res) => {
    try {
        const updated = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json({
            message: "Product updated successfully",
            product: updated
        });
    } catch (err) {
        res.status(500).json({ message: "Error updating product" });
    }
});

// delete product
router.delete("/:id", async (req, res) => {
    try {
        const deleted = await Product.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.json({ message: "Product deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting product" });
    }
});

// adjust stock (+1 or -1)
router.patch("/:id/stock", async (req, res) => {
    try {
        const { change } = req.body;
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const newQty = product.quantity + Number(change);
        if (newQty < 0) {
            return res.status(400).json({ message: "Stock cannot be negative" });
        }

        product.quantity = newQty;
        await product.save();

        res.json({
            message: "Stock updated successfully",
            product: product
        });
    } catch (err) {
        res.status(500).json({ message: "Error updating stock" });
    }
});

// seed sample products
router.post("/seed", async (req, res) => {
    try {
        const count = await Product.countDocuments();
        if (count === 0) {
            await Product.create([
                { name: "Wireless Mouse", category: "Electronics", price: 650, quantity: 24, minStock: 5 },
                { name: "USB Keyboard", category: "Electronics", price: 1200, quantity: 8, minStock: 3 },
                { name: "Fast Charger Cable", category: "Electronics", price: 250, quantity: 3, minStock: 5 },
                { name: "A4 Paper Bundle", category: "Stationery", price: 320, quantity: 15, minStock: 5 },
                { name: "Ballpoint Pens Box", category: "Stationery", price: 120, quantity: 2, minStock: 5 }
            ]);
            return res.json({ message: "Sample products added" });
        }
        res.json({ message: "Products exist" });
    } catch (err) {
        res.status(500).json({ message: "Error seeding products" });
    }
});

module.exports = router;
