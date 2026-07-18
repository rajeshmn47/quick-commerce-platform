const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    store_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: true
    },
    product_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    stock_quantity: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    low_stock_threshold: {
        type: Number,
        default: 10
    },
    reorder_point: {
        type: Number,
        default: 5
    }
}, { timestamps: true });

// Compound unique index to prevent duplicate product-store entries
inventorySchema.index({ store_id: 1, product_id: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', inventorySchema);