// Set up scheduled task for generating control instances
const { generateControlInstances } = require('./services/controlScheduler');
const cron = require('node-cron');

// Run at midnight every day
cron.schedule('0 0 * * *', () => {
    console.log('Running scheduled task: Generate control instances');
    generateControlInstances();
});



// For development/testing, you can also run immediately on startup
// generateControlInstances();