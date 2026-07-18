const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, checkRole, isRider } = require('../middleware/auth');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);

// Protected routes
router.get('/me', verifyToken, authController.getMe);
router.post('/logout', verifyToken, authController.logout);
router.put('/change-password', verifyToken, authController.changePassword);
router.put('/profile', verifyToken, authController.updateProfile);

// Admin only routes
router.get('/admin/users', verifyToken, checkRole('admin'), async (req, res) => {
    try {
        const users = await User.find()
            .select('-password -refreshToken')
            .populate('riderProfile', 'name phone vehicle')
            .populate('storeId', 'name address');
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// User management (admin only)
router.put('/admin/users/:id', verifyToken, checkRole('admin'), async (req, res) => {
    try {
        const { role, isActive } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role, isActive },
            { returnDocument: 'after' }
        ).select('-password -refreshToken');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ success: true, message: 'User updated', data: user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;