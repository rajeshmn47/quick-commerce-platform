const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],      // 👈 Must be 'Point'
            default: 'Point'
        },
        coordinates: {
            type: [Number],       // 👈 Must be [longitude, latitude]
            required: true,
            index: '2dsphere'     // 👈 Creates geospatial index
        }
    },
    description: {
        type: String,
        default: ''
    },
    operating_hours: {
        type: String,
        default: '9:00 AM - 11:00 PM'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// ✅ Ensure 2dsphere index is created
storeSchema.index({ location: '2dsphere' });

const Store = mongoose.model('Store', storeSchema);
module.exports = Store;