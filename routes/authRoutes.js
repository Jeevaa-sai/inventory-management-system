const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { getOrCreateCsrfToken } = require("../middleware/auth");

// Initializer: Seeds default accounts if none exist
router.post("/init", async (req, res) => {
    try {
        const count = await User.countDocuments();
        if (count === 0) {
            const adminPass = await bcrypt.hash("admin123", 10);
            const managerPass = await bcrypt.hash("manager123", 10);
            const staffPass = await bcrypt.hash("staff123", 10);

            await User.create([
                { username: "admin", password: adminPass, role: "admin", fullName: "Administrator" },
                { username: "manager", password: managerPass, role: "manager", fullName: "Store Manager" },
                { username: "staff", password: staffPass, role: "staff", fullName: "Floor Staff" }
            ]);
            return res.json({ message: "Default accounts initialized" });
        }
        res.json({ message: "Accounts exist" });
    } catch (err) {
        console.error("Init error:", err);
        res.status(500).json({ message: "Error initializing accounts" });
    }
});

// Login endpoint
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required" });
        }

        const user = await User.findOne({ username: username.trim() });
        if (!user || !user.active) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        let isMatch = false;
        // Check hashed password or migrate legacy plain text
        if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$")) {
            isMatch = await bcrypt.compare(password, user.password);
        } else if (user.password === password) {
            isMatch = true;
            user.password = await bcrypt.hash(password, 10);
            await user.save();
        }

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        // Establish server session
        const sessionUser = {
            id: user._id.toString(),
            username: user.username,
            role: user.role,
            fullName: user.fullName || user.username
        };
        req.session.user = sessionUser;
        const csrfToken = getOrCreateCsrfToken(req);

        res.json({
            message: "Login successful",
            user: sessionUser,
            csrfToken: csrfToken
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Server error during login" });
    }
});

// Get current session info & CSRF token
router.get("/me", (req, res) => {
    if (req.session && req.session.user) {
        const csrfToken = getOrCreateCsrfToken(req);
        return res.json({
            user: req.session.user,
            csrfToken: csrfToken
        });
    }
    res.status(401).json({ message: "Not authenticated" });
});

// Get or refresh CSRF token
router.get("/csrf", (req, res) => {
    const csrfToken = getOrCreateCsrfToken(req);
    res.json({ csrfToken });
});

// Logout endpoint: destroys session
router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: "Logout failed" });
        }
        res.clearCookie("inventory.sid");
        res.json({ message: "Logged out successfully" });
    });
});

module.exports = router;
