// sanepid-api/routes/categoriesRoutes.js
const express = require('express');
const categoriesController = require('../controllers/categoriesController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Get all categories
router.get('/', authMiddleware, categoriesController.getCategories);

// Get category by ID
router.get('/:id', authMiddleware, categoriesController.getCategoryById);


// Get subcategories for a specific category
router.get('/:category/subcategories', authMiddleware, categoriesController.getSubcategories);

// Get all categories with subcategories
router.get('/all', authMiddleware, categoriesController.getAllCategoriesWithSubcategories);



module.exports = router;