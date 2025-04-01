const cron = require('node-cron');
const db = require('./config/db');
const instanceGenerator = require('./services/instanceGeneratorService');
const moment = require('moment');
const { generateControlInstances } = require('./services/controlScheduler');

// Schedule task to run at midnight on the 1st day of each month
cron.schedule('0 0 1 * *', async () => {
    try {
        const now = new Date();
        console.log(`Running scheduled instance generation for ${now.getFullYear()}-${now.getMonth() + 1}`);

        await instanceGenerator.generateInstancesForMonth(
            now.getFullYear(),
            now.getMonth()
        );

        console.log('Scheduled instance generation completed successfully');
    } catch (error) {
        console.error('Error in scheduled instance generation:', error);
    }
});

// Generate instances for tomorrow - runs at midnight every day
cron.schedule('0 0 * * *', async () => {
    try {
        console.log('Running scheduled task: Generate control instances for tomorrow');
        await generateControlInstances();
    } catch (error) {
        console.error('Error generating control instances:', error);
    }
});

// Add a daily check for controls that might have been missed
// Runs at 5 minutes past midnight every day
cron.schedule('5 0 * * *', async () => {
    try {
        const now = new Date();
        console.log(`Running daily check for missed instance generation`);

        // Get controls that were created/updated in the last 24 hours
        const recentControls = await db.query(
            `SELECT id FROM location_controls
             WHERE created_at >= NOW() - INTERVAL '1 day'
                OR updated_at >= NOW() - INTERVAL '1 day'`
        );

        for (const control of recentControls.rows) {
            await instanceGenerator.generateInstancesForControl(
                control.id,
                now.getFullYear(),
                now.getMonth()
            );
        }

        console.log(`Daily check completed: processed ${recentControls.rows.length} recent controls`);
    } catch (error) {
        console.error('Error in daily instance check:', error);
    }
});

// Add task to update expired control instances
// Runs at 15 minutes past midnight every day (after the other tasks finish)
cron.schedule('15 0 * * *', async () => {
    try {
        console.log('Running daily task: updating expired control instances');

        // Use PostgreSQL's date functions for reliable comparison
        const expiredInstances = await db.query(
            `UPDATE control_instances
             SET status = 'missed'
             WHERE status = 'pending'
             AND scheduled_date < CURRENT_DATE
             AND completed_at IS NULL
             RETURNING id, location_control_id, scheduled_date`,
            []  // No parameters needed, using CURRENT_DATE
        );

        console.log(`Updated ${expiredInstances.rows.length} expired control instances to 'missed' status`);

        // Create missed control records to document the missed controls
        for (const instance of expiredInstances.rows) {
            await db.query(
                `INSERT INTO missed_controls
                 (control_instance_id, reason, standard_excuse, reported_by, reported_at)
                 VALUES ($1, 'Automatically marked as missed', 'Control not completed on scheduled date', 'System', NOW())`,
                [instance.id]
            );
        }

        console.log(`Expired controls update completed: ${expiredInstances.rows.length} controls marked as missed`);
    } catch (error) {
        console.error('Error updating expired control instances:', error);
    }
});

// Run the update once when the application starts
(async function() {
    try {
        console.log('Running initial expired controls check on startup');

        const expiredInstances = await db.query(
            `UPDATE control_instances
             SET status = 'missed'
             WHERE status = 'pending'
             AND scheduled_date < CURRENT_DATE
             AND completed_at IS NULL
             RETURNING id, location_control_id, scheduled_date`
        );

        console.log(`Updated ${expiredInstances.rows.length} expired control instances to 'missed' status`);

        // Create missed control records
        for (const instance of expiredInstances.rows) {
            await db.query(
                `INSERT INTO missed_controls
                 (control_instance_id, reason, standard_excuse, reported_by, reported_at)
                 VALUES ($1, 'Automatically marked as missed', 'Control not completed on scheduled date', 'System', NOW())`,
                [instance.id]
            );
        }

        console.log('Initial expired controls check completed');
    } catch (error) {
        console.error('Error in initial expired controls check:', error);
    }
})();