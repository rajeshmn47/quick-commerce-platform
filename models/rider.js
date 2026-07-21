const mongoose = require('mongoose');

const riderSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    vehicle: {
        type: String,
        enum: ['bike', 'scooter', 'cycle', 'car'],
        default: 'bike'
    },
    vehicleNumber: {
        type: String,
        trim: true,
        uppercase: true
    },
    // Current location (for geo queries)
    currentLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            latitude: {
                type: Number,
                default: 0
            },
            longitude: {
                type: Number,
                default: 0
            }
        }
    },
    // Store where rider is currently checked in
    currentStoreId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store'
    },
    // Check-in timestamp
    checkedInAt: {
        type: Date
    },
    // Availability
    isAvailable: {
        type: Boolean,
        default: true
    },
    // Active orders count
    activeOrdersCount: {
        type: Number,
        default: 0
    },
    // Max concurrent orders (configurable per rider)
    maxConcurrentOrders: {
        type: Number,
        default: 2
    },
    // Performance stats
    totalDeliveries: {
        type: Number,
        default: 0
    },
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    // Total earnings (optional)
    totalEarnings: {
        type: Number,
        default: 0
    },
    // Bank details (optional)
    bankAccount: {
        accountNumber: String,
        ifscCode: String,
        accountHolder: String
    }
}, { timestamps: true });

// Indexes for performance
riderSchema.index({ currentStoreId: 1, isAvailable: 1 });
riderSchema.index({ currentLocation: '2dsphere' });

const Rider = mongoose.model('Rider', riderSchema);
module.exports = Rider;