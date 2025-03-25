// sanepid-api/routes/locationsRoutes.js
const express = require('express');
const router = express.Router();
const locationsController = require('../controllers/locationsController');
const controlsController = require('../controllers/controlsController'); // Make sure this is imported
const authMiddleware = require('../middleware/authMiddleware');

// This route now requires authentication
router.get('/', authMiddleware, locationsController.getLocations);
router.get('/:id', authMiddleware, locationsController.getLocationById);
router.get('/:locationId/controls', authMiddleware, controlsController.getLocationControls);
module.exports = router;