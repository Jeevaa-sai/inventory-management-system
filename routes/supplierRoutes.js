const express = require("express");
const router = express.Router();
const Supplier = require("../models/Supplier");
const { requireAuth, requireRole } = require("../middleware/auth");

// List all suppliers (staff, manager, admin)
router.get("/", requireAuth, async (req, res) => {
    try {
        const suppliers = await Supplier.find().sort({ name: 1 });
        res.json(suppliers);
    } catch (err) {
        res.status(500).json({ message: "Error fetching suppliers" });
    }
});

// Create supplier (manager, admin)
router.post("/", requireRole("manager", "admin"), async (req, res) => {
    try {
        const { name, contact_person, phone, email } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Supplier name is required" });
        }

        const supplier = new Supplier({
            name: name.trim(),
            contact_person: (contact_person || "").trim(),
            phone: (phone || "").trim(),
            email: (email || "").trim()
        });

        const saved = await supplier.save();
        res.status(201).json({ message: "Supplier created successfully", supplier: saved });
    } catch (err) {
        res.status(500).json({ message: "Error creating supplier" });
    }
});

// Update supplier (manager, admin)
router.put("/:id", requireRole("manager", "admin"), async (req, res) => {
    try {
        const { name, contact_person, phone, email } = req.body;
        const supplier = await Supplier.findById(req.params.id);
        if (!supplier) {
            return res.status(404).json({ message: "Supplier not found" });
        }

        if (name) supplier.name = name.trim();
        if (contact_person !== undefined) supplier.contact_person = contact_person.trim();
        if (phone !== undefined) supplier.phone = phone.trim();
        if (email !== undefined) supplier.email = email.trim();

        const updated = await supplier.save();
        res.json({ message: "Supplier updated successfully", supplier: updated });
    } catch (err) {
        res.status(500).json({ message: "Error updating supplier" });
    }
});

// Delete supplier (admin only)
router.delete("/:id", requireRole("admin"), async (req, res) => {
    try {
        const deleted = await Supplier.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: "Supplier not found" });
        }
        res.json({ message: "Supplier deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting supplier" });
    }
});

module.exports = router;

