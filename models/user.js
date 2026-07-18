const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'store_manager', 'customer', 'rider', 'picker'],
        default: 'customer'
    },
    riderProfile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Rider'
    },
    storeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date
    },
    refreshToken: {
        type: String
    }
}, { timestamps: true });

// ✅ CORRECT: Async/Await without `next`
userSchema.pre('save', async function() {
    // Only hash if password is modified
    if (!this.isModified('password')) return;
    
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// ✅ Compare password method (unchanged)
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);