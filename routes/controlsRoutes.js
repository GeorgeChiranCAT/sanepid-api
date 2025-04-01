const instancesController = require('../controllers/instancesController');

// In your routes file
router.post('/locations/:locationId/controls', authMiddleware, controlsController.createLocationControl);
router.put('/locations/:locationId/controls/:controlId', authMiddleware, controlsController.updateLocationControl);
router.delete('/locations/:locationId/controls/:controlId', authMiddleware, controlsController.deleteLocationControl);
