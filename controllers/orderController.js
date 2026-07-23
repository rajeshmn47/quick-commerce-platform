const Order = require('../models/order');
const Inventory = require('../models/inventory');
const Store = require('../models/store');
const Product = require('../models/product');
const Rider = require('../models/rider');
const { assignRiderToOrder } = require('../services/riderAssignment');
const Zone = require('../models/zone');

async function findBestStore(customerLat, customerLng, items) {
    // 1️⃣ Find stores within 10 km
    const zone = await Zone.find({
        boundary: {
            $geoIntersects: {
                $geometry: {
                    type: 'Point',
                    coordinates: [
                        customerLng,
                        customerLat
                    ]
                }
            }
        }
    })
    const nearbyStores = await Store.find({
        _id: zone[0].storeId
    });
    console.log(nearbyStores.length, customerLng, customerLat, "near by stores");

    if (nearbyStores.length === 0) return null;

    let eligibleStores = [];

    // 2️⃣ Filter by inventory availability
    for (const store of nearbyStores) {
        let hasAllItems = true;
        for (const item of items) {
            const inventory = await Inventory.findOne({
                store_id: store._id,
                product_id: item.productId
            });
            if (!inventory || inventory.stock_quantity < item.quantity) {
                hasAllItems = false;
                break;
            }
        }
        if (!hasAllItems) continue;

        eligibleStores.push({
            store,
            distance: calculateDistance(
                customerLat, customerLng,
                store.location.coordinates?.[1],
                store.location.coordinates?.[0]
            )
        });
    }
    return eligibleStores[0].store;
}

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

// ==================== CREATE ORDER ====================
exports.createOrder = async (req, res) => {
    try {
        const {
            customerName,
            customerPhone,
            address,
            items,
            totalAmount,
            deliveryInstructions,
            customerLatitude,    // 👈 New: from frontend
            customerLongitude,   // 👈 New: from frontend
            customerPincode,     // 👈 Optional fallback
        } = req.body;

        // ✅ Validate required fields
        if (!customerName || !customerPhone || !address || !items || !totalAmount) {
            return res.status(400).json({
                error: 'Missing required fields: customerName, customerPhone, address, items, totalAmount'
            });
        }

        // ✅ Validate location
        if (!customerLatitude || !customerLongitude) {
            return res.status(400).json({
                error: 'Customer location (latitude/longitude) is required'
            });
        }

        // ✅ Find the best store based on location + inventory
        const bestStore = await findBestStore(customerLatitude, customerLongitude, items);
        if (!bestStore) {
            return res.status(400).json({
                error: 'No store available for delivery. Please try again later.'
            });
        }

        const storeId = bestStore._id;

        // ✅ Check inventory at the selected store
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(404).json({ error: `Product ${item.productId} not found` });
            }

            const inventory = await Inventory.findOne({
                store_id: storeId,
                product_id: item.productId
            });

            if (!inventory) {
                return res.status(400).json({
                    error: `Product "${product.name}" is not available at the nearest store`
                });
            }

            if (inventory.stock_quantity < item.quantity) {
                return res.status(400).json({
                    error: `Insufficient stock for "${product.name}" at nearest store. Available: ${inventory.stock_quantity}`
                });
            }
        }

        // ✅ Create the order
        const newOrder = new Order({
            storeId,
            customerName,
            customerPhone,
            address,
            items,
            finalAmount: totalAmount,
            totalAmount,
            deliveryInstructions: deliveryInstructions || '',
            customerLocation: {
                type: 'Point',
                coordinates: [
                    customerLongitude,
                    customerLatitude
                ]
            },
            customerPincode: customerPincode || null,
            status: 'pending',
            estimatedDeliveryTime: new Date(Date.now() + 15 * 60000),
        });

        await newOrder.save();

        // ✅ Deduct stock from inventory
        for (const item of items) {
            await Inventory.findOneAndUpdate(
                { store_id: storeId, product_id: item.productId },
                { $inc: { stock_quantity: -item.quantity } },
                { returnDocument: 'after' } // ✅ Use returnDocument instead of new
            );
        }

        // ✅ Populate the order for response
        const populatedOrder = await Order.findById(newOrder._id)
            .populate('storeId', 'name address location')
            .populate('items.productId', 'name price unit image_url');

        // ✅ Auto-assign rider (optional)
        const assignedRider = await assignRiderToOrder(newOrder);

        res.status(201).json({
            success: true,
            message: 'Order placed successfully!',
            data: populatedOrder,
            storeAssigned: bestStore.name,
            riderAssigned: !!assignedRider
        });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to place order' });
    }
};

