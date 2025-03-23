// sanepid-api/routes/locationsRoutes.js
const express = require('express');
const locationsController = require('../controllers/locationsController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// This route now requires authentication
router.get('/', authMiddleware, locationsController.getLocations);

module.exports = router;