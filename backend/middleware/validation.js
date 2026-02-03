/**
 * Input Validation Middleware
 * Provides validation functions for request data to prevent DoS and injection attacks
 */

const { logger } = require('../services/logger');

// Maximum allowed prompt length (2000 characters)
const MAX_PROMPT_LENGTH = 2000;

// Maximum allowed URL length
const MAX_URL_LENGTH = 2048;

/**
 * Validate prompt length to prevent DoS attacks with oversized inputs
 */
function validatePrompt(req, res, next) {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({
      error: 'Prompt is required',
    });
  }

  if (typeof prompt !== 'string') {
    return res.status(400).json({
      error: 'Prompt must be a string',
    });
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    logger.warn('Prompt length validation failed', {
      agencyId: req.agency?.id,
      userId: req.user?.id,
      promptLength: prompt.length,
      maxLength: MAX_PROMPT_LENGTH,
    });

    return res.status(400).json({
      error: `Prompt must be under ${MAX_PROMPT_LENGTH} characters (received ${prompt.length})`,
    });
  }

  next();
}

/**
 * Validate URL length and format
 */
function validateUrl(fieldName = 'url') {
  return (req, res, next) => {
    const url = req.body[fieldName];

    if (!url) {
      return res.status(400).json({
        error: `${fieldName} is required`,
      });
    }

    if (typeof url !== 'string') {
      return res.status(400).json({
        error: `${fieldName} must be a string`,
      });
    }

    if (url.length > MAX_URL_LENGTH) {
      return res.status(400).json({
        error: `${fieldName} must be under ${MAX_URL_LENGTH} characters`,
      });
    }

    // Basic URL format validation
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        error: `Invalid ${fieldName} format`,
      });
    }

    next();
  };
}

/**
 * Validate array length to prevent DoS attacks
 */
function validateArrayLength(fieldName, maxLength = 100) {
  return (req, res, next) => {
    const array = req.body[fieldName];

    if (array && Array.isArray(array) && array.length > maxLength) {
      return res.status(400).json({
        error: `${fieldName} must contain at most ${maxLength} items`,
      });
    }

    next();
  };
}

/**
 * Validate string field length
 */
function validateStringLength(fieldName, maxLength) {
  return (req, res, next) => {
    const value = req.body[fieldName];

    if (value && typeof value === 'string' && value.length > maxLength) {
      return res.status(400).json({
        error: `${fieldName} must be under ${maxLength} characters`,
      });
    }

    next();
  };
}

module.exports = {
  validatePrompt,
  validateUrl,
  validateArrayLength,
  validateStringLength,
  MAX_PROMPT_LENGTH,
  MAX_URL_LENGTH,
};
