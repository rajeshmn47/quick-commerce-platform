const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    address: { type: String, required: true },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
    }],
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
        type: String,
        enum: ['pending', 'picking', 'dispatched', 'delivered'],
        default: 'pending'
    },
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider' },
    pickerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;