// sanepid-api/controllers/controlsController.js
const db = require('../config/db');


// Add this validation helper function
function validateFrequencyConfig(frequencyType, config) {
    if (!config) return false;

    switch (frequencyType) {
        case 'daily':
            // No additional validation needed
            return true;
        case 'weekly':
            if (!config.dayOfWeek || config.dayOfWeek < 0 || config.dayOfWeek > 6) {
                return false;
            }
            return true;
        case 'monthly':
            if (!config.dayOfMonth || config.dayOfMonth < 1 || config.dayOfMonth > 26) {
                return false;
            }
            return true;
        case 'yearly':
            if (!config.month || config.month < 1 || config.month > 12) {
                return false;
            }
            if (!config.dayOfMonth || config.dayOfMonth < 1 || config.dayOfMonth > 28) {
                return false;
            }
            return true;
        case 'custom':
            if (!config.daysOfWeek || !Array.isArray(config.daysOfWeek) || config.daysOfWeek.length === 0) {
                return false;
            }
            return config.daysOfWeek.every(day => day >= 0 && day <= 6);
        default:
            return false;
    }
}

// get location controls
// Update location controls query to reflect new column names
exports.getLocationControls = async (req, res) => {
    try {
        const locationId = req.params.locationId;

        const result = await db.query(
            `SELECT lc.id, lc.location_id, lc.control_categories_id, lc.frequency_type, lc.frequency_config, 
                    lc.start_date, lc.end_date, lc.is_active, 
                    cc.category, cc.subcategory
             FROM location_controls lc
             JOIN control_categories cc ON lc.control_categories_id = cc.id
             WHERE lc.location_id = $1
             ORDER BY cc.category, cc.subcategory, lc.id`,
            [locationId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching location controls:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};



// Create a new control for a location
exports.createLocationControl = async (req, res) => {
    try {
        const { locationId } = req.params;
        const {
            category_id,
            frequency_type,
            frequency_config,
            start_date,
            end_date,
            is_active
        } = req.body;

        // Validate frequency type
        const validFrequencyTypes = ['daily', 'weekly', 'monthly', 'yearly', 'custom'];
        if (!validFrequencyTypes.includes(frequency_type)) {
            return res.status(400).json({
                message: 'Invalid frequency type. Must be one of: daily, weekly, monthly, yearly, custom'
            });
        }

        // Validate frequency config
        if (!validateFrequencyConfig(frequency_type, frequency_config)) {
            return res.status(400).json({
                message: 'Invalid frequency configuration for the selected frequency type'
            });
        }

        const result = await db.query(
            `INSERT INTO location_controls
             (location_id, category_id, frequency_type, frequency_config, start_date, end_date, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [locationId, category_id, frequency_type, frequency_config, start_date, end_date || null, is_active]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating location control:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Update a control for a location
exports.updateLocationControl = async (req, res) => {
    try {
        const { locationId, controlId } = req.params;
        const {
            frequency_type,
            frequency_config,
            start_date,
            end_date,
            is_active
        } = req.body;

        // Validate frequency type if provided
        if (frequency_type) {
            const validFrequencyTypes = ['daily', 'weekly', 'monthly', 'yearly', 'custom'];
            if (!validFrequencyTypes.includes(frequency_type)) {
                return res.status(400).json({
                    message: 'Invalid frequency type. Must be one of: daily, weekly, monthly, yearly, custom'
                });
            }
        }

        // Validate frequency config if provided
        if (frequency_type && frequency_config) {
            if (!validateFrequencyConfig(frequency_type, frequency_config)) {
                return res.status(400).json({
                    message: 'Invalid frequency configuration for the selected frequency type'
                });
            }
        }

        const result = await db.query(
            `UPDATE location_controls
             SET frequency_type = $1,
                 frequency_config = $2,
                 start_date = $3,
                 end_date = $4,
                 is_active = $5
             WHERE id = $6 AND location_id = $7
                 RETURNING *`,
            [frequency_type, frequency_config, start_date, end_date || null, is_active, controlId, locationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Control not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating location control:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Delete a control for a location
exports.deleteLocationControl = async (req, res) => {
    try {
        const { locationId, controlId } = req.params;

        const result = await db.query(
            `DELETE FROM location_controls
             WHERE id = $1 AND location_id = $2
             RETURNING id`,
            [controlId, locationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Control not found' });
        }

        res.json({ message: 'Control deleted successfully' });
    } catch (error) {
        console.error('Error deleting location control:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get all categories
exports.getCategories = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, category, subcategory, description FROM control_categories ORDER BY category, subcategory',
            []
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Create a new category
exports.createCategory = async (req, res) => {
    try {
        const { category, subcategory, description } = req.body;

        const result = await db.query(
            'INSERT INTO control_categories (category, subcategory, description) VALUES ($1, $2, $3) RETURNING *',
            [category, subcategory, description]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
