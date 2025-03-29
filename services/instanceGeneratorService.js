const db = require('../config/db');
const moment = require('moment');

// Generate instances for all controls for a specific month
async function generateInstancesForMonth(year, month) {
    try {
        // Get all active location controls
        const controls = await db.query(
            `SELECT lc.id, lc.location_id, lc.control_categories_id, 
                    lc.frequency_type, lc.frequency_config, lc.start_date, lc.end_date
             FROM location_controls lc
             WHERE lc.is_active = true 
             AND (lc.start_date <= $1 OR lc.start_date IS NULL)
             AND (lc.end_date IS NULL OR lc.end_date >= $2)`,
            [
                `${year}-${month+1}-01`, // First day of the target month
                `${year}-${month+1}-01`  // First day of the target month
            ]
        );

        const startDate = moment(`${year}-${monthStr}-01`, 'YYYY-MM-DD');
        const endDate = moment(startDate).endOf('month');
        const daysInMonth = endDate.date();

        // Get the current date for comparison
        const currentDate = moment().startOf('day');

        let instancesCreated = 0;

        for (const control of controls.rows) {
            const frequency = control.frequency_type;
            const config = typeof control.frequency_config === 'string'
                ? JSON.parse(control.frequency_config)
                : control.frequency_config;

            // Generate dates based on frequency
            instanceDates.push(moment(`${year}-${String(month+1).padStart(2, '0')}-${String(day).padStart(2, '0')}`));

            switch (frequency) {
                case 'daily':
                    // Generate an instance for every day of the month
                    for (let day = 1; day <= daysInMonth; day++) {
                        instanceDates.push(moment(`${year}-${month+1}-${day}`));
                    }
                    break;

                case 'weekly':
                    // Parse the day of week from config
                    const dayOfWeek = parseInt(config.dayOfWeek, 10);

                    // Validate day of week to prevent infinite loops
                    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
                        console.error(`Invalid day of week value: ${config.dayOfWeek}`);
                        break;
                    }

                    // Use native Date object instead of moment for the calculation
                    let currentDate = new Date(year, month, 1);

                    // Move to first occurrence of the day of week
                    while (currentDate.getDay() !== dayOfWeek) {
                        currentDate.setDate(currentDate.getDate() + 1);
                    }

                    // Add all occurrences in the month
                    while (currentDate.getMonth() === month) {
                        // Convert to ISO date string and create a moment object from that
                        const dateStr = currentDate.toISOString().split('T')[0];
                        instanceDates.push(moment(dateStr));

                        // Move to next week
                        currentDate.setDate(currentDate.getDate() + 7);
                    }

                    break;

                case 'yearly':
                    // Only generate if this is the specified month
                    if (month + 1 === config.month) {
                        const dayOfMonth = Math.min(config.dayOfMonth, daysInMonth);
                        instanceDates.push(moment(`${year}-${month+1}-${dayOfMonth}`));
                    }
                    break;

                case 'custom':
                    // Generate for specific days of the week
                    const daysOfWeek = config.daysOfWeek || [];
                    for (const dayOfWeek of daysOfWeek) {
                        let currentDate = moment(startDate);

                        // Move to the first occurrence of this day of week
                        while (currentDate.day() !== dayOfWeek) {
                            currentDate.add(1, 'day');
                        }

                        // Add all occurrences in the month
                        while (currentDate.month() === month) {
                            instanceDates.push(moment(currentDate));
                            currentDate.add(7, 'days');
                        }
                    }
                    break;
            }

            // Create instances in the database for each date
            for (const date of instanceDates) {
                // Only process dates from today onward to preserve historical integrity
                if (date.isBefore(currentDate)) {
                    continue; // Skip past dates
                }

                // Check if instance already exists
                const existingInstance = await db.query(
                    `SELECT id FROM control_instances
                     WHERE location_control_id = $1 AND scheduled_date = $2`,
                    [control.id, date.format('YYYY-MM-DD')]
                );

                if (existingInstance.rows.length === 0) {
                    // Create new instance
                    await db.query(
                        `INSERT INTO control_instances 
                         (location_control_id, scheduled_date, status, expires_at)
                         VALUES ($1, $2, $3, $4)`,
                        [
                            control.id,
                            date.format('YYYY-MM-DD'),
                            'pending',
                            date.endOf('day').toISOString()
                        ]
                    );
                    instancesCreated++;
                }
            }
        }

        return { success: true, instancesCreated };
    } catch (error) {
        console.error('Error generating control instances:', error);
        throw error;
    }
}

