const express = require("express");
const router = express.Router();
const PurchaseOrder = require("../models/PurchaseOrder");
const Product = require("../models/Product");
const Supplier = require("../models/Supplier");
const StockMovement = require("../models/StockMovement");
const { requireAuth, requireRole } = require("../middleware/auth");

// List all purchase orders (staff, manager, admin)
router.get("/", requireAuth, async (req, res) => {
    try {
        const orders = await PurchaseOrder.find()
            .populate("product_id", "name sku category price")
            .populate("supplier_id", "name contact_person phone email")
            .populate("created_by", "username fullName role")
            .sort({ created_at: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: "Error fetching purchase orders" });
    }
});

// Create a new purchase order (manager, admin)
router.post("/", requireRole("manager", "admin"), async (req, res) => {
    try {
        const { product_id, supplier_id, quantity } = req.body;

        if (!product_id || !supplier_id || !quantity) {
            return res.status(400).json({ message: "Product, supplier, and quantity are required" });
        }

        const numQty = parseInt(quantity);
        if (isNaN(numQty) || numQty <= 0) {
            return res.status(400).json({ message: "Order quantity must be a positive integer" });
        }

        const product = await Product.findById(product_id);
        if (!product) return res.status(404).json({ message: "Product not found" });

        const supplier = await Supplier.findById(supplier_id);
        if (!supplier) return res.status(404).json({ message: "Supplier not found" });

        const po = new PurchaseOrder({
            product_id,
            supplier_id,
            quantity: numQty,
            status: "pending",
            created_by: req.session.user.id,
            created_at: new Date()
        });

        const saved = await po.save();
        const populated = await PurchaseOrder.findById(saved._id)
            .populate("product_id", "name sku category")
            .populate("supplier_id", "name")
            .populate("created_by", "username fullName");

        if (req.app.get("io")) {
            req.app.get("io").emit("po_created", populated);
        }

        res.status(201).json({ message: "Purchase order created successfully", purchaseOrder: populated });
    } catch (err) {
        console.error("Create PO error:", err);
        res.status(500).json({ message: "Error creating purchase order" });
    }
});

// Mark Purchase Order as Received (manager, admin)
router.post("/:id/receive", requireRole("manager", "admin"), async (req, res) => {
    try {
        const po = await PurchaseOrder.findById(req.params.id);
        if (!po) return res.status(404).json({ message: "Purchase order not found" });

        if (po.status !== "pending") {
            return res.status(400).json({ message: `Purchase order is already ${po.status}` });
        }

        const product = await Product.findById(po.product_id);
        if (!product) return res.status(404).json({ message: "Ordered product does not exist" });

        const supplier = await Supplier.findById(po.supplier_id);

        po.status = "received";
        po.received_at = new Date();
        await po.save();

        const newStock = product.quantity + po.quantity;
        product.quantity = newStock;
        await product.save();

        const supplierName = supplier ? supplier.name : "Supplier";
        const movement = new StockMovement({
            product_id: product._id,
            change: po.quantity,
            reason: "purchase_order",
            note: `PO received from ${supplierName} (${po.quantity} units)`,
            user_id: req.session.user.id,
            stock_after: newStock,
            created_at: new Date()
        });
        await movement.save();

        const populatedPO = await PurchaseOrder.findById(po._id)
            .populate("product_id", "name sku category")
            .populate("supplier_id", "name")
            .populate("created_by", "username fullName");

        if (req.app.get("io")) {
            req.app.get("io").emit("stock_changed", {
                product: product,
                movement: movement,
                updatedBy: req.session.user.fullName || req.session.user.username
            });
            req.app.get("io").emit("po_updated", populatedPO);
        }

        res.json({
            message: `Purchase order marked as received! +${po.quantity} units added to ${product.name}.`,
            purchaseOrder: populatedPO,
            product: product
        });
    } catch (err) {
        console.error("Receive PO error:", err);
        res.status(500).json({ message: "Error receiving purchase order: " + err.message });
    }
});

// Cancel a pending purchase order (manager, admin)
router.post("/:id/cancel", requireRole("manager", "admin"), async (req, res) => {
    try {
        const po = await PurchaseOrder.findById(req.params.id);
        if (!po) return res.status(404).json({ message: "Purchase order not found" });
        if (po.status !== "pending") return res.status(400).json({ message: `Cannot cancel an order that is ${po.status}` });

        po.status = "cancelled";
        await po.save();
        res.json({ message: "Purchase order cancelled", purchaseOrder: po });
    } catch (err) {
        res.status(500).json({ message: "Error cancelling purchase order" });
    }
});

module.exports = router;
