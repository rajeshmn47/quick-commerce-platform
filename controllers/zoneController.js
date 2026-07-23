const Zone = require('../models/zone');
const Store = require('../models/store');
const turf = require('@turf/turf');

/**
 * GET /api/zones
 * Get all zones
 */
exports.getAllZones = async (req, res) => {
    try {
        const zones = await Zone.find().populate('storeId', 'name address');
        res.json({ success: true, data: zones });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/zones/:id
 * Get a single zone
 */
exports.getZone = async (req, res) => {
    try {
        const zone = await Zone.findById(req.params.id).populate('storeId', 'name address');
        if (!zone) return res.status(404).json({ error: 'Zone not found' });
        res.json({ success: true, data: zone });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/zones
 * Create a zone manually
 */
exports.createZone = async (req, res) => {
    try {
        const zone = new Zone(req.body);
        await zone.save();
        await zone.populate('storeId', 'name address');
        res.status(201).json({ success: true, data: zone });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

/**
 * PUT /api/zones/:id
 * Update a zone
 */
exports.updateZone = async (req, res) => {
    try {
        const zone = await Zone.findByIdAndUpdate(
            req.params.id,
            req.body,
            { returnDocument: 'after', runValidators: true }
        ).populate('storeId', 'name address');
        if (!zone) return res.status(404).json({ error: 'Zone not found' });
        res.json({ success: true, data: zone });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

/**
 * DELETE /api/zones/:id
 * Delete a zone
 */
exports.deleteZone = async (req, res) => {
    try {
        const zone = await Zone.findByIdAndDelete(req.params.id);
        if (!zone) return res.status(404).json({ error: 'Zone not found' });
        res.json({ success: true, message: 'Zone deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// controllers/zoneController.js

exports.generateZones = async (req, res) => {
    try {
        const { storeId, north, south, east, west, cellSize = 0.01 } = req.body;

        // Validate input
        if (north === undefined || south === undefined || east === undefined || west === undefined) {
            return res.status(400).json({ error: 'Bounding box (north, south, east, west) is required' });
        }

        // 1️⃣ Find the store ONLY if storeId is provided and not null
        let store = null;
        if (storeId) {
            store = await Store.findById(storeId);
            if (!store) {
                return res.status(404).json({ error: 'Store not found' });
            }
        }

        // 2️⃣ Create a bounding box polygon
        const bbox = [west, south, east, north];
        console.log(bbox, "bbox");
        const bboxPolygon = turf.bboxPolygon(bbox);

        // 3️⃣ Generate square grid
        const cellSide = parseFloat(cellSize);
        const grid = turf.squareGrid(bbox, cellSide, {
            units: 'degrees',
            mask: bboxPolygon
        });

        if (grid.features.length === 0) {
            return res.status(400).json({ error: 'No cells generated. Check bounding box and cell size.' });
        }

        // 4️⃣ Create a zone for each cell
        const zones = [];
        for (const feature of grid.features) {
            const polygon = feature.geometry;
            const zone = new Zone({
                name: `Zone ${zones.length + 1}`,
                description: store ? `Delivery zone for ${store.name}` : 'Unassigned zone',
                boundary: polygon,
                storeId: store ? store._id : null,   // 👈 Store can be null
                isActive: true,
                deliveryFee: 0,
                estimatedDeliveryTime: 15
            });
            await zone.save();
            zones.push(zone);
        }

        res.status(201).json({
            success: true,
            message: `Generated ${zones.length} zones${store ? ` for store "${store.name}"` : ''}.`,
            data: zones
        });

    } catch (error) {
        console.error('Generate zones error:', error);
        res.status(500).json({ error: error.message });
    }
};