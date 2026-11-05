const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    sku: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    reorder_level: {
        type: Number,
        default: 5,
        min: 0
    },
    minStock: {
        type: Number,
        default: 5,
        min: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Keep minStock and reorder_level in sync for backward compatibility
productSchema.pre("save", function () {
    if (this.reorder_level !== undefined && (this.minStock === undefined || this.minStock === null)) {
        this.minStock = this.reorder_level;
    } else if (this.minStock !== undefined && (this.reorder_level === undefined || this.reorder_level === null)) {
        this.reorder_level = this.minStock;
    }
});

module.exports = mongoose.model("Product", productSchema);
