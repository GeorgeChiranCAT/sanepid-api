const cron = require('node-cron');
const db = require('./config/db');
const instanceGenerator = require('./services/instanceGeneratorService');

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

// Add a daily check for controls that might have been missed
// Runs at midnight every day
cron.schedule('0 0 * * *', async () => {
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