// models/User.js
// This file defines the Mongoose Schema and Model for Users.
// Used for Authentication and Role-Based Access Control (Admin vs Staff).

const mongoose = require("mongoose");

// Step 1: Define User Schema
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ["admin", "staff"],
        default: "staff"
    },
    fullName: {
        type: String,
        default: ""
    }
});

// Step 2: Create User Model
const User = mongoose.model("User", userSchema);

// Step 3: Export Model
module.exports = User;

