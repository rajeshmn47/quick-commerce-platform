const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

// Routes
router.get('/store/:storeId', inventoryController.getStoreInventory);
router.get('/store/:storeId/low-stock', inventoryController.getLowStockItems);
router.get('/store/:storeId/product/:productId', inventoryController.getProductInventory);
router.post('/', inventoryController.addToInventory);
router.post('/bulk', inventoryController.bulkUpdateInventory);
router.put('/:id', inventoryController.updateInventory);
router.patch('/:id/stock', inventoryController.updateStock);
router.delete('/:id', inventoryController.removeFromInventory);

module.exports = router;