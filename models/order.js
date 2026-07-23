const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // === STORE & CUSTOMER ===
    storeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    customerName: {
        type: String,
        required: true
    },
    customerPhone: {
        type: String,
        required: true
    },
    customerEmail: {
        type: String,
        lowercase: true
    },

    // === DELIVERY LOCATION ===
    address: {
        type: String,
        required: true,
        trim: true
    },
    landmark: {
        type: String,
        trim: true
    },
    customerLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true,
            index: '2dsphere'
        }
    },
    customerPincode: {
        type: String,
        trim: true
    },
    deliveryInstructions: {
        type: String,
        default: ''
    },

    // === ORDER ITEMS ===
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    deliveryFee: {
        type: Number,
        default: 0
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true,
        min: 0
    },

    // === STATUS & TIMELINE ===
    status: {
        type: String,
        enum: ['pending', 'accepted', 'picking', 'dispatched', 'delivered', 'cancelled'],
        default: 'pending'
    },
    assignedAt: {
        type: Date
    },
    pickedAt: {
        type: Date
    },
    dispatchedAt: {
        type: Date
    },
    deliveredAt: {
        type: Date
    },
    cancelledAt: {
        type: Date
    },
    cancellationReason: {
        type: String,
        default: ''
    },
    estimatedDeliveryTime: {
        type: Date
    },

    // === ASSIGNED PERSONNEL ===
    riderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Rider'
    },
    riderName: {
        type: String
    },
    riderPhone: {
        type: String
    },
    pickerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // === PAYMENT ===
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['card', 'upi', 'cod', 'wallet'],
        default: 'cod'
    },
    paymentId: {
        type: String
    },
    paymentDetails: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // === RATING & FEEDBACK ===
    customerRating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    customerFeedback: {
        type: String,
        default: ''
    },
    riderRating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },

    // === SYSTEM FIELDS ===
    zoneId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Zone'
    },
    source: {
        type: String,
        enum: ['web', 'ios', 'android'],
        default: 'web'
    },
    orderSource: {
        type: String,
        enum: ['customer', 'admin', 'store'],
        default: 'customer'
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date
    }

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// === INDEXES FOR PERFORMANCE ===
orderSchema.index({ storeId: 1, status: 1 });
orderSchema.index({ customerPhone: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ riderId: 1, status: 1 });
orderSchema.index({ estimatedDeliveryTime: 1 });
orderSchema.index({ customerLocation: '2dsphere' });

// === VIRTUAL FIELDS ===
orderSchema.virtual('isOverdue').get(function() {
    if (!this.estimatedDeliveryTime) return false;
    return new Date() > this.estimatedDeliveryTime && this.status !== 'delivered';
});

orderSchema.virtual('deliveryTimeInMinutes').get(function() {
    if (!this.createdAt || !this.deliveredAt) return null;
    return (this.deliveredAt - this.createdAt) / 60000;
});

module.exports = mongoose.model('Order', orderSchema);