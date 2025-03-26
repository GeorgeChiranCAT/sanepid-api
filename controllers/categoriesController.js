// sanepid-api/controllers/categoriesController.js
const db = require('../config/db');


exports.getCategories = async (req, res) => {
    try {
        // Query to get distinct categories
        const result = await db.query(
            'SELECT DISTINCT category FROM control_categories ORDER BY category',
            []
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getSubcategories = async (req, res) => {
    try {
        const { category } = req.params;

        // Query to get subcategories for a specific category
        const result = await db.query(
            'SELECT id, subcategory FROM control_categories WHERE category = $1 ORDER BY subcategory',
            [category]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching subcategories:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getAllCategoriesWithSubcategories = async (req, res) => {
    try {
        // Query to get all categories and subcategories
        const result = await db.query(
            'SELECT id, category, subcategory FROM control_categories ORDER BY category, subcategory',
            []
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching all categories and subcategories:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get a category by ID
exports.getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            'SELECT id, category, subcategory  FROM control_categories WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Category not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};