// Generate instances for a single control
async function generateInstancesForControl(controlId, year, month) {
    try {
        // Get the specific control
        const controlResult = await db.query(
            `SELECT lc.id, lc.location_id, lc.control_categories_id, 
                    lc.frequency_type, lc.frequency_config, lc.start_date, lc.end_date, lc.is_active
             FROM location_controls lc
             WHERE lc.id = $1`,
            [controlId]
        );

        if (controlResult.rows.length === 0 || !controlResult.rows[0].is_active) {
            return { success: false, message: 'Control not found or inactive' };
        }

        const control = controlResult.rows[0];

        // Check if control is applicable for this month
        const monthStr = String(month + 1).padStart(2, '0');
        const startDate = moment(`${year}-${monthStr}-01`, 'YYYY-MM-DD');
        const endDate = moment(startDate).endOf('month');


        // Skip if control starts after this month or ended before this month
        if ((control.start_date && moment(control.start_date).isAfter(endDate)) ||
            (control.end_date && moment(control.end_date).isBefore(startDate))) {
            return { success: true, instancesCreated: 0 };
        }

        // Generate dates based on frequency
        const instanceDates = [];
        const frequency = control.frequency_type;
        const config = typeof control.frequency_config === 'string'
            ? JSON.parse(control.frequency_config)
            : control.frequency_config;
        const daysInMonth = endDate.date();

        switch (frequency) {
            case 'daily':
                // Generate an instance for every day of the month
                for (let day = 1; day <= daysInMonth; day++) {
                    instanceDates.push(moment(`${year}-${month+1}-${day}`));
                }
                break;

            case 'weekly':
                // Parse the day of week from config
                const dayOfWeek = parseInt(config.dayOfWeek, 10);

                // Validate day of week to prevent infinite loops
                if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
                    console.error(`Invalid day of week value: ${config.dayOfWeek}`);
                    break;
                }

                // Use native Date object instead of moment for the calculation
                let currentDate = new Date(year, month, 1);

                // Move to first occurrence of the day of week
                while (currentDate.getDay() !== dayOfWeek) {
                    currentDate.setDate(currentDate.getDate() + 1);
                }

                // Add all occurrences in the month
                while (currentDate.getMonth() === month) {
                    // Convert to ISO date string and create a moment object from that
                    const dateStr = currentDate.toISOString().split('T')[0];
                    instanceDates.push(moment(dateStr));

                    // Move to next week
                    currentDate.setDate(currentDate.getDate() + 7);
                }

                break;

            case 'monthly':
                // Generate an instance for a specific day of the month
                const dayOfMonth = config.dayOfMonth;
                if (dayOfMonth <= daysInMonth) {
                    instanceDates.push(moment(`${year}-${month+1}-${dayOfMonth}`));
                }
                break;

            case 'yearly':
                // Only generate if this is the specified month
                if (month + 1 === config.month) {
                    const dayOfMonth = Math.min(config.dayOfMonth, daysInMonth);
                    instanceDates.push(moment(`${year}-${month+1}-${dayOfMonth}`));
                }
                break;

            case 'custom':
                // Generate for specific days of the week
                const daysOfWeek = config.daysOfWeek || [];
                for (const day of daysOfWeek) {
                    let date = moment(startDate);

                    // Move to the first occurrence of this day of week
                    while (date.day() !== day) {
                        date.add(1, 'day');
                    }

                    // Add all occurrences in the month
                    while (date.month() === month) {
                        instanceDates.push(moment(date));
                        date.add(7, 'days');
                    }
                }
                break;
        }

        // Get the current date for comparison
        const currentDate = moment().startOf('day');

        // Create instances in the database for each date
        let instancesCreated = 0;
        for (const date of instanceDates) {
            // Only process dates from today onward - preserves historical integrity
            if (date.isBefore(currentDate)) {
                continue; // Skip past dates
            }

            // Only create instances for dates after the control's start date
            if (control.start_date && moment(date).isBefore(moment(control.start_date))) {
                continue;
            }

            // Only create instances for dates before the control's end date (if any)
            if (control.end_date && moment(date).isAfter(moment(control.end_date))) {
                continue;
            }

            // Check if instance already exists
            const existingInstance = await db.query(
                `SELECT id FROM control_instances
                 WHERE location_control_id = $1 AND scheduled_date = $2`,
                [control.id, date.format('YYYY-MM-DD')]
            );

            if (existingInstance.rows.length === 0) {
                // Create new instance
                await db.query(
                    `INSERT INTO control_instances 
                     (location_control_id, scheduled_date, status, expires_at)
                     VALUES ($1, $2, $3, $4)`,
                    [
                        control.id,
                        date.format('YYYY-MM-DD'),
                        'pending',
                        date.endOf('day').toISOString()
                    ]
                );
                instancesCreated++;
            }
        }

        return { success: true, instancesCreated };
    } catch (error) {
        console.error('Error generating instances for control:', error);
        throw error;
    }
}

// Helper function to validate frequency config
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

module.exports = {
    generateInstancesForMonth,
    generateInstancesForControl,
    validateFrequencyConfig
};