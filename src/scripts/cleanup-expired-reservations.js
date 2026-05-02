const cron = require('node-cron');
const inventoryService = require('../services/inventoryService');
const { sweepExpiredSessions } = require('../services/paymentsService');

let cronJob = null;

/**
 * Initialize the cron job that cleans up expired stock reservations
 * Runs every 5 minutes
 */
function initializeCleanupCron() {
  if (cronJob) {
    console.log('[Inventory] Cleanup cron job already initialized');
    return;
  }

  // Run cleanup every 5 minutes
  cronJob = cron.schedule('*/5 * * * *', async () => {
    try {
      const deleted = await inventoryService.deleteExpiredReservations();
      await sweepExpiredSessions();
      if (deleted > 0) {
        console.log(`[Inventory] Cleaned up ${deleted} expired stock reservation(s)`);
      }
    } catch (err) {
      console.error('[Inventory] Cleanup cron job failed:', err);
    }
  });

  console.log('[Inventory] Cleanup cron job initialized - runs every 5 minutes');
}

/**
 * Stop the cron job (useful for graceful shutdown)
 */
function stopCleanupCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('[Inventory] Cleanup cron job stopped');
  }
}

module.exports = {
  initializeCleanupCron,
  stopCleanupCron,
};
