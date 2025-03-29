// sanepid-api/routes/locationsRoutes.js
const express = require('express');
const router = express.Router();
const locationsController = require('../controllers/locationsController');
const controlsController = require('../controllers/controlsController'); // Make sure this is imported
const authMiddleware = require('../middleware/authMiddleware');

// This route now requires authentication
router.get('/', authMiddleware, locationsController.getLocations);
router.get('/:id', authMiddleware, locationsController.getLocationById);

// Location controls routes
router.get('/:locationId/controls', authMiddleware, controlsController.getLocationControls);
router.post('/:locationId/controls', authMiddleware, controlsController.createLocationControl);
router.put('/:locationId/controls/:controlId', authMiddleware, controlsController.updateLocationControl);
router.delete('/:locationId/controls/:controlId', authMiddleware, controlsController.deleteLocationControl);
router.get('/:locationId/controls/:controlId/history', authMiddleware, controlsController.getControlHistory);

module.exports = router;