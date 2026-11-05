const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema({
    product_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    change: {
        type: Number,
        required: true
    },
    reason: {
        type: String,
        enum: ["sold", "damaged", "returned", "restock", "correction", "purchase_order"],
        required: true
    },
    note: {
        type: String,
        default: ""
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    stock_after: {
        type: Number,
        required: true,
        min: 0
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("StockMovement", stockMovementSchema);

