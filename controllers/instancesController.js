const db = require('../config/db');
const instanceGenerator = require('../services/instanceGeneratorService');

// Generate instances for the current month
exports.generateInstancesForCurrentMonth = async (req, res) => {
    try {
        const now = new Date();
        const result = await instanceGenerator.generateInstancesForMonth(
            now.getFullYear(),
            now.getMonth()
        );
        res.json(result);
    } catch (error) {
        console.error('Error in generate instances controller:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Generate instances for a specific month
exports.generateInstancesForMonth = async (req, res) => {
    try {
        const { year, month } = req.params;

        // Validate input
        const yearNum = parseInt(year, 10);
        const monthNum = parseInt(month, 10) - 1; // 0-based months

        if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 0 || monthNum > 11) {
            return res.status(400).json({ message: 'Invalid year or month' });
        }

        const result = await instanceGenerator.generateInstancesForMonth(yearNum, monthNum);
        res.json(result);
    } catch (error) {
        console.error('Error in generate instances controller:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Generate instances for a specific control
exports.generateInstancesForControl = async (req, res) => {
    try {
        const { controlId } = req.params;
        const now = new Date();

        const result = await instanceGenerator.generateInstancesForControl(
            controlId,
            now.getFullYear(),
            now.getMonth()
        );

        res.json(result);
    } catch (error) {
        console.error('Error generating instances for control:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get all control instances for a location
exports.getLocationInstances = async (req, res) => {
    try {
        const { locationId } = req.params;
        const { status, startDate, endDate } = req.query;

        let query = `
            SELECT ci.*, lc.frequency_type, lc.frequency_config,
                   cc.category, cc.subcategory
            FROM control_instances ci
            JOIN location_controls lc ON ci.location_control_id = lc.id
            JOIN control_categories cc ON lc.control_categories_id = cc.id
            WHERE lc.location_id = $1
        `;

        const params = [locationId];
        let paramIndex = 2;

        if (status) {
            query += ` AND ci.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (startDate) {
            query += ` AND ci.scheduled_date >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            query += ` AND ci.scheduled_date <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }

        query += ` ORDER BY ci.scheduled_date DESC`;

        const result = await db.query(query, params);

        // Format the data for response
        const formattedResults = result.rows.map(row => ({
            ...row,
            frequency_config: typeof row.frequency_config === 'string'
                ? JSON.parse(row.frequency_config)
                : row.frequency_config,
            measurements: typeof row.measurements === 'string'
                ? JSON.parse(row.measurements)
                : row.measurements
        }));

        res.json(formattedResults);
    } catch (error) {
        console.error('Error fetching location instances:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Complete a control instance
exports.completeInstance = async (req, res) => {
    try {
        const { instanceId } = req.params;
        const { measurements, notes, userId } = req.body;

        // Validate if the instance exists
        const checkResult = await db.query(
            `SELECT ci.id, ci.scheduled_date 
             FROM control_instances ci
             WHERE ci.id = $1`,
            [instanceId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Control instance not found' });
        }

        // Check if the instance is in the past
        const instance = checkResult.rows[0];
        const scheduledDate = new Date(instance.scheduled_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (scheduledDate < today) {
            // Past instances can only be updated if they're not already completed
            const statusCheck = await db.query(
                `SELECT status FROM control_instances WHERE id = $1`,
                [instanceId]
            );

            if (statusCheck.rows[0].status === 'completed') {
                return res.status(400).json({
                    message: 'Cannot modify a completed instance from the past'
                });
            }
        }

        // Update the instance as completed
        const result = await db.query(
            `UPDATE control_instances 
             SET status = 'completed', 
                 completed_at = NOW(), 
                 completed_by = $1,
                 measurements = $2,
                 notes = $3
             WHERE id = $4
             RETURNING *`,
            [userId, JSON.stringify(measurements), notes, instanceId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error completing control instance:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Mark a control instance as missed with a reason
exports.reportMissed = async (req, res) => {
    try {
        const { instanceId } = req.params;
        const { reason, standardExcuse, userId } = req.body;

        // Validate if the instance exists
        const checkResult = await db.query(
            `SELECT ci.id, ci.scheduled_date 
             FROM control_instances ci
             WHERE ci.id = $1`,
            [instanceId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Control instance not found' });
        }

        // Check if the instance is in the past
        const instance = checkResult.rows[0];
        const scheduledDate = new Date(instance.scheduled_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (scheduledDate < today) {
            // Past instances can only be updated if they're not already completed
            const statusCheck = await db.query(
                `SELECT status FROM control_instances WHERE id = $1`,
                [instanceId]
            );

            if (statusCheck.rows[0].status === 'completed') {
                return res.status(400).json({
                    message: 'Cannot modify a completed instance from the past'
                });
            }
        }

        // Update instance status
        await db.query(
            `UPDATE control_instances 
             SET status = 'missed'
             WHERE id = $1`,
            [instanceId]
        );

        // Create missed control record
        const missedResult = await db.query(
            `INSERT INTO missed_controls
             (control_instance_id, reason, standard_excuse, reported_by, reported_at)
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING *`,
            [instanceId, reason, standardExcuse, userId]
        );

        res.json(missedResult.rows[0]);
    } catch (error) {
        console.error('Error reporting missed control:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get instance details
exports.getInstanceById = async (req, res) => {
    try {
        const { instanceId } = req.params;

        const result = await db.query(
            `SELECT ci.*, lc.frequency_type, lc.frequency_config,
                    cc.category, cc.subcategory
             FROM control_instances ci
             JOIN location_controls lc ON ci.location_control_id = lc.id
             JOIN control_categories cc ON lc.control_categories_id = cc.id
             WHERE ci.id = $1`,
            [instanceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // Format the data
        const instance = {
            ...result.rows[0],
            frequency_config: typeof result.rows[0].frequency_config === 'string'
                ? JSON.parse(result.rows[0].frequency_config)
                : result.rows[0].frequency_config,
            measurements: typeof result.rows[0].measurements === 'string'
                ? JSON.parse(result.rows[0].measurements)
                : result.rows[0].measurements
        };

        // If instance was missed, get the reason
        if (instance.status === 'missed') {
            const missedResult = await db.query(
                `SELECT * FROM missed_controls WHERE control_instance_id = $1`,
                [instanceId]
            );

            if (missedResult.rows.length > 0) {
                instance.missed_details = missedResult.rows[0];
            }
        }

        res.json(instance);
    } catch (error) {
        console.error('Error fetching instance details:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};