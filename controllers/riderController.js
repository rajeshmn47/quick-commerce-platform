const Rider = require('../models/rider');
const Order = require('../models/order');
const Store = require('../models/store');
const User = require('../models/user');
const { assignPendingOrderToRider } = require('../services/riderAssignment');

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate distance between two coordinates in km (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Check if a rider can accept more orders
 */
function canAcceptMoreOrders(rider) {
    return rider.isAvailable && rider.activeOrdersCount < rider.maxConcurrentOrders;
}

// ==================== ADMIN CRUD OPERATIONS ====================

/**
 * GET /api/riders
 * Get all riders (Admin only)
 */
exports.getAllRiders = async (req, res) => {
    try {
        const riders = await Rider.find()
            .populate('currentStoreId', 'name address')
            .sort({ name: 1 });

        res.json({
            success: true,
            count: riders.length,
            data: riders
        });
    } catch (error) {
        console.error('Get all riders error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/riders/:id
 * Get a single rider by ID (Admin only)
 */
exports.getRider = async (req, res) => {
    try {
        const rider = await Rider.findById(req.params.id)
            .populate('currentStoreId', 'name address');

        if (!rider) {
            return res.status(404).json({ error: 'Rider not found' });
        }

        res.json({
            success: true,
            data: rider
        });
    } catch (error) {
        console.error('Get rider error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/riders
 * Create a new rider (Admin only)
 */
exports.createRider = async (req, res) => {
    try {
        const {
            name,
            phone,
            email,
            vehicle,
            vehicleNumber,
            maxConcurrentOrders,
            bankAccount
        } = req.body;

        // Check if rider with same phone exists
        const existingRider = await Rider.findOne({ phone });
        if (existingRider) {
            return res.status(400).json({ error: 'Rider with this phone already exists' });
        }

        const rider = new Rider({
            name,
            phone,
            email,
            vehicle: vehicle || 'bike',
            vehicleNumber: vehicleNumber || '',
            maxConcurrentOrders: maxConcurrentOrders || 2,
            isAvailable: false,
            activeOrdersCount: 0,
            totalDeliveries: 0,
            rating: 0,
            totalEarnings: 0,
            bankAccount: bankAccount || {}
        });

        await rider.save();

        res.status(201).json({
            success: true,
            message: 'Rider created successfully',
            data: rider
        });
    } catch (error) {
        console.error('Create rider error:', error);
        res.status(400).json({ error: error.message });
    }
};

/**
 * PUT /api/riders/:id
 * Update a rider (Admin only)
 */
exports.updateRider = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const rider = await Rider.findByIdAndUpdate(
            id,
            updates,
            {
                returnDocument: 'after',
                runValidators: true
            }
        );

        if (!rider) {
            return res.status(404).json({ error: 'Rider not found' });
        }

        res.json({
            success: true,
            message: 'Rider updated successfully',
            data: rider
        });
    } catch (error) {
        console.error('Update rider error:', error);
        res.status(400).json({ error: error.message });
    }
};

/**
 * DELETE /api/riders/:id
 * Delete a rider (Admin only)
 */
exports.deleteRider = async (req, res) => {
    try {
        const { id } = req.params;

        const rider = await Rider.findByIdAndDelete(id);
        if (!rider) {
            return res.status(404).json({ error: 'Rider not found' });
        }

        // Also remove rider reference from User if exists
        await User.updateOne(
            { riderProfile: id },
            { $unset: { riderProfile: 1 } }
        );

        res.json({
            success: true,
            message: 'Rider deleted successfully'
        });
    } catch (error) {
        console.error('Delete rider error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== RIDER APP ENDPOINTS ====================

/**
 * GET /api/riders/:riderId/status
 * Get rider status with active orders
 */
exports.getRiderStatus = async (req, res) => {
    try {
        const { riderId } = req.params;

        const rider = await Rider.findById(riderId)
            .populate('currentStoreId', 'name address');

        if (!rider) {
            return res.status(404).json({ error: 'Rider not found' });
        }

        // Get active orders (picking or dispatched)
        const activeOrders = await Order.find({
            riderId: riderId,
            status: { $in: ['picking', 'dispatched'] }
        })
            .populate('items.productId', 'name price unit image_url')
            .sort({ createdAt: -1 });

        // Get today's completed deliveries
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayDeliveries = await Order.countDocuments({
            riderId: riderId,
            status: 'delivered',
            deliveredAt: { $gte: today, $lt: tomorrow }
        });

        res.json({
            success: true,
            data: {
                rider: {
                    _id: rider._id,
                    name: rider.name,
                    phone: rider.phone,
                    vehicle: rider.vehicle,
                    vehicleNumber: rider.vehicleNumber,
                    isAvailable: rider.isAvailable,
                    activeOrdersCount: rider.activeOrdersCount,
                    maxConcurrentOrders: rider.maxConcurrentOrders,
                    totalDeliveries: rider.totalDeliveries,
                    rating: rider.rating,
                    totalEarnings: rider.totalEarnings,
                    currentStoreId: rider.currentStoreId,
                    checkedInAt: rider.checkedInAt,
                    checkedInViaQR: rider.checkedInViaQR || false,
                },
                activeOrders,
                todayDeliveries,
                isCheckedIn: !!rider.currentStoreId,
                canAcceptOrders: canAcceptMoreOrders(rider),
                status: rider.isAvailable ? 'available' : 'busy'
            }
        });
    } catch (error) {
        console.error('Get rider status error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * PUT /api/riders/:riderId/location
 * Update rider's live GPS location
 */
exports.updateLocation = async (req, res) => {
    try {
        const { riderId } = req.params;
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'latitude and longitude are required' });
        }

        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        const rider = await Rider.findByIdAndUpdate(
            riderId,
            {
                currentLocation: {
                    type: 'Point',
                    coordinates: {
                        latitude: parseFloat(latitude),
                        longitude: parseFloat(longitude)
                    }
                }
            },
            { returnDocument: 'after' }
        );

        if (!rider) {
            return res.status(404).json({ error: 'Rider not found' });
        }

        // Broadcast location via Socket.io if available
        // const io = req.app.get('io');
        // if (io) {
        //     io.to(`rider-${riderId}`).emit('location-update', {
        //         riderId,
        //         lat: parseFloat(latitude),
        //         lng: parseFloat(longitude),
        //         timestamp: new Date()
        //     });
        // }

        res.json({
            success: true,
            message: 'Location updated successfully',
            data: rider
        });
    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/riders/:riderId/checkin
 * Check-in rider at a store (GPS-based)
 */
exports.checkIn = async (req, res) => {
    try {
        const { riderId } = req.params;
        const { storeId, latitude, longitude } = req.body;

        if (!storeId || !latitude || !longitude) {
            return res.status(400).json({
                error: 'storeId, latitude, and longitude are required'
            });
        }

        // 1️⃣ Verify store exists
        const store = await Store.findById(storeId);
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }

        // 2️⃣ Verify store location
        const storeLat = store.location.coordinates[1];
        const storeLng = store.location.coordinates[0];

        if (!storeLat || !storeLng) {
            return res.status(400).json({
                error: 'Store location not configured. Contact admin.'
            });
        }

        // 3️⃣ Calculate distance (must be within 500 meters)
        const distance = calculateDistance(
            parseFloat(latitude),
            parseFloat(longitude),
            storeLat,
            storeLng
        );

        if (distance > 0.5) { // 500 meters
            return res.status(400).json({
                error: `You are ${Math.round(distance * 1000)}m away. Must be within 500m to check in.`
            });
        }

        // 4️⃣ Check if rider exists
        const rider = await Rider.findById(riderId);
        if (!rider) {
            return res.status(404).json({ error: 'Rider not found' });
        }

        // 5️⃣ Check if already checked in at this store
        if (rider.currentStoreId?.toString() === storeId && rider.isAvailable) {
            return res.status(400).json({
                error: 'You are already checked in at this store'
            });
        }

        // 6️⃣ Update rider
        rider.currentStoreId = storeId;
        rider.checkedInAt = new Date();
        rider.currentLocation = {
            type: 'Point',
            coordinates: {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude)
            }
        };
        rider.isAvailable = true;
        rider.checkedInViaQR = false;
        await rider.save();

        // 7️⃣ Auto-assign pending orders
        const assignedOrder = await assignPendingOrderToRider(rider);

        const populatedRider = await Rider.findById(riderId)
            .populate('currentStoreId', 'name address');

        res.json({
            success: true,
            message: assignedOrder
                ? '✅ Checked in and assigned a pending order!'
                : '✅ Checked in successfully!',
            data: {
                rider: populatedRider,
                assignedOrder: assignedOrder || null
            }
        });
    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/riders/:riderId/checkin-qr
 * Check-in rider via QR code scanning
 */
exports.checkInQR = async (req, res) => {
    try {
        const { riderId } = req.params;
        const { qrToken, latitude, longitude } = req.body;

        if (!qrToken) {
            return res.status(400).json({ error: 'QR token is required' });
        }

        // 1️⃣ Find store with this QR token
        const store = await Store.findOne({
            qrCode: qrToken,
            isActive: true,
            qrCodeExpiresAt: { $gt: new Date() }
        });

        if (!store) {
            return res.status(400).json({
                error: 'Invalid or expired QR code. Please contact store staff.'
            });
        }

        // 2️⃣ Verify rider exists
        const rider = await Rider.findById(riderId);
        if (!rider) {
            return res.status(404).json({ error: 'Rider not found' });
        }

        // 3️⃣ Update rider
        rider.currentStoreId = store._id;
        rider.checkedInAt = new Date();
        rider.isAvailable = true;
        rider.checkedInViaQR = true;

        // Update location if provided
        if (latitude && longitude) {
            rider.currentLocation = {
                type: 'Point',
                coordinates: {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude)
                }
            };
        }

        await rider.save();

        // 4️⃣ Auto-assign pending orders
        const assignedOrder = await assignPendingOrderToRider(rider);

        const populatedRider = await Rider.findById(riderId)
            .populate('currentStoreId', 'name address');

        res.json({
            success: true,
            message: assignedOrder
                ? '✅ QR check-in successful! Pending order assigned.'
                : '✅ QR check-in successful! You are now available for orders.',
            data: {
                rider: populatedRider,
                store: store.name,
                assignedOrder: assignedOrder || null
            }
        });
    } catch (error) {
        console.error('QR check-in error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/riders/:riderId/checkout
 * Check-out rider (make unavailable)
 */
exports.checkOut = async (req, res) => {
    try {
        const { riderId } = req.params;

        const rider = await Rider.findById(riderId);
        if (!rider) {
            return res.status(404).json({ error: 'Rider not found' });
        }

        // Check if rider has active orders
        const activeOrders = await Order.countDocuments({
            riderId: riderId,
            status: { $in: ['picking', 'dispatched'] }
        });

        if (activeOrders > 0) {
            return res.status(400).json({
                error: `You have ${activeOrders} active orders. Complete them before checking out.`
            });
        }

        rider.currentStoreId = null;
        rider.checkedInAt = null;
        rider.isAvailable = false;
        rider.checkedInViaQR = false;
        await rider.save();

        res.json({
            success: true,
            message: '✅ Checked out successfully',
            data: rider
        });
    } catch (error) {
        console.error('Check-out error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/riders/:riderId/orders
 * Get available (pending) orders at rider's store
 */
exports.getStoreOrders = async (req, res) => {
    try {
        const { riderId } = req.params;

        const rider = await Rider.findById(riderId);
        if (!rider) {
            return res.status(404).json({ error: 'Rider not found' });
        }

        if (!rider.currentStoreId) {
            return res.status(400).json({
                error: 'You are not checked in at any store. Please check in first.'
            });
        }

        if (!rider.isAvailable) {
            return res.status(400).json({
                error: 'You are currently busy. Complete your active orders first.'
            });
        }

        if (rider.activeOrdersCount >= rider.maxConcurrentOrders) {
            return res.status(400).json({
                error: `You have reached your maximum concurrent orders (${rider.maxConcurrentOrders})`
            });
        }

        const orders = await Order.find({
            storeId: rider.currentStoreId,
            status: 'pending',
            riderId: { $exists: false }
        })
            .populate('items.productId', 'name price unit image_url')
            .sort({ createdAt: 1 });

        res.json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (error) {
        console.error('Get store orders error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/riders/:riderId/accept-order
 * Rider accepts an order
 */
exports.acceptOrder = async (req, res) => {
    try {
        const { riderId } = req.params;
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ error: 'orderId is required' });
        }

        // 1️⃣ Get rider
        const rider = await Rider.findById(riderId);
        if (!rider) {
            return res.status(404).json({ error: 'Rider not found' });
        }

        // 2️⃣ Validate rider status
        if (!rider.currentStoreId) {
            return res.status(400).json({
                error: 'You are not checked in at any store'
            });
        }

        if (!rider.isAvailable) {
            return res.status(400).json({
                error: 'You are currently busy. Complete your active orders first.'
            });
        }

        if (rider.activeOrdersCount >= rider.maxConcurrentOrders) {
            return res.status(400).json({
                error: `You already have ${rider.activeOrdersCount} active orders. Max: ${rider.maxConcurrentOrders}`
            });
        }

        // 3️⃣ Get order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // 4️⃣ Validate order
        if (order.storeId.toString() !== rider.currentStoreId.toString()) {
            return res.status(400).json({
                error: 'This order is from a different store'
            });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({
                error: `Order is already ${order.status}`
            });
        }

        if (order.riderId) {
            return res.status(400).json({
                error: 'Order already assigned to another rider'
            });
        }

        // 5️⃣ Assign order
        order.riderId = rider._id;
        order.status = 'dispatched';
        order.assignedAt = new Date();
        await order.save();

        // 6️⃣ Update rider
        rider.activeOrdersCount += 1;
        if (rider.activeOrdersCount >= rider.maxConcurrentOrders) {
            rider.isAvailable = false;
        }
        await rider.save();

        // 7️⃣ Populate response
        const populatedOrder = await Order.findById(orderId)
            .populate('storeId', 'name address location')
            .populate('items.productId', 'name price unit image_url')
            .populate('riderId', 'name phone');

        res.json({
            success: true,
            message: '✅ Order accepted successfully!',
            data: {
                order: populatedOrder,
                rider: {
                    _id: rider._id,
                    name: rider.name,
                    activeOrdersCount: rider.activeOrdersCount,
                    maxConcurrentOrders: rider.maxConcurrentOrders,
                    isAvailable: rider.isAvailable
                }
            }
        });
    } catch (error) {
        console.error('Accept order error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/riders/:riderId/complete-delivery
 * Mark an order as delivered
 */
exports.completeDelivery = async (req, res) => {
    try {
        const { riderId } = req.params;
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ error: 'orderId is required' });
        }

        // 1️⃣ Get order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // 2️⃣ Verify rider owns this order
        if (order.riderId?.toString() !== riderId) {
            return res.status(403).json({
                error: 'This order is not assigned to you'
            });
        }

        if (order.status === 'delivered') {
            return res.status(400).json({ error: 'Order already delivered' });
        }

        if (order.status === 'cancelled') {
            return res.status(400).json({ error: 'Order has been cancelled' });
        }

        // 3️⃣ Mark as delivered
        order.status = 'delivered';
        order.deliveredAt = new Date();
        await order.save();

        // 4️⃣ Update rider
        const rider = await Rider.findById(riderId);
        if (rider) {
            rider.activeOrdersCount = Math.max(0, rider.activeOrdersCount - 1);
            rider.totalDeliveries += 1;
            rider.totalEarnings = (rider.totalEarnings || 0) + order.totalAmount * 0.1; // 10% commission (example)

            if (rider.activeOrdersCount < rider.maxConcurrentOrders) {
                rider.isAvailable = true;
            }
            await rider.save();
        }

        // 5️⃣ Try to assign a pending order to this rider
        let assignedPending = null;
        if (rider && rider.currentStoreId && rider.isAvailable) {
            assignedPending = await assignPendingOrderToRider(rider);
        }

        // 6️⃣ Populate response
        const populatedOrder = await Order.findById(orderId)
            .populate('storeId', 'name address')
            .populate('items.productId', 'name price unit')
            .populate('riderId', 'name phone');

        res.json({
            success: true,
            message: '✅ Delivery completed successfully!',
            data: {
                order: populatedOrder,
                rider: rider ? {
                    _id: rider._id,
                    name: rider.name,
                    activeOrdersCount: rider.activeOrdersCount,
                    totalDeliveries: rider.totalDeliveries,
                    totalEarnings: rider.totalEarnings,
                    isAvailable: rider.isAvailable
                } : null,
                pendingAssigned: assignedPending ? '✅ Pending order assigned' : 'No pending orders'
            }
        });
    } catch (error) {
        console.error('Complete delivery error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/riders/:riderId/earnings
 * Get rider's earnings summary
 */
exports.getRiderEarnings = async (req, res) => {
    try {
        const { riderId } = req.params;

        const rider = await Rider.findById(riderId);
        if (!rider) {
            return res.status(404).json({ error: 'Rider not found' });
        }

        // Get earnings breakdown
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const startOfWeek = new Date(today);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const startOfMonth = new Date(today);
        startOfMonth.setDate(1);

        const [todayEarnings, weekEarnings, monthEarnings] = await Promise.all([
            Order.aggregate([
                {
                    $match: {
                        riderId: rider._id,
                        status: 'delivered',
                        deliveredAt: { $gte: today, $lt: tomorrow }
                    }
                },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.aggregate([
                {
                    $match: {
                        riderId: rider._id,
                        status: 'delivered',
                        deliveredAt: { $gte: startOfWeek, $lt: tomorrow }
                    }
                },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.aggregate([
                {
                    $match: {
                        riderId: rider._id,
                        status: 'delivered',
                        deliveredAt: { $gte: startOfMonth, $lt: tomorrow }
                    }
                },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ])
        ]);

        res.json({
            success: true,
            data: {
                totalEarnings: rider.totalEarnings || 0,
                today: todayEarnings[0]?.total || 0,
                week: weekEarnings[0]?.total || 0,
                month: monthEarnings[0]?.total || 0,
                totalDeliveries: rider.totalDeliveries || 0,
                rating: rider.rating || 0
            }
        });
    } catch (error) {
        console.error('Get rider earnings error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/riders/:riderId/reject-order
 * Rider rejects an assigned order (reassigns to another rider)
 */
exports.rejectOrder = async (req, res) => {
    try {
        const { riderId } = req.params;
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ error: 'orderId is required' });
        }

        // 1️⃣ Get order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // 2️⃣ Verify rider owns this order
        if (order.riderId?.toString() !== riderId) {
            return res.status(403).json({
                error: 'This order is not assigned to you'
            });
        }

        // 3️⃣ Only allow rejection if not delivered
        if (order.status === 'delivered') {
            return res.status(400).json({ error: 'Order already delivered' });
        }

        if (order.status === 'cancelled') {
            return res.status(400).json({ error: 'Order already cancelled' });
        }

        // 4️⃣ Unassign rider from order
        order.riderId = null;
        order.status = 'pending';
        order.assignedAt = null;
        await order.save();

        // 5️⃣ Update rider
        const rider = await Rider.findById(riderId);
        if (rider) {
            rider.activeOrdersCount = Math.max(0, rider.activeOrdersCount - 1);
            if (rider.activeOrdersCount < rider.maxConcurrentOrders) {
                rider.isAvailable = true;
            }
            await rider.save();
        }

        // 6️⃣ Reassign to another rider
        const { assignRiderToOrder } = require('../services/riderAssignment');
        const newRider = await assignRiderToOrder(order);

        res.json({
            success: true,
            message: newRider
                ? '✅ Order rejected and reassigned to another rider'
                : '⚠️ Order rejected. No other rider available.',
            data: {
                order,
                previousRider: rider ? {
                    _id: rider._id,
                    name: rider.name
                } : null,
                newRider: newRider || null
            }
        });
    } catch (error) {
        console.error('Reject order error:', error);
        res.status(500).json({ error: error.message });
    }
};