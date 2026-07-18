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
        },
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    description: String,
}, { timestamps: true });

module.exports = mongoose.model('Store', storeSchema);