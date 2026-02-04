/**
 * Trends Scheduler Service
 *
 * Polls every 12 hours to scrape Instagram Reels from tracked accounts.
 * Uses the same setInterval pattern as workflowScheduler.js.
 */

const { logger } = require('./logger');
const { config } = require('../config');

// Default: 12 hours in milliseconds
const DEFAULT_POLL_INTERVAL_MS = 12 * 60 * 60 * 1000;

let _intervalId = null;
let _isRunning = false;

/**
 * Start the scheduler. Call once at server boot.
 */
function start() {
  if (_intervalId) {
    logger.warn('Trends scheduler already running');
    return;
  }

  const pollIntervalMs = config.trends?.scrapeIntervalMs || DEFAULT_POLL_INTERVAL_MS;

  logger.info('Trends scheduler started', {
    pollIntervalMs,
    pollIntervalHours: pollIntervalMs / (60 * 60 * 1000),
  });

  // Run immediately on startup (delayed slightly to let server fully start)
  setTimeout(() => {
    runScrape().catch((err) => {
      logger.error('Trends scheduler initial scrape failed:', err.message);
    });
  }, 10000); // 10 second delay

  // Then run every 12 hours
  _intervalId = setInterval(() => {
    runScrape().catch((err) => {
      logger.error('Trends scheduler scrape failed:', err.message);
    });
  }, pollIntervalMs);
}

/**
 * Stop the scheduler. Call on graceful shutdown.
 */
function stop() {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
    logger.info('Trends scheduler stopped');
  }
}

/**
 * Run the scrape job
 */
async function runScrape() {
  // Prevent concurrent runs
  if (_isRunning) {
    logger.warn('Trends scrape already in progress, skipping');
    return;
  }

  _isRunning = true;

  try {
    logger.info('Trends scheduler triggering scrape');

    // Lazy-load to avoid circular dependencies
    const { scrapeAllAccounts } = require('./trendsScraper');
    const result = await scrapeAllAccounts();

    if (result.skipped) {
      logger.info('Trends scrape skipped:', result.reason);
    } else if (result.error) {
      logger.error('Trends scrape completed with error:', result.error);
    } else {
      logger.info('Trends scrape completed successfully', {
        accountsProcessed: result.accountsProcessed,
        reelsSaved: result.reelsSaved,
      });
    }
  } finally {
    _isRunning = false;
  }
}

/**
 * Check if the scheduler is running
 */
function isRunning() {
  return !!_intervalId;
}

/**
 * Manually trigger a scrape (for admin/testing purposes)
 */
async function triggerManualScrape() {
  if (_isRunning) {
    return { skipped: true, reason: 'Scrape already in progress' };
  }

  return runScrape();
}

module.exports = {
  start,
  stop,
  isRunning,
  triggerManualScrape,
};
