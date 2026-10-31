// routes/authRoutes.js
// This file handles Authentication routes (Login and Account Initialization).
// In MVC architecture, this acts as the Controller/Router layer for user accounts.

const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Route 1: POST /api/auth/init
// Automatically seeds default demo users if database is empty.
// This allows you to test login immediately without manual DB entry.
router.post("/init", async (req, res) => {
    try {
        const count = await User.countDocuments();
        if (count === 0) {
            await User.create([
                {
                    username: "admin",
                    password: "admin123",
                    role: "admin",
                    fullName: "System Admin"
                },
                {
                    username: "staff",
                    password: "staff123",
                    role: "staff",
                    fullName: "Inventory Staff"
                }
            ]);
            return res.json({ message: "Default users initialized (admin/admin123, staff/staff123)" });
        }
        res.json({ message: "Users already initialized" });
    } catch (error) {
        res.status(500).json({ message: "Error initializing users", error: error.message });
    }
});

// Route 2: POST /api/auth/login
// Validates username and password against MongoDB collection.
// Matches Module 5 (Slide 16-17) of syllabus.
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if both fields are provided
        if (!username || !password) {
            return res.status(400).json({ message: "Please provide both username and password" });
        }

        // Find user by username in MongoDB
        const user = await User.findOne({ username: username });

        // If user not found or password doesn't match
        if (!user || user.password !== password) {
            // 401 = Unauthorized (taught in Module 5 Slide 22)
            return res.status(401).json({ message: "Invalid username or password" });
        }

        // Login successful: return user details (excluding password)
        res.json({
            message: "Login successful",
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                fullName: user.fullName
            }
        });
    } catch (error) {
        // 500 = Internal Server Error
        res.status(500).json({ message: "Server error during login", error: error.message });
    }
});

module.exports = router;

