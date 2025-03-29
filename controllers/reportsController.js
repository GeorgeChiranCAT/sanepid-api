const db = require('../config/db');

exports.getMonthlyReport = async (req, res) => {
    try {
        const { locationId, month, year } = req.params;

        // Validate parameters
        const monthNum = parseInt(month, 10);
        const yearNum = parseInt(year, 10);

        if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
            return res.status(400).json({ message: 'Invalid month or year' });
        }

        // Format dates for the query
        const startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
        const endDate = new Date(yearNum, monthNum, 0).toISOString().split('T')[0]; // Last day of month

        // First, get ALL active controls for this location
        const controlsResult = await db.query(
            `SELECT lc.id as location_control_id, lc.frequency_type, lc.frequency_config,
                    cc.id as category_id, cc.category, cc.subcategory
             FROM location_controls lc
                      JOIN control_categories cc ON lc.control_categories_id = cc.id
             WHERE lc.location_id = $1 AND lc.is_active = true
             ORDER BY cc.category, cc.subcategory`,
            [locationId]
        );

        // Then get the instances for this month
        const instancesResult = await db.query(
            `SELECT ci.id, ci.location_control_id, ci.scheduled_date, ci.status, 
                    ci.completed_at, ci.measurements
             FROM control_instances ci
             JOIN location_controls lc ON ci.location_control_id = lc.id
             WHERE lc.location_id = $1
             AND ci.scheduled_date BETWEEN $2 AND $3`,
            [locationId, startDate, endDate]
        );

        // Group instances by location_control_id
        const instancesByControl = {};
        instancesResult.rows.forEach(instance => {
            if (!instancesByControl[instance.location_control_id]) {
                instancesByControl[instance.location_control_id] = [];
            }

            // Parse measurements if they exist
            let measurements = null;
            if (instance.measurements) {
                try {
                    measurements = typeof instance.measurements === 'string'
                        ? JSON.parse(instance.measurements)
                        : instance.measurements;
                } catch (e) {
                    console.error('Error parsing measurements:', e);
                }
            }

            instancesByControl[instance.location_control_id].push({
                date: instance.scheduled_date,
                day: new Date(instance.scheduled_date).getDate(),
                status: instance.status,
                completed_at: instance.completed_at,
                measurements
            });
        });

        // Build the report using ALL controls
        const report = controlsResult.rows.map(control => {
            return {
                id: control.location_control_id,
                category: control.category,
                subcategory: control.subcategory,
                name: control.subcategory || control.category,
                days: instancesByControl[control.location_control_id] || []
            };
        });

        res.json(report);
    } catch (error) {
        console.error('Error generating monthly report:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};