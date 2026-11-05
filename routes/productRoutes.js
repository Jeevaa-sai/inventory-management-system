const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const { requireAuth, requireRole } = require("../middleware/auth");

/**
 * GET /api/products
 * Query params: search, category, status, sort, page, limit, all
 */
router.get("/", requireAuth, async (req, res) => {
    try {
        const { search, category, status, sort, page = 1, limit = 10, all } = req.query;

        const query = {};

        // Search by name or SKU
        if (search && search.trim()) {
            const regex = new RegExp(search.trim(), "i");
            query.$or = [{ name: regex }, { sku: regex }];
        }

        // Filter by category
        if (category && category !== "ALL") {
            query.category = category;
        }

        let products = await Product.find(query);

        // Filter by Stock Status
        if (status === "out" || status === "out_of_stock") {
            products = products.filter(p => p.quantity === 0);
        } else if (status === "low" || status === "low_stock") {
            products = products.filter(p => p.quantity > 0 && p.quantity <= (p.reorder_level || p.minStock || 5));
        } else if (status === "in" || status === "in_stock") {
            products = products.filter(p => p.quantity > (p.reorder_level || p.minStock || 5));
        }

        // Sorting
        if (sort === "name_asc") products.sort((a, b) => a.name.localeCompare(b.name));
        else if (sort === "name_desc") products.sort((a, b) => b.name.localeCompare(a.name));
        else if (sort === "price_asc") products.sort((a, b) => a.price - b.price);
        else if (sort === "price_desc") products.sort((a, b) => b.price - a.price);
        else if (sort === "stock_asc") products.sort((a, b) => a.quantity - b.quantity);
        else if (sort === "stock_desc") products.sort((a, b) => b.quantity - a.quantity);
        else products.sort((a, b) => a.name.localeCompare(b.name));

        const total = products.length;

        if (all === "true" || all === true) {
            return res.json({ products, total, page: 1, totalPages: 1 });
        }

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.max(1, parseInt(limit) || 10);
        const totalPages = Math.ceil(total / limitNum) || 1;
        const startIndex = (pageNum - 1) * limitNum;
        const paginated = products.slice(startIndex, startIndex + limitNum);

        res.json({
            products: paginated,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages
        });
    } catch (err) {
        console.error("Fetch products error:", err);
        res.status(500).json({ message: "Error fetching products" });
    }
});

/**
 * GET /api/products/:id
 */
router.get("/:id", requireAuth, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.json(product);
    } catch (err) {
        res.status(500).json({ message: "Error fetching product details" });
    }
});

/**
 * GET /api/products/:id/movements
 */
router.get("/:id/movements", requireAuth, async (req, res) => {
    try {
        const movements = await StockMovement.find({ product_id: req.params.id })
            .populate("user_id", "username fullName role")
            .sort({ created_at: -1 })
            .limit(50);
        res.json(movements);
    } catch (err) {
        res.status(500).json({ message: "Error fetching movement history" });
    }
});

/**
 * POST /api/products
 * Admin only: Create new product
 */
router.post("/", requireRole("admin"), async (req, res) => {
    try {
        const { name, sku, category, price, quantity, reorder_level } = req.body;

        if (!name || !name.trim()) return res.status(400).json({ message: "Product name is required" });
        if (!sku || !sku.trim()) return res.status(400).json({ message: "Product SKU is required" });
        if (!category || !category.trim()) return res.status(400).json({ message: "Category is required" });

        const numPrice = Number(price);
        if (isNaN(numPrice) || numPrice <= 0) {
            return res.status(400).json({ message: "Price must be a positive number greater than 0" });
        }

        const numQty = Number(quantity);
        if (isNaN(numQty) || numQty < 0) {
            return res.status(400).json({ message: "Stock quantity cannot be negative" });
        }

        const numReorder = reorder_level !== undefined ? Number(reorder_level) : 5;
        if (isNaN(numReorder) || numReorder < 0) {
            return res.status(400).json({ message: "Reorder level cannot be negative" });
        }

        const cleanSku = sku.trim().toUpperCase();
        const existingSku = await Product.findOne({ sku: cleanSku });
        if (existingSku) {
            return res.status(400).json({ message: `SKU '${cleanSku}' already exists. SKUs must be unique.` });
        }

        const newProduct = new Product({
            name: name.trim(),
            sku: cleanSku,
            category: category.trim(),
            price: numPrice,
            quantity: numQty,
            reorder_level: numReorder,
            minStock: numReorder
        });

        const saved = await newProduct.save();

        if (numQty > 0) {
            await StockMovement.create({
                product_id: saved._id,
                change: numQty,
                reason: "restock",
                note: "Initial product stock registration",
                user_id: req.session.user.id,
                stock_after: numQty
            });
        }


        res.status(201).json({
            message: "Product created successfully",
            product: saved
        });
    } catch (err) {
        console.error("Create product error:", err);
        res.status(500).json({ message: "Error creating product: " + err.message });
    }
});

