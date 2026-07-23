const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    boundary: {
        type: {
            type: String,
            enum: ['Polygon'],
            default: 'Polygon'
        },
        coordinates: {
            type: [[[Number]]],  // GeoJSON Polygon
            required: true
        }
    },
    storeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: true
    },
    deliveryFee: {
        type: Number,
        default: 0
    },
    freeDeliveryThreshold: {
        type: Number,
        default: 0
    },
    estimatedDeliveryTime: {
        type: Number,
        default: 15
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

zoneSchema.index({ boundary: '2dsphere' });

const Zone = mongoose.model('Zone', zoneSchema);
module.exports = Zone;