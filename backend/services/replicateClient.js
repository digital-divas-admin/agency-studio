/**
 * Replicate API Client
 * Thin wrapper with consistent error handling for all Replicate-based routes
 * (WAN, Veo, BG Remover, Eraser, Qwen Edit)
 *
 * Handles Replicate's dual output format: File objects with .url() vs direct URL strings
 */

const Replicate = require('replicate');
const { logger } = require('./logger');
const { config } = require('../config');

let _replicate = null;

/**
 * Get or create Replicate client (lazy singleton)
 */
function getClient() {
  if (!_replicate) {
    if (!config.replicate.apiKey) {
      throw new Error('Replicate API key not configured');
    }
    _replicate = new Replicate({ auth: config.replicate.apiKey });
  }
  return _replicate;
}

/**
 * Run a Replicate model with consistent error handling
 *
 * @param {string} model - Model identifier (e.g., "wan-video/wan-2.2-i2v-a14b")
 * @param {object} input - Model input parameters
 * @returns {Promise<any>} - Model output
 */
async function runModel(model, input) {
  const replicate = getClient();

  try {
    const output = await replicate.run(model, { input });
    return output;
  } catch (error) {
    // Map Replicate errors to consistent HTTP status codes
    const mappedError = mapReplicateError(error);
    throw mappedError;
  }
}

/**
 * Extract URL from Replicate output
 * Replicate can return File objects (with .url() method) or direct URL strings
 */
function extractOutputUrl(output) {
  if (!output) return null;

  // Direct string URL
  if (typeof output === 'string') {
    return output;
  }

  // File object with .url() method
  if (typeof output === 'object' && typeof output.url === 'function') {
    return output.url();
  }

  // Object with url property
  if (typeof output === 'object' && output.url) {
    return output.url;
  }

  return null;
}

/**
 * Extract URLs from array output (e.g., Qwen Edit returns multiple images)
 */
function extractOutputUrls(output) {
  if (!output) return [];

  if (Array.isArray(output)) {
    return output.map(item => extractOutputUrl(item)).filter(Boolean);
  }

  const single = extractOutputUrl(output);
  return single ? [single] : [];
}

/**
 * Map Replicate API errors to application errors with status codes
 */
function mapReplicateError(error) {
  const message = error.message || '';

  if (message.includes('Invalid input')) {
    const err = new Error(message);
    err.statusCode = 400;
    err.type = 'INVALID_INPUT';
    return err;
  }

  if (message.includes('Rate limit')) {
    const err = new Error('Rate limit exceeded. Please try again in a moment.');
    err.statusCode = 429;
    err.type = 'RATE_LIMIT';
    return err;
  }

  if (message.includes('authentication') || message.includes('Unauthorized')) {
    const err = new Error('Replicate API authentication failed');
    err.statusCode = 401;
    err.type = 'AUTH_ERROR';
    return err;
  }

  // Preserve original error, add default status
  error.statusCode = error.statusCode || 500;
  error.type = error.type || 'API_ERROR';
  return error;
}

module.exports = {
  getClient,
  runModel,
  extractOutputUrl,
  extractOutputUrls,
  mapReplicateError,
};
