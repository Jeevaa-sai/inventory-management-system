const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.post("/init", async (req, res) => {
    try {
        const count = await User.countDocuments();
        if (count === 0) {
            await User.create([
                { username: "admin", password: "admin123", role: "admin", fullName: "Admin User" },
                { username: "staff", password: "staff123", role: "staff", fullName: "Staff User" }
            ]);
            return res.json({ message: "Default accounts created" });
        }
        res.json({ message: "Accounts exist" });
    } catch (err) {
        res.status(500).json({ message: "Error initializing accounts" });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Please enter both username and password" });
        }

        const user = await User.findOne({ username: username });

        if (!user || user.password !== password) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        res.json({
            message: "Login successful",
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                fullName: user.fullName
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error during login" });
    }
});

module.exports = router;
