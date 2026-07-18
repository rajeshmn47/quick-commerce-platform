const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/zepto')
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routes/authRoutes');
const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const riderRoutes = require('./routes/riderRoutes');

// Import middleware
const { verifyToken, checkRole } = require('./middleware/auth');

// Public routes (no auth required)
app.use('/api/auth', authRoutes);

// 🔐 Protected routes (auth required)
app.use('/api/stores', verifyToken, storeRoutes);
app.use('/api/products', verifyToken, productRoutes);
app.use('/api/inventory', verifyToken, inventoryRoutes);
app.use('/api/orders', verifyToken, orderRoutes);

// Admin-only route example
app.get('/api/admin/dashboard', verifyToken, checkRole('admin'), (req, res) => {
    res.json({ message: 'Welcome Admin!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});