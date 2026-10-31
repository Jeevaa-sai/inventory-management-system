// models/Product.js
// This file defines the Mongoose Schema and Model for Products.
// In MVC architecture, the "Model" represents the structure of our database collection.

const mongoose = require("mongoose");

// Step 1: Define the Schema
// A Schema maps directly to a MongoDB collection and defines the shape of the documents.
const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    minStock: {
        type: Number,
        default: 5 // Default threshold for low stock alert
    }
});

// Step 2: Create the Model
// The model provides the interface to query and update the 'products' collection in MongoDB.
const Product = mongoose.model("Product", productSchema);

// Step 3: Export the model to use in route handlers
module.exports = Product;
