const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const { requireAuth } = require("../middleware/auth");

/**
 * GET /api/stats
 * Returns 4 KPI card totals + chart aggregation data
 */
router.get("/stats", requireAuth, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const products = await Product.find();

        const totalProducts = products.length;
        const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
        const lowStockCount = products.filter(p => p.quantity <= (p.reorder_level || p.minStock || 5)).length;
        const outOfStockCount = products.filter(p => p.quantity === 0).length;
        const totalValue = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);

        // 1. Category Value and Units breakdown
        const categoryMap = {};
        products.forEach(p => {
            const cat = p.category || "Other";
            if (!categoryMap[cat]) {
                categoryMap[cat] = { category: cat, value: 0, units: 0, count: 0 };
            }
            categoryMap[cat].value += (p.price * p.quantity);
            categoryMap[cat].units += p.quantity;
            categoryMap[cat].count += 1;
        });
        const categoryStats = Object.values(categoryMap);

        // 2. In vs Out movements over 7 or 30 days
        const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const movements = await StockMovement.find({ created_at: { $gte: sinceDate } })
            .sort({ created_at: 1 });

        // Aggregate by day
        const dayMap = {};
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            const dateStr = d.toISOString().split("T")[0];
            dayMap[dateStr] = { date: dateStr, in: 0, out: 0 };
        }

        movements.forEach(m => {
            const dateStr = m.created_at.toISOString().split("T")[0];
            if (dayMap[dateStr]) {
                if (m.change > 0) {
                    dayMap[dateStr].in += m.change;
                } else {
                    dayMap[dateStr].out += Math.abs(m.change);
                }
            }
        });
        const timeline = Object.values(dayMap);

        // 3. Top 5 Most-Moved Products
        const productMovementMap = {};
        movements.forEach(m => {
            const pId = m.product_id.toString();
            if (!productMovementMap[pId]) {
                productMovementMap[pId] = 0;
            }
            productMovementMap[pId] += Math.abs(m.change);
        });

        const topMovedPairs = Object.entries(productMovementMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const top5Products = [];
        for (const [pId, units] of topMovedPairs) {
            const prod = products.find(p => p._id.toString() === pId);
            if (prod) {
                top5Products.push({
                    id: prod._id,
                    name: prod.name,
                    sku: prod.sku,
                    category: prod.category,
                    unitsMoved: units
                });
            }
        }

        res.json({
            cards: {
                totalProducts,
                totalQuantity,
                lowStockCount,
                outOfStockCount,
                totalValue
            },
            charts: {
                categoryStats,
                timeline,
                top5Products
            }
        });
    } catch (err) {
        console.error("Stats API error:", err);
        res.status(500).json({ message: "Error calculating stats" });
    }
});

/**
 * GET /api/movements/recent
 * Returns last 15 movements for the Recent Activity feed
 */
router.get("/movements/recent", requireAuth, async (req, res) => {
    try {
        const recent = await StockMovement.find()
            .populate("product_id", "name sku category price")
            .populate("user_id", "username fullName role")
            .sort({ created_at: -1 })
            .limit(15);
        res.json(recent);
    } catch (err) {
        res.status(500).json({ message: "Error fetching recent movements" });
    }
});

module.exports = router;

