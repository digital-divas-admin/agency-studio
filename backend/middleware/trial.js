/**
 * Trial Management Middleware
 * Enforces trial expiration and subscription requirements
 */

const { logger } = require('../services/logger');

/**
 * Check if agency trial has expired
 * Blocks access if subscription is required but not active
 */
function checkTrialStatus(req, res, next) {
  const { agency } = req;

  // Allow bypass for specific routes (e.g., billing/subscription endpoints)
  if (req.skipTrialCheck) {
    return next();
  }

  if (!agency) {
    return next();
  }

  // Check subscription status
  const subscriptionStatus = agency.subscription_status;
  const trialEndsAt = agency.trial_ends_at ? new Date(agency.trial_ends_at) : null;
  const now = new Date();

  // Validate trial end date
  if (trialEndsAt && isNaN(trialEndsAt.getTime())) {
    logger.error(`Invalid trial_ends_at date for agency ${agency.id}: ${agency.trial_ends_at}`);
    // Treat invalid date as expired trial for security
    return res.status(403).json({
      error: 'Subscription configuration error',
      message: 'Please contact support to resolve your subscription status.',
      subscription_required: true
    });
  }

  // If trial has ended and no active subscription
  if (subscriptionStatus === 'trial' && trialEndsAt && trialEndsAt < now) {
    logger.warn(`Trial expired for agency ${agency.id} (${agency.name})`);

    return res.status(403).json({
      error: 'Trial expired',
      message: 'Your trial period has ended. Please subscribe to continue using the platform.',
      trial_ends_at: agency.trial_ends_at,
      subscription_required: true
    });
  }

  // If subscription is cancelled or past due
  if (['cancelled', 'past_due'].includes(subscriptionStatus)) {
    logger.warn(`Subscription ${subscriptionStatus} for agency ${agency.id} (${agency.name})`);

    return res.status(403).json({
      error: 'Subscription required',
      message: subscriptionStatus === 'past_due'
        ? 'Your payment is past due. Please update your payment method to continue.'
        : 'Your subscription has been cancelled. Please reactivate to continue using the platform.',
      subscription_status: subscriptionStatus,
      subscription_required: true
    });
  }

  // All good, continue
  next();
}

/**
 * Add trial info to response for active trials
 * Used in dashboard/status endpoints to show trial countdown
 */
function addTrialInfo(req, res, next) {
  const { agency } = req;

  if (!agency) {
    return next();
  }

  // Only add trial info if currently on trial
  if (agency.subscription_status === 'trial' && agency.trial_ends_at) {
    const trialEndsAt = new Date(agency.trial_ends_at);
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24)));

    // Attach to request for easy access in route handlers
    req.trialInfo = {
      is_trial: true,
      trial_ends_at: agency.trial_ends_at,
      days_remaining: daysRemaining,
      expired: daysRemaining === 0
    };
  } else {
    req.trialInfo = {
      is_trial: false,
      trial_ends_at: null,
      days_remaining: null,
      expired: false
    };
  }

  next();
}

/**
 * Skip trial check for specific routes
 * Used for subscription/billing endpoints
 */
function skipTrialCheck(req, res, next) {
  req.skipTrialCheck = true;
  next();
}

module.exports = {
  checkTrialStatus,
  addTrialInfo,
  skipTrialCheck
};
