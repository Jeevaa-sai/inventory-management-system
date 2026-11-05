const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { requireRole } = require("../middleware/auth");

// Admin only: List all users
router.get("/", requireRole("admin"), async (req, res) => {
    try {
        const users = await User.find().select("-password").sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: "Error fetching users" });
    }
});

// Admin only: Create a new user
router.post("/", requireRole("admin"), async (req, res) => {
    try {
        const { username, password, role = "staff", fullName = "" } = req.body;

        if (!username || !username.trim()) {
            return res.status(400).json({ message: "Username is required" });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }
        if (!["admin", "manager", "staff"].includes(role)) {
            return res.status(400).json({ message: "Invalid role. Must be admin, manager, or staff" });
        }

        const cleanUsername = username.trim().toLowerCase();
        const existing = await User.findOne({ username: cleanUsername });
        if (existing) {
            return res.status(400).json({ message: `Username '${cleanUsername}' is already taken` });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username: cleanUsername,
            password: hashedPassword,
            role,
            fullName: fullName.trim(),
            active: true
        });

        await newUser.save();

        res.status(201).json({
            message: "User created successfully",
            user: {
                id: newUser._id,
                username: newUser.username,
                role: newUser.role,
                fullName: newUser.fullName,
                active: newUser.active
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Error creating user: " + err.message });
    }
});

// Admin only: Update user role, full name, or active status
router.put("/:id", requireRole("admin"), async (req, res) => {
    try {
        const { role, fullName, active } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Prevent self-demotion or self-deactivation
        if (req.session.user.id === user._id.toString()) {
            if (active === false) return res.status(400).json({ message: "Cannot deactivate your own admin account" });
            if (role && role !== "admin") return res.status(400).json({ message: "Cannot change your own role away from admin" });
        }

        if (role && ["admin", "manager", "staff"].includes(role)) user.role = role;
        if (fullName !== undefined) user.fullName = fullName.trim();
        if (active !== undefined) user.active = Boolean(active);

        await user.save();

        res.json({
            message: "User updated successfully",
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                fullName: user.fullName,
                active: user.active
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Error updating user" });
    }
});

// Admin only: Reset user password
router.post("/:id/reset-password", requireRole("admin"), async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: "New password must be at least 6 characters" });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: `Password reset successfully for ${user.username}` });
    } catch (err) {
        res.status(500).json({ message: "Error resetting password" });
    }
});

// Admin only: Delete user
router.delete("/:id", requireRole("admin"), async (req, res) => {
    try {
        if (req.session.user.id === req.params.id) {
            return res.status(400).json({ message: "Cannot delete your own admin account" });
        }
        const deleted = await User.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "User not found" });
        res.json({ message: "User deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting user" });
    }
});

module.exports = router;

