const Inventory = require('../models/inventory');
const Product = require('../models/product');
const Store = require('../models/store');

// Get inventory for a specific store
exports.getStoreInventory = async (req, res) => {
    try {
        const { storeId } = req.params;
        
        // Check if store exists
        const store = await Store.findById(storeId);
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }
        
        const inventory = await Inventory.find({ store_id: storeId })
            .populate('product_id')
            .sort({ 'product_id.name': 1 });
        
        res.json({
            success: true,
            store: store.name,
            count: inventory.length,
            data: inventory
        });
    } catch (error) {
        console.error('Get store inventory error:', error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
};

// Get inventory for a specific product in a store
exports.getProductInventory = async (req, res) => {
    try {
        const { storeId, productId } = req.params;
        
        const inventory = await Inventory.findOne({ 
            store_id: storeId, 
            product_id: productId 
        }).populate('product_id');
        
        if (!inventory) {
            return res.status(404).json({ error: 'Product not found in this store' });
        }
        
        res.json({
            success: true,
            data: inventory
        });
    } catch (error) {
        console.error('Get product inventory error:', error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
};

// Add product to inventory
exports.addToInventory = async (req, res) => {
    try {
        const { store_id, product_id, stock_quantity, low_stock_threshold, reorder_point } = req.body;
        
        // Check if store exists
        const store = await Store.findById(store_id);
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }
        
        // Check if product exists
        const product = await Product.findById(product_id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Check if product already in inventory
        const existing = await Inventory.findOne({ store_id, product_id });
        if (existing) {
            return res.status(400).json({ error: 'Product already added to this store' });
        }
        
        const newInventory = new Inventory({ 
            store_id, 
            product_id, 
            stock_quantity: stock_quantity || 0,
            low_stock_threshold: low_stock_threshold || 10,
            reorder_point: reorder_point || 5
        });
        
        await newInventory.save();
        await newInventory.populate('product_id');
        
        res.status(201).json({
            success: true,
            message: 'Product added to inventory successfully',
            data: newInventory
        });
    } catch (error) {
        console.error('Add to inventory error:', error);
        res.status(500).json({ error: 'Failed to add product to inventory' });
    }
};

// Update inventory stock
exports.updateInventory = async (req, res) => {
    try {
        const { id } = req.params;
        const { stock_quantity, low_stock_threshold, reorder_point } = req.body;
        
        const updatedInventory = await Inventory.findByIdAndUpdate(
            id,
            { 
                stock_quantity, 
                low_stock_threshold, 
                reorder_point 
            },
            { new: true, runValidators: true }
        ).populate('product_id');
        
        if (!updatedInventory) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        
        res.json({
            success: true,
            message: 'Inventory updated successfully',
            data: updatedInventory
        });
    } catch (error) {
        console.error('Update inventory error:', error);
        res.status(500).json({ error: 'Failed to update inventory' });
    }
};

// Update stock quantity only (quick update)
exports.updateStock = async (req, res) => {
    try {
        const { id } = req.params;
        const { stock_quantity } = req.body;
        
        if (stock_quantity === undefined || stock_quantity < 0) {
            return res.status(400).json({ error: 'Valid stock quantity is required' });
        }
        
        const updatedInventory = await Inventory.findByIdAndUpdate(
            id,
            { stock_quantity },
            { new: true }
        ).populate('product_id');
        
        if (!updatedInventory) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        
        // Check if low stock
        const isLowStock = stock_quantity <= updatedInventory.low_stock_threshold;
        
        res.json({
            success: true,
            message: `Stock updated to ${stock_quantity}`,
            data: updatedInventory,
            isLowStock: isLowStock
        });
    } catch (error) {
        console.error('Update stock error:', error);
        res.status(500).json({ error: 'Failed to update stock' });
    }
};

// Remove product from inventory
exports.removeFromInventory = async (req, res) => {
    try {
        const { id } = req.params;
        
        const deleted = await Inventory.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        
        res.json({
            success: true,
            message: 'Product removed from inventory successfully'
        });
    } catch (error) {
        console.error('Remove from inventory error:', error);
        res.status(500).json({ error: 'Failed to remove from inventory' });
    }
};

// Get low stock items for a store
exports.getLowStockItems = async (req, res) => {
    try {
        const { storeId } = req.params;
        
        const inventory = await Inventory.find({ store_id: storeId })
            .populate('product_id');
        
        const lowStockItems = inventory.filter(
            item => item.stock_quantity <= item.low_stock_threshold
        );
        
        res.json({
            success: true,
            store_id: storeId,
            count: lowStockItems.length,
            data: lowStockItems
        });
    } catch (error) {
        console.error('Get low stock items error:', error);
        res.status(500).json({ error: 'Failed to fetch low stock items' });
    }
};

// Bulk update inventory (multiple products)
exports.bulkUpdateInventory = async (req, res) => {
    try {
        const { storeId, items } = req.body;
        
        if (!storeId || !items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Store ID and items array are required' });
        }
        
        const updates = [];
        for (const item of items) {
            const { product_id, stock_quantity } = item;
            const updated = await Inventory.findOneAndUpdate(
                { store_id: storeId, product_id },
                { stock_quantity },
                { new: true }
            );
            updates.push(updated);
        }
        
        res.json({
            success: true,
            message: `${updates.length} items updated successfully`,
            data: updates
        });
    } catch (error) {
        console.error('Bulk update inventory error:', error);
        res.status(500).json({ error: 'Failed to update inventory' });
    }
};