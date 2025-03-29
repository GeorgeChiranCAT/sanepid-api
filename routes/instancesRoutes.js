const express = require('express');
const router = express.Router();
const instancesController = require('../controllers/instancesController');
const authMiddleware = require('../middleware/authMiddleware');

// Generation routes
router.post('/generate/current', authMiddleware, instancesController.generateInstancesForCurrentMonth);
router.post('/generate/:year/:month', authMiddleware, instancesController.generateInstancesForMonth);
router.post('/generate/control/:controlId', authMiddleware, instancesController.generateInstancesForControl);

// Instance management routes
router.get('/location/:locationId', authMiddleware, instancesController.getLocationInstances);
router.get('/:instanceId', authMiddleware, instancesController.getInstanceById);
router.put('/:instanceId/complete', authMiddleware, instancesController.completeInstance);
router.put('/:instanceId/missed', authMiddleware, instancesController.reportMissed);

module.exports = router;