/**
 * PUT /api/products/:id
 * Admin only: Update product
 */
router.put("/:id", requireRole("admin"), async (req, res) => {
    try {
        const { name, sku, category, price, quantity, reorder_level } = req.body;
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (name) product.name = name.trim();
        if (category) product.category = category.trim();

        if (price !== undefined) {
            const p = Number(price);
            if (isNaN(p) || p <= 0) return res.status(400).json({ message: "Price must be greater than 0" });
            product.price = p;
        }

        if (sku && sku.trim().toUpperCase() !== product.sku) {
            const cleanSku = sku.trim().toUpperCase();
            const existingSku = await Product.findOne({ sku: cleanSku, _id: { $ne: product._id } });
            if (existingSku) return res.status(400).json({ message: `SKU '${cleanSku}' is already taken.` });
            product.sku = cleanSku;
        }

        if (reorder_level !== undefined) {
            const r = Number(reorder_level);
            if (isNaN(r) || r < 0) return res.status(400).json({ message: "Reorder level cannot be negative" });
            product.reorder_level = r;
            product.minStock = r;
        }

        if (quantity !== undefined) {
            const q = Number(quantity);
            if (isNaN(q) || q < 0) return res.status(400).json({ message: "Quantity cannot be negative" });
            product.quantity = q;
        }

        const updated = await product.save();


        res.json({
            message: "Product updated successfully",
            product: updated
        });
    } catch (err) {
        console.error("Update product error:", err);
        res.status(500).json({ message: "Error updating product" });
    }
});

/**
 * DELETE /api/products/:id
 * Admin only: Delete product
 */
router.delete("/:id", requireRole("admin"), async (req, res) => {
    try {
        const deleted = await Product.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: "Product not found" });
        }
        await StockMovement.deleteMany({ product_id: req.params.id });


        res.json({ message: "Product and associated movements deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting product" });
    }
});

/**
 * POST /api/products/:id/adjust
 * Stock adjustment with automatic stock movement audit logging
 * Allowed: staff, manager, admin
 */
router.post("/:id/adjust", requireRole("staff", "manager", "admin"), async (req, res) => {
    try {
        const { change, reason = "correction", note = "" } = req.body;
        const numChange = Number(change);

        if (isNaN(numChange) || numChange === 0) {
            return res.status(400).json({ message: "Adjustment quantity must be a non-zero number" });
        }

        const validReasons = ["sold", "damaged", "returned", "restock", "correction", "purchase_order"];
        if (!validReasons.includes(reason)) {
            return res.status(400).json({ message: `Invalid reason. Must be one of: ${validReasons.join(", ")}` });
        }

        // Manager/Admin required for bulk restock (> 25 units) or reason purchase_order
        if ((numChange > 25 || reason === "purchase_order") && req.session.user.role === "staff") {
            return res.status(403).json({ message: "Bulk restocking over 25 units or purchase orders requires Manager or Admin role" });
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const newStock = product.quantity + numChange;
        if (newStock < 0) {
            return res.status(400).json({
                message: `Insufficient stock! Current stock is ${product.quantity}, cannot deduct ${Math.abs(numChange)} units.`
            });
        }

        product.quantity = newStock;
        await product.save();

        const movement = new StockMovement({
            product_id: product._id,
            change: numChange,
            reason: reason,
            note: (note || "").trim(),
            user_id: req.session.user.id,
            stock_after: newStock,
            created_at: new Date()
        });
        await movement.save();

        const populatedMovement = await StockMovement.findById(movement._id)
            .populate("product_id", "name sku category")
            .populate("user_id", "username fullName role");


        res.json({
            message: "Stock adjusted successfully",
            product: product,
            movement: populatedMovement
        });
    } catch (err) {
        console.error("Stock adjust error:", err);
        res.status(500).json({ message: "Stock adjustment failed: " + err.message });
    }
});

/**
 * PATCH /api/products/:id/stock (Legacy compatibility)
 */
router.patch("/:id/stock", requireRole("staff", "manager", "admin"), async (req, res) => {
    const { change, reason = (Number(req.body.change) > 0 ? "returned" : "sold"), note = "Quick adjust" } = req.body;
    req.body = { change, reason, note };
    return router.handle(req, res);
});

module.exports = router;
