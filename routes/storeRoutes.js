const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');

router.post('/stores', storeController.createStore);
router.put('/stores/:id', storeController.updateStore);
router.delete('/stores/:id', storeController.deleteStore);
router.get('/all_stores', storeController.getAllStores);
router.get('/stores/:id', storeController.getStore);

module.exports = router;