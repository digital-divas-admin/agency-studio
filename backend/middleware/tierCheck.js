const { supabaseAdmin } = require('../services/supabase');

// Tier hierarchy for comparison
const TIER_HIERARCHY = {
  none: 0,
  basic: 1,
  professional: 2,
  enterprise: 3
};

// Maps feature paths to their required minimum tier
const FEATURE_TIER_MAP = {
  // Basic tier features
  'branding.logo_upload': 'basic',
  'branding.favicon': 'basic',
  'branding.primary_color': 'basic',

  // Professional tier features
  'branding.secondary_color': 'professional',
  'branding.login_customization': 'professional',
  'email.agency_name_sender': 'professional',
  'ui.hide_powered_by': 'professional',
  'domain.custom_domain': 'professional',

  // Enterprise tier features
  'branding.full_color_palette': 'enterprise',
  'branding.custom_css': 'enterprise',
  'email.custom_templates': 'enterprise',
  'ui.remove_platform_references': 'enterprise'
};

/**
 * Middleware to check if agency has access to a specific white-label feature
 * @param {string} featurePath - Dot notation path to feature (e.g., 'branding.logo_upload')
 * @returns {Function} Express middleware function
 */
function requireWhiteLabelFeature(featurePath) {
  return async (req, res, next) => {
    try {
      const { agency } = req;

      if (!agency) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHORIZED'
        });
      }

      // Fetch agency plan with white-label tier
      const { data: plan, error: planError } = await supabaseAdmin
        .from('agency_plans')
        .select('white_label_tier, white_label_features')
        .eq('id', agency.plan_id)
        .single();

      if (planError || !plan) {
        return res.status(500).json({
          error: 'Unable to verify plan tier',
          code: 'PLAN_CHECK_FAILED'
        });
      }

      const agencyTier = plan.white_label_tier || 'none';
      const requiredTier = FEATURE_TIER_MAP[featurePath];

      if (!requiredTier) {
        console.warn(`Unknown feature path: ${featurePath}`);
        return res.status(400).json({
          error: 'Invalid feature path',
          code: 'INVALID_FEATURE'
        });
      }

      // Check if agency tier meets requirement
      if (TIER_HIERARCHY[agencyTier] < TIER_HIERARCHY[requiredTier]) {
        return res.status(403).json({
          error: 'Feature not available in your plan',
          code: 'FEATURE_LOCKED',
          feature: featurePath,
          currentTier: agencyTier,
          requiredTier: requiredTier,
          upgradeUrl: '/admin/settings/billing'
        });
      }

      // Attach tier info to request for downstream use
      req.whiteLabelTier = agencyTier;
      req.whiteLabelFeatures = plan.white_label_features;

      next();
    } catch (error) {
      console.error('Tier check error:', error);
      res.status(500).json({
        error: 'Failed to verify feature access',
        code: 'TIER_CHECK_ERROR'
      });
    }
  };
}

/**
 * Check if a feature is available for a given tier (utility function)
 * @param {string} tier - Tier level (none, basic, professional, enterprise)
 * @param {string} featurePath - Feature path to check
 * @returns {boolean} True if feature is available
 */
function hasFeatureAccess(tier, featurePath) {
  const requiredTier = FEATURE_TIER_MAP[featurePath];
  if (!requiredTier) return false;
  return TIER_HIERARCHY[tier] >= TIER_HIERARCHY[requiredTier];
}

/**
 * Get all available features for a given tier
 * @param {string} tier - Tier level
 * @returns {string[]} Array of available feature paths
 */
function getAvailableFeatures(tier) {
  const tierLevel = TIER_HIERARCHY[tier];
  return Object.entries(FEATURE_TIER_MAP)
    .filter(([_, requiredTier]) => TIER_HIERARCHY[requiredTier] <= tierLevel)
    .map(([feature]) => feature);
}

module.exports = {
  requireWhiteLabelFeature,
  hasFeatureAccess,
  getAvailableFeatures,
  TIER_HIERARCHY,
  FEATURE_TIER_MAP
};
