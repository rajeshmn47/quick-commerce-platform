const Rider = require('../models/rider');
const Order = require('../models/order');

/**
 * Find the best available rider at a store
 * Prioritizes: available → least busy → closest (if geolocation data exists)
 */
const findBestRider = async (storeId, storeLocation = null) => {
    try {
        // Base query: available riders at this store
        const query = {
            currentStoreId: storeId,
            isAvailable: true,
            $expr: { $lt: ['$activeOrdersCount', '$maxConcurrentOrders'] }
        };

        // If we have location data, use $geoNear for proximity
        if (storeLocation?.coordinates?.latitude && storeLocation?.coordinates?.longitude) {
            const { latitude, longitude } = storeLocation.coordinates;

            const [rider] = await Rider.aggregate([
                { $match: query },
                {
                    $geoNear: {
                        near: {
                            type: 'Point',
                            coordinates: [longitude, latitude]
                        },
                        distanceField: 'distance',
                        spherical: true,
                        query: { isAvailable: true },
                        // Only include riders with location data
                    }
                },
                { $sort: { distance: 1, activeOrdersCount: 1 } },
                { $limit: 1 }
            ]);

            return rider || null;
        }

        // Fallback: just pick the least busy rider
        const rider = await Rider.findOne(query).sort({ activeOrdersCount: 1 });
        return rider;

    } catch (error) {
        console.error('Error finding best rider:', error);
        return null;
    }
};

/**
 * Assign a rider to an order
 * Returns the assigned rider or null if none available
 */
const assignRiderToOrder = async (order) => {
    try {
        // Find the best available rider
        const rider = await findBestRider(order.storeId);

        if (!rider) {
            console.log(`⚠️ No rider available for order ${order._id}`);
            return null;
        }

        // Assign rider to order
        order.riderId = rider._id;
        order.status = 'dispatched'; // or 'picking'
        order.assignedAt = new Date();
        await order.save();

        // Update rider's active orders count
        rider.activeOrdersCount += 1;
        rider.isAvailable = false;
        await rider.save();

        console.log(`✅ Assigned order ${order._id} to rider ${rider.name}`);
        return rider;

    } catch (error) {
        console.error('Error assigning rider to order:', error);
        return null;
    }
};

/**
 * Reassign an order to another rider (when rider rejects or times out)
 */
const reassignOrder = async (orderId) => {
    try {
        const order = await Order.findById(orderId);
        if (!order) return null;

        // Remove current rider (if any)
        if (order.riderId) {
            await Rider.findByIdAndUpdate(order.riderId, {
                $inc: { activeOrdersCount: -1 }
            });
            // Make rider available again
            const rider = await Rider.findById(order.riderId);
            if (rider && !rider.isAvailable && rider.activeOrdersCount < rider.maxConcurrentOrders) {
                rider.isAvailable = true;
                await rider.save();
            }
            order.riderId = null;
            order.status = 'pending';
            await order.save();
        }

        // Try to assign a new rider
        return await assignRiderToOrder(order);

    } catch (error) {
        console.error('Error reassigning order:', error);
        return null;
    }
};

/**
 * Assign a pending order to an available rider (called after delivery completion)
 */
const assignPendingOrderToRider = async (rider) => {
    try {
        // Find oldest pending order at this rider's store
        const pendingOrder = await Order.findOne({
            storeId: rider.currentStoreId,
            status: 'pending',
            riderId: { $exists: false }
        }).sort({ createdAt: 1 });

        if (!pendingOrder) return null;

        // Assign to this rider
        pendingOrder.riderId = rider._id;
        pendingOrder.status = 'dispatched';
        pendingOrder.assignedAt = new Date();
        await pendingOrder.save();
        rider.isAvailable = false;
        await rider.save();

        console.log(`🔄 Assigned pending order ${pendingOrder._id} to rider ${rider.name}`);
        return pendingOrder;

    } catch (error) {
        console.error('Error assigning pending order:', error);
        return null;
    }
};

module.exports = {
    findBestRider,
    assignRiderToOrder,
    reassignOrder,
    assignPendingOrderToRider
};