// ==================== GET ALL ORDERS ====================
exports.getAllOrders = async (req, res) => {
    try {
        const { status, storeId, startDate, endDate } = req.query;

        // Build filter
        const filter = {};
        if (status) filter.status = status;
        if (storeId) filter.storeId = storeId;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const orders = await Order.find(filter)
            .populate('storeId', 'name')
            .populate('items.productId', 'name price unit image_url')
            .populate('riderId', 'name phone')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: orders.length,
            data: orders
        });

    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};

// ==================== GET ORDER BY ID ====================
exports.getOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await Order.findById(id)
            .populate('storeId', 'name address location')
            .populate('items.productId', 'name price unit image_url category')
            .populate('riderId', 'name phone')
            .populate('pickerId', 'name phone');

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({
            success: true,
            data: order
        });

    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
};

// ==================== UPDATE ORDER STATUS ====================
exports.updateOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, riderId, pickerId, estimatedDeliveryTime } = req.body;

        // Validate status
        const validStatuses = ['pending', 'picking', 'dispatched', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const updateData = { status };
        if (riderId) updateData.riderId = riderId;
        if (pickerId) updateData.pickerId = pickerId;
        if (estimatedDeliveryTime) updateData.estimatedDeliveryTime = estimatedDeliveryTime;

        // If status is delivered, add deliveredAt timestamp
        if (status === 'delivered') {
            updateData.deliveredAt = new Date();
        }

        // If status is cancelled, add cancelledAt timestamp
        if (status === 'cancelled') {
            updateData.cancelledAt = new Date();

            // Restore inventory when order is cancelled
            const order = await Order.findById(id);
            if (order && order.status !== 'delivered') {
                for (const item of order.items) {
                    await Inventory.findOneAndUpdate(
                        { store_id: order.storeId, product_id: item.productId },
                        { $inc: { stock_quantity: item.quantity } },
                        { new: true }
                    );
                }
            }
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        )
            .populate('storeId', 'name address')
            .populate('items.productId', 'name price unit')
            .populate('riderId', 'name phone')
            .populate('pickerId', 'name phone');

        if (!updatedOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Emit real-time update via WebSocket (if you have Socket.io)
        // io.to(`order-${id}`).emit('orderUpdated', updatedOrder);

        res.json({
            success: true,
            message: `Order status updated to "${status}"`,
            data: updatedOrder
        });

    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
};

// ==================== ASSIGN RIDER ====================
exports.assignRider = async (req, res) => {
    try {
        const { id } = req.params;
        const { riderId } = req.body;

        if (!riderId) {
            return res.status(400).json({ error: 'riderId is required' });
        }

        const order = await Order.findByIdAndUpdate(
            id,
            {
                riderId,
                status: 'dispatched',
                assignedAt: new Date()
            },
            { new: true }
        )
            .populate('storeId', 'name address')
            .populate('riderId', 'name phone')
            .populate('items.productId', 'name');

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({
            success: true,
            message: 'Rider assigned successfully',
            data: order
        });

    } catch (error) {
        console.error('Assign rider error:', error);
        res.status(500).json({ error: 'Failed to assign rider' });
    }
};

// ==================== GET ORDERS BY STORE ====================
exports.getOrdersByStore = async (req, res) => {
    try {
        const { storeId } = req.params;
        const { status, limit = 50 } = req.query;

        const filter = { storeId };
        if (status) filter.status = status;

        const orders = await Order.find(filter)
            .populate('items.productId', 'name price unit')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json({
            success: true,
            count: orders.length,
            data: orders
        });

    } catch (error) {
        console.error('Get orders by store error:', error);
        res.status(500).json({ error: 'Failed to fetch store orders' });
    }
};

// ==================== GET ORDERS BY CUSTOMER ====================
exports.getOrdersByCustomer = async (req, res) => {
    try {
        const { phone, status, limit = 20, page = 1 } = req.query;

        // ✅ Security: Users can only view their own orders
        const isAdmin = req.user?.role === 'admin';
        const targetPhone = phone || req.user?.phone;

        if (!isAdmin && phone && phone !== req.user?.phone) {
            return res.status(403).json({
                error: 'You can only view your own orders'
            });
        }

        if (!targetPhone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // ✅ BUILD FILTER
        const filter = { customerPhone: targetPhone };

        // ✅ ADD STATUS FILTER (if provided)
        if (status && status !== 'all') {
            filter.status = status;  // 👈 This is the key line!
        }

        // ✅ PAGINATION
        const skip = (parseInt(page) - 1) * parseInt(limit);

        console.log(`🔍 Phone: ${targetPhone}, Status: ${status || 'all'}`);

        const [orders, totalCount] = await Promise.all([
            Order.find(filter)  // 👈 filter now includes status
                .populate('storeId', 'name address')
                .populate('items.productId', 'name price unit image_url')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Order.countDocuments(filter)
        ]);

        res.json({
            success: true,
            count: orders.length,
            total: totalCount,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            data: orders
        });

    } catch (error) {
        console.error('Get orders by customer error:', error);
        res.status(500).json({ error: 'Failed to fetch customer orders' });
    }
};

// ==================== GET ORDER STATS ====================
exports.getOrderStats = async (req, res) => {
    try {
        const { storeId } = req.query;

        const filter = {};
        if (storeId) filter.storeId = storeId;

        const stats = await Order.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$totalAmount' }
                }
            }
        ]);

        // Get daily stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayOrders = await Order.find({
            ...filter,
            createdAt: { $gte: today, $lt: tomorrow }
        });

        const pendingOrders = await Order.countDocuments({ ...filter, status: 'pending' });
        const pickingOrders = await Order.countDocuments({ ...filter, status: 'picking' });
        const dispatchedOrders = await Order.countDocuments({ ...filter, status: 'dispatched' });
        const deliveredOrders = await Order.countDocuments({ ...filter, status: 'delivered' });

        const totalRevenue = await Order.aggregate([
            { $match: { ...filter, status: 'delivered' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        res.json({
            success: true,
            data: {
                byStatus: stats,
                today: {
                    count: todayOrders.length,
                    revenue: todayOrders.reduce((sum, o) => sum + o.totalAmount, 0)
                },
                counts: {
                    pending: pendingOrders,
                    picking: pickingOrders,
                    dispatched: dispatchedOrders,
                    delivered: deliveredOrders,
                },
                totalRevenue: totalRevenue[0]?.total || 0,
                totalOrders: await Order.countDocuments(filter)
            }
        });

    } catch (error) {
        console.error('Get order stats error:', error);
        res.status(500).json({ error: 'Failed to fetch order stats' });
    }
};

// ==================== DELETE ORDER ====================
exports.deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if order exists
        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Only allow deletion if order is pending or cancelled
        if (order.status !== 'pending' && order.status !== 'cancelled') {
            return res.status(400).json({
                error: 'Only pending or cancelled orders can be deleted'
            });
        }

        // Restore inventory if order is pending
        if (order.status === 'pending') {
            for (const item of order.items) {
                await Inventory.findOneAndUpdate(
                    { store_id: order.storeId, product_id: item.productId },
                    { $inc: { stock_quantity: item.quantity } },
                    { new: true }
                );
            }
        }

        await Order.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Order deleted successfully'
        });

    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ error: 'Failed to delete order' });
    }
};