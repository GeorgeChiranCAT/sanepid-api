// In routes/reportsRoutes.js
const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/:year/:month/location/:locationId', authMiddleware, reportsController.getMonthlyReport);

module.exports = router;