const Product = require('../models/product');
const Inventory = require('../models/inventory');

// Create a new product
exports.createProduct = async (req, res) => {
    try {
        const { name, description, price, category, unit, barcode, image_url } = req.body;
        
        // Check if product with same barcode exists
        if (barcode) {
            const existing = await Product.findOne({ barcode });
            if (existing) {
                return res.status(400).json({ error: 'Product with this barcode already exists' });
            }
        }
        
        const newProduct = new Product({ 
            name, 
            description, 
            price, 
            category, 
            unit, 
            barcode, 
            image_url 
        });
        
        await newProduct.save();
        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: newProduct
        });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
};

// Get all products
exports.getAllProducts = async (req, res) => {
    try {
        const products = await Product.find().sort({ name: 1 });
        res.json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
};

// Get single product by ID
exports.getProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
};

// Update product
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, category, unit, barcode, image_url, isActive } = req.body;
        
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            { name, description, price, category, unit, barcode, image_url, isActive },
            { new: true, runValidators: true }
        );
        
        if (!updatedProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json({
            success: true,
            message: 'Product updated successfully',
            data: updatedProduct
        });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
};

// Delete product (also removes from inventory)
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if product exists
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Delete all inventory entries for this product
        await Inventory.deleteMany({ product_id: id });
        
        // Delete the product
        await Product.findByIdAndDelete(id);
        
        res.json({
            success: true,
            message: 'Product deleted successfully (removed from all inventory)'
        });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
};

// Get products by category
exports.getProductsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const products = await Product.find({ 
            category: { $regex: new RegExp(category, 'i') },
            isActive: true 
        }).sort({ name: 1 });
        
        res.json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error('Get products by category error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
};

// Search products
exports.searchProducts = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }
        
        const products = await Product.find({
            $or: [
                { name: { $regex: new RegExp(query, 'i') } },
                { category: { $regex: new RegExp(query, 'i') } },
                { barcode: query }
            ],
            isActive: true
        }).limit(50);
        
        res.json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error('Search products error:', error);
        res.status(500).json({ error: 'Failed to search products' });
    }
};