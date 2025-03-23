// sanepid-api/controllers/locationsController.js
const db = require('../config/db');

exports.getLocations = async (req, res) => {
    try {
        // Check if a user ID is provided (from auth middleware)
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Get user role first
        const userResult = await db.query(
            'SELECT role FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userRole = userResult.rows[0].role;
        let result;

        // For client_user, return only their assigned location
        if (userRole === 'client_user') {
            result = await db.query(
                'SELECT l.* FROM locations l ' +
                'JOIN user_locations ul ON l.id = ul.location_id ' +
                'WHERE ul.user_id = $1 ' +
                'ORDER BY l.name',
                [userId]
            );
        }
        // For admin users, return all accessible locations
        else if (['client_admin', 'sanepid_user', 'sanepid_admin'].includes(userRole)) {
            result = await db.query(
                'SELECT l.* FROM locations l ' +
                'JOIN user_locations ul ON l.id = ul.location_id ' +
                'WHERE ul.user_id = $1 ' +
                'ORDER BY l.name',
                [userId]
            );
        } else {
            return res.status(403).json({ message: 'Unauthorized role' });
        }

        console.log(`Retrieved ${result.rows.length} locations for user ${userId} with role ${userRole}`);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching locations from database:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};