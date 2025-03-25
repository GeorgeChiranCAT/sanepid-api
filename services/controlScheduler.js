const db = require('../config/db');

// Function to determine if an instance should be generated for the given date
function shouldGenerateInstance(control, date) {
    const dayOfWeek = date.getDay(); // 0-6 (Sunday-Saturday)
    const dayOfMonth = date.getDate(); // 1-31
    const month = date.getMonth() + 1; // 1-12

    const config = control.frequency_config;

    switch (control.frequency_type) {
        case 'daily':
            return true;

        case 'weekly':
            return dayOfWeek === config.dayOfWeek;

        case 'monthly':
            return dayOfMonth === config.dayOfMonth;

        case 'yearly':
            return month === config.month && dayOfMonth === config.dayOfMonth;

        case 'custom':
            return config.daysOfWeek.includes(dayOfWeek);

        default:
            return false;
    }
}

// Main scheduler function to generate control instances
async function generateControlInstances() {
    try {
        const currentDate = new Date();
        const tomorrow = new Date(currentDate);
        tomorrow.setDate(currentDate.getDate() + 1);

        // Format date for PostgreSQL
        const tomorrowFormatted = tomorrow.toISOString().split('T')[0];

        console.log(`Generating control instances for ${tomorrowFormatted}`);

        // Get all active location controls
        const activeControls = await db.query(
            `SELECT * FROM location_controls 
             WHERE is_active = true 
             AND (end_date IS NULL OR end_date >= $1)`,
            [tomorrowFormatted]
        );

        let instancesCreated = 0;

        for (const control of activeControls.rows) {
            // Check if control should generate an instance for tomorrow
            if (shouldGenerateInstance(control, tomorrow)) {
                // Check if instance already exists for this control and date
                const existingInstance = await db.query(
                    `SELECT 1 FROM control_instances 
                     WHERE location_control_id = $1 AND scheduled_date = $2`,
                    [control.id, tomorrowFormatted]
                );

                if (existingInstance.rows.length === 0) {
                    // Create a new instance
                    const expiryDate = new Date(tomorrow);
                    expiryDate.setHours(23, 59, 59, 999); // End of the day

                    await db.query(
                        `INSERT INTO control_instances
                         (location_control_id, scheduled_date, status, expires_at)
                         VALUES ($1, $2, 'pending', $3)`,
                        [control.id, tomorrowFormatted, expiryDate.toISOString()]
                    );

                    instancesCreated++;
                }
            }
        }

        console.log(`Created ${instancesCreated} control instances for ${tomorrowFormatted}`);
    } catch (error) {
        console.error('Error generating control instances:', error);
    }
}

// Export for use in scheduler
module.exports = {
    generateControlInstances
};