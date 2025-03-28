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
            if (!config.dayOfWeek && config.dayOfWeek !== 0 || config.dayOfWeek < 0 || config.dayOfWeek > 6) {
                return false;
            }
            return true;
        case 'monthly':
            if (!config.dayOfMonth || config.dayOfMonth < 1 || config.dayOfMonth > 31) {
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
exports.getLocationControls = async (req, res) => {
    try {
        const locationId = req.params.locationId;

        const result = await db.query(
            `SELECT lc.id, lc.location_id, lc.control_categories_id as category_id, lc.frequency_type, lc.frequency_config,
                    lc.start_date, lc.end_date, lc.is_active, lc.created_at, lc.updated_at,
                    cc.category, cc.subcategory
             FROM location_controls lc
                      JOIN control_categories cc ON lc.control_categories_id = cc.id
             WHERE lc.location_id = $1
             ORDER BY cc.category, cc.subcategory, lc.id`,
            [locationId]
        );

        // Format the frequency_config as JSON if it's stored as a string
        const formattedResults = result.rows.map(row => ({
            ...row,
            frequency_config: typeof row.frequency_config === 'string'
                ? JSON.parse(row.frequency_config)
                : row.frequency_config
        }));

        res.json(formattedResults);
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

        // Ensure frequency_config is properly formatted
        let configToSave = frequency_config;

        // If it's a string, try to parse it
        if (typeof frequency_config === 'string') {
            try {
                configToSave = JSON.parse(frequency_config);
            } catch (e) {
                return res.status(400).json({
                    message: 'Invalid frequency configuration format'
                });
            }
        }

        // If it's null or undefined, set an empty object
        if (!configToSave) {
            configToSave = {};
        }

        // Validate frequency config
        if (!validateFrequencyConfig(frequency_type, configToSave)) {
            return res.status(400).json({
                message: 'Invalid frequency configuration for the selected frequency type'
            });
        }

        const result = await db.query(
            `INSERT INTO location_controls
             (location_id, control_categories_id, frequency_type, frequency_config, start_date, end_date, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                locationId,
                category_id,
                frequency_type,
                JSON.stringify(configToSave),
                start_date,
                end_date || null,
                is_active === undefined ? true : is_active
            ]
        );

        // Get the category info to include in response
        const categoryResult = await db.query(
            `SELECT category, subcategory FROM control_categories WHERE id = $1`,
            [category_id]
        );

        // Combine the data
        const controlWithCategory = {
            ...result.rows[0],
            category: categoryResult.rows[0]?.category,
            subcategory: categoryResult.rows[0]?.subcategory,
            // Ensure frequency_config is parsed back from string
            frequency_config: typeof result.rows[0].frequency_config === 'string'
                ? JSON.parse(result.rows[0].frequency_config)
                : result.rows[0].frequency_config
        };

        res.status(201).json(controlWithCategory);
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
            category_id,
            frequency_type,
            frequency_config,
            start_date,
            end_date,
            is_active
        } = req.body;

        // Check if the control exists
        const checkResult = await db.query(
            `SELECT id FROM location_controls WHERE id = $1 AND location_id = $2`,
            [controlId, locationId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Control not found' });
        }

        // Validate frequency type if provided
        if (frequency_type) {
            const validFrequencyTypes = ['daily', 'weekly', 'monthly', 'yearly', 'custom'];
            if (!validFrequencyTypes.includes(frequency_type)) {
                return res.status(400).json({
                    message: 'Invalid frequency type. Must be one of: daily, weekly, monthly, yearly, custom'
                });
            }
        }

        // Ensure frequency_config is properly formatted
        let configToSave = frequency_config;

        // If it's a string, try to parse it
        if (typeof frequency_config === 'string') {
            try {
                configToSave = JSON.parse(frequency_config);
            } catch (e) {
                return res.status(400).json({
                    message: 'Invalid frequency configuration format'
                });
            }
        }

        // If it's null or undefined, set an empty object
        if (!configToSave) {
            configToSave = {};
        }

        // Validate frequency config if provided
        if (frequency_type && configToSave) {
            if (!validateFrequencyConfig(frequency_type, configToSave)) {
                return res.status(400).json({
                    message: 'Invalid frequency configuration for the selected frequency type'
                });
            }
        }

        // Build SQL query dynamically based on provided fields
        let updateQuery = 'UPDATE location_controls SET updated_at = NOW()';
        const params = [];
        let paramIndex = 1;

        if (category_id !== undefined) {
            updateQuery += `, control_categories_id = $${paramIndex}`;
            params.push(category_id);
            paramIndex++;
        }

        if (frequency_type !== undefined) {
            updateQuery += `, frequency_type = $${paramIndex}`;
            params.push(frequency_type);
            paramIndex++;
        }

        if (frequency_config !== undefined) {
            updateQuery += `, frequency_config = $${paramIndex}`;
            params.push(JSON.stringify(configToSave));
            paramIndex++;
        }

        if (start_date !== undefined) {
            updateQuery += `, start_date = $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }

        if (end_date !== undefined) {
            updateQuery += `, end_date = $${paramIndex}`;
            params.push(end_date || null);
            paramIndex++;
        }

        if (is_active !== undefined) {
            updateQuery += `, is_active = $${paramIndex}`;
            params.push(is_active);
            paramIndex++;
        }

        updateQuery += ` WHERE id = $${paramIndex} AND location_id = $${paramIndex + 1} RETURNING *`;
        params.push(controlId, locationId);

        const result = await db.query(updateQuery, params);

        // Get the category info to include in response
        const categoryResult = await db.query(
            `SELECT category, subcategory FROM control_categories WHERE id = $1`,
            [result.rows[0].control_categories_id]
        );

        // Combine the data
        const controlWithCategory = {
            ...result.rows[0],
            category: categoryResult.rows[0]?.category,
            subcategory: categoryResult.rows[0]?.subcategory,
            // Ensure frequency_config is parsed back from string
            frequency_config: typeof result.rows[0].frequency_config === 'string'
                ? JSON.parse(result.rows[0].frequency_config)
                : result.rows[0].frequency_config
        };

        res.json(controlWithCategory);
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