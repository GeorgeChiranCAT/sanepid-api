// sanepid-api/controllers/categoryDetailsController.js
const db = require('../config/db');

// Get all configuration fields for a category
exports.getCategoryDetails = async (req, res) => {
    try {
        const { categoryId } = req.params;

        const result = await db.query(
            `SELECT id, field_name, field_type, field_label, is_required,
                    display_order, allowed_values, default_value,
                    validation_rules, help_text, frequency_options, frequency_details_schema
             FROM control_categories_details
             WHERE control_categories_id = $1
             ORDER BY display_order`,
            [categoryId]
        );

        // No need to parse JSON fields - pg does this automatically for JSONB columns
        // Just return the rows directly
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching category details:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};