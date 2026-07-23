const express = require('express');
const router = express.Router();
const zoneController = require('../controllers/zoneController');
const { verifyToken, checkRole } = require('../middleware/auth');

// Public / authenticated routes (all require admin)
router.get('/', verifyToken, checkRole('admin'), zoneController.getAllZones);
router.get('/:id', verifyToken, checkRole('admin'), zoneController.getZone);
router.post('/', verifyToken, checkRole('admin'), zoneController.createZone);
router.put('/:id', verifyToken, checkRole('admin'), zoneController.updateZone);
router.delete('/:id', verifyToken, checkRole('admin'), zoneController.deleteZone);

// Special: generate zones
router.post('/generate', verifyToken, checkRole('admin'), zoneController.generateZones);

module.exports = router;