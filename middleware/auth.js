const jwt = require('jsonwebtoken');
const User = require('../models/user');

// ==================== VERIFY TOKEN ====================
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Authentication required. Please provide a valid token.' 
            });
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(
            token, 
            process.env.JWT_SECRET || 'your_jwt_secret_key'
        );

        // Check if user exists
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        if (!user.isActive) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        // Attach user to request
        req.userId = decoded.userId;
        req.user = user;
        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        console.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'Authentication error' });
    }
};

// ==================== CHECK ROLE ====================
const checkRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
            });
        }

        next();
    };
};

// ==================== CHECK IF RIDER ====================
const isRider = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).populate('riderProfile');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.role !== 'rider' || !user.riderProfile) {
            return res.status(403).json({ error: 'Access denied. Rider profile required.' });
        }

        req.rider = user.riderProfile;
        next();
    } catch (error) {
        console.error('Rider check error:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { verifyToken, checkRole, isRider };