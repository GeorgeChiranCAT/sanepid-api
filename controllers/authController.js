// sanepid-api/controllers/authController.js
const db = require('../config/db');
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.login = async (req, res) => {
    const { email, password, location } = req.body;
    console.log('Login request for:', email);

    try {
        // Get user by email
        const userResult = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        const user = userResult.rows[0];
        console.log('User found:', user ? { id: user.id, email: user.email, role: user.role } : 'No user found');

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // For demo purposes, just check plain password
        // In production, use bcrypt.compare
        if (password !== user.password) {
            console.log('Password mismatch');
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Get user's location(s)
        let userLocations = [];
        let userLocation = null;

        if (user.role === 'client_user') {
            const locationResult = await db.query(
                'SELECT l.* FROM locations l JOIN user_locations ul ON l.id = ul.location_id WHERE ul.user_id = $1 LIMIT 1',
                [user.id]
            );
            if (locationResult.rows.length > 0) {
                userLocation = locationResult.rows[0];
            }
            console.log('Client user location:', userLocation);
        } else {
            const locationsResult = await db.query(
                'SELECT l.* FROM locations l JOIN user_locations ul ON l.id = ul.location_id WHERE ul.user_id = $1',
                [user.id]
            );
            userLocations = locationsResult.rows;
            console.log(`Admin user locations (${locationsResult.rows.length}):`, userLocations);
        }

        // Create JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Send user info and token
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                location: user.role === 'client_user' ? userLocation : undefined,
                locations: user.role !== 'client_user' ? userLocations : undefined
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.validate = async (req, res) => {
    // Get the current user's full information
    try {
        const userResult = await db.query(
            'SELECT id, name, email, role FROM users WHERE id = $1',
            [req.user.id]
        );

        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get user's location(s)
        let userLocation = null;
        let userLocations = [];

        if (user.role === 'client_user') {
            const locationResult = await db.query(
                'SELECT l.* FROM locations l JOIN user_locations ul ON l.id = ul.location_id WHERE ul.user_id = $1 LIMIT 1',
                [user.id]
            );
            if (locationResult.rows.length > 0) {
                userLocation = locationResult.rows[0];
            }
        } else {
            const locationsResult = await db.query(
                'SELECT l.* FROM locations l JOIN user_locations ul ON l.id = ul.location_id WHERE ul.user_id = $1',
                [user.id]
            );
            userLocations = locationsResult.rows;
        }

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            location: user.role === 'client_user' ? userLocation : undefined,
            locations: user.role !== 'client_user' ? userLocations : undefined
        });
    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};