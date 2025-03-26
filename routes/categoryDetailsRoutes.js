// sanepid-api/routes/categoryDetailsRoutes.js
const express = require('express');
const categoryDetailsController = require('../controllers/categoryDetailsController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/:categoryId', authMiddleware, categoryDetailsController.getCategoryDetails);

module.exports = router;