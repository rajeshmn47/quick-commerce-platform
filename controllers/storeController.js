const Store = require('../models/store');

exports.createStore = async (req, res) => {
    try {
        const { name, address, location, description } = req.body;
        const newStore = new Store({ name, address, location, description });
        await newStore.save();
        res.status(201).json(newStore);
    } catch (error) {
        console.error('Create store error:', error);
        res.status(500).json({ error: 'Failed to create store' });
    }
};

exports.getAllStores = async (req, res) => {
    try {
        const stores = await Store.find();
        res.json(stores);
    } catch (error) {
        console.error('Get stores error:', error);
        res.status(500).json({ error: 'Failed to fetch stores' });
    }
};

exports.getStore = async (req, res) => {
    try {
        const { id } = req.params;
        const store = await Store.findById(id);
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }
        res.json(store);
    } catch (error) {
        console.error('Get store error:', error);
        res.status(500).json({ error: 'Failed to fetch store' });
    }
};

exports.updateStore = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location, address, description } = req.body;
        const updatedStore = await Store.findByIdAndUpdate(id, { name, location, address, description }, { new: true });
        if (!updatedStore) {
            return res.status(404).json({ error: 'Store not found' });
        }
        res.json(updatedStore);
    } catch (error) {
        console.error('Update store error:', error);
        res.status(500).json({ error: 'Failed to update store' });
    }
};

exports.deleteStore = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedStore = await Store.findByIdAndDelete(id);
        if (!deletedStore) {
            return res.status(404).json({ error: 'Store not found' });
        }
        res.json({ message: 'Store deleted successfully' });
    } catch (error) {
        console.error('Delete store error:', error);
        res.status(500).json({ error: 'Failed to delete store' });
    }
};
