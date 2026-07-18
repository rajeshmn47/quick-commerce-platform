const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    unit: {
        type: String,
        enum: ['piece', 'kg', 'g', 'ml', 'L', 'box', 'pack'],
        default: 'piece'
    },
    barcode: {
        type: String,
        unique: true,
        sparse: true
    },
    image_url: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);