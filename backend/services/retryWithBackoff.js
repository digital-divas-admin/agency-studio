/**
 * Retry with Exponential Backoff + Jitter
 * Extracted from Vixxxen's Seedream/NanoBanana patterns
 *
 * Jitter prevents thundering herd: without it, all retries from
 * multiple agency users synchronize and hammer the API together.
 */

const { logger } = require('./logger');

const DEFAULTS = {
  maxRetries: 5,
  initialBackoffMs: 5000,
  maxBackoffMs: 60000,
  jitterFactor: 0.3,
};

/**
 * Add jitter to a backoff value
 */
function addJitter(baseMs, jitterFactor) {
  const jitter = baseMs * jitterFactor * Math.random();
  return Math.floor(baseMs + jitter);
}

/**
 * Fetch with retry logic for rate limits and transient failures
 *
 * @param {string} url - URL to fetch
 * @param {object} options - fetch options
 * @param {object} retryOptions - retry configuration
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options, retryOptions = {}) {
  const {
    maxRetries = DEFAULTS.maxRetries,
    initialBackoffMs = DEFAULTS.initialBackoffMs,
    maxBackoffMs = DEFAULTS.maxBackoffMs,
    jitterFactor = DEFAULTS.jitterFactor,
  } = retryOptions;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429 && attempt < maxRetries) {
        const baseBackoff = Math.min(initialBackoffMs * Math.pow(2, attempt), maxBackoffMs);
        const backoffMs = addJitter(baseBackoff, jitterFactor);
        logger.debug(`Rate limited (429), retrying in ${(backoffMs / 1000).toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const baseBackoff = Math.min(initialBackoffMs * Math.pow(2, attempt), maxBackoffMs);
        const backoffMs = addJitter(baseBackoff, jitterFactor);
        logger.debug(`Request failed, retrying in ${(backoffMs / 1000).toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

module.exports = { fetchWithRetry, addJitter, DEFAULTS };
