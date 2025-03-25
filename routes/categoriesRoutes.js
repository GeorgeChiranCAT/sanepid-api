// sanepid-api/routes/categoriesRoutes.js
const express = require('express');
const categoriesController = require('../controllers/categoriesController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Get all categories
router.get('/', authMiddleware, categoriesController.getCategories);

// Get category by ID
router.get('/:id', authMiddleware, categoriesController.getCategoryById);

module.exports = router;