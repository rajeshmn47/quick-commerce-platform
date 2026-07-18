const User = require('../models/user');
const Rider = require('../models/rider');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ==================== GENERATE JWT ====================
const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'your_jwt_secret_key',
        { expiresIn: '7d' }
    );
};

// ==================== REGISTER ====================
exports.register = async (req, res) => {
    try {
        const { name, email, phone, password, role, riderData } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { phone }] 
        });

        if (existingUser) {
            return res.status(400).json({
                error: 'User with this email or phone already exists'
            });
        }

        // Create user
        const user = new User({
            name,
            email,
            phone,
            password,
            role: role || 'customer'
        });

        // If registering as rider, create rider profile
        if (role === 'rider' && riderData) {
            const rider = new Rider({
                name: riderData.name || name,
                phone: riderData.phone || phone,
                vehicle: riderData.vehicle || 'bike',
                vehicleNumber: riderData.vehicleNumber || '',
                maxConcurrentOrders: riderData.maxConcurrentOrders || 2
            });
            await rider.save();
            user.riderProfile = rider._id;
        }

        await user.save();

        // Generate token
        const token = generateToken(user._id);

        // Return user without password
        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.refreshToken;

        res.status(201).json({
            success: true,
            message: 'Registration successful!',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== LOGIN ====================
exports.login = async (req, res) => {
    try {
        const { email, phone, password } = req.body;

        // Find user by email or phone
        const user = await User.findOne({
            $or: [{ email }, { phone }]
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        // Return user without password
        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.refreshToken;

        // Populate riderProfile if rider
        if (user.role === 'rider' && user.riderProfile) {
            await userResponse.populate('riderProfile');
        }

        res.json({
            success: true,
            message: 'Login successful!',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== GET CURRENT USER ====================
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .populate('riderProfile')
            .populate('storeId', 'name address');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.refreshToken;

        res.json({
            success: true,
            user: userResponse
        });

    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== LOGOUT ====================
exports.logout = async (req, res) => {
    try {
        // Just send success - client will remove token
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== CHANGE PASSWORD ====================
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== FORGOT PASSWORD ====================
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate reset token
        const resetToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your_jwt_secret_key',
            { expiresIn: '1h' }
        );

        // Save reset token (in production, save to database)
        // Send email with reset link (implement later)

        res.json({
            success: true,
            message: 'Password reset link sent to your email',
            resetToken // In production, don't send this in response
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== UPDATE PROFILE ====================
exports.updateProfile = async (req, res) => {
    try {
        const { name, phone, email } = req.body;

        const updates = {};
        if (name) updates.name = name;
        if (phone) updates.phone = phone;
        if (email) updates.email = email;

        const user = await User.findByIdAndUpdate(
            req.userId,
            updates,
            { returnDocument: 'after', runValidators: true }
        ).populate('riderProfile');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.refreshToken;

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: userResponse
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: error.message });
    }
};