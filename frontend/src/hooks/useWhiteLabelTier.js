import { useAgency } from '../context/AgencyContext';

// Tier hierarchy for comparison
const TIER_HIERARCHY = {
  none: 0,
  basic: 1,
  professional: 2,
  enterprise: 3
};

// Feature definitions by tier (cumulative - higher tiers include all lower tier features)
const TIER_FEATURES = {
  none: [],
  basic: [
    'logo_upload',
    'favicon',
    'primary_color'
  ],
  professional: [
    'logo_upload',
    'favicon',
    'primary_color',
    'secondary_color',
    'login_customization',
    'hide_powered_by',
    'custom_domain',
    'agency_name_sender'
  ],
  enterprise: [
    'logo_upload',
    'favicon',
    'primary_color',
    'secondary_color',
    'login_customization',
    'hide_powered_by',
    'custom_domain',
    'agency_name_sender',
    'full_color_palette',
    'custom_css',
    'remove_platform_refs',
    'custom_templates'
  ]
};

/**
 * Hook to access white-label tier information and feature availability
 * @returns {Object} Tier utilities
 */
export function useWhiteLabelTier() {
  const { agency } = useAgency();

  // Get current tier from agency plan
  const tier = agency?.plan?.white_label_tier || 'none';
  const tierLevel = TIER_HIERARCHY[tier];

  /**
   * Check if agency has access to a specific feature
   * @param {string} featureName - Feature name to check
   * @returns {boolean} True if feature is available
   */
  const hasFeature = (featureName) => {
    return TIER_FEATURES[tier]?.includes(featureName) || false;
  };

  /**
   * Check if a feature is locked (not available in current tier)
   * @param {string} featureName - Feature name to check
   * @returns {boolean} True if feature is locked
   */
  const isLocked = (featureName) => {
    return !hasFeature(featureName);
  };

  /**
   * Get the tier required for a specific feature
   * @param {string} featureName - Feature name
   * @returns {string|null} Required tier name or null if not found
   */
  const getRequiredTier = (featureName) => {
    for (const [tierName, features] of Object.entries(TIER_FEATURES)) {
      if (features.includes(featureName)) {
        return tierName;
      }
    }
    return null;
  };

  /**
   * Check if current tier meets minimum requirement
   * @param {string} requiredTier - Required tier name
   * @returns {boolean} True if current tier is sufficient
   */
  const meetsMinimumTier = (requiredTier) => {
    const requiredLevel = TIER_HIERARCHY[requiredTier];
    return tierLevel >= requiredLevel;
  };

  /**
   * Get all available features for current tier
   * @returns {string[]} Array of available feature names
   */
  const getAvailableFeatures = () => {
    return TIER_FEATURES[tier] || [];
  };

  /**
   * Get branding settings from agency
   * @returns {Object} Branding configuration
   */
  const getBranding = () => {
    return agency?.settings?.branding || {};
  };

  /**
   * Get white-label settings from agency
   * @returns {Object} White-label configuration
   */
  const getWhiteLabelSettings = () => {
    return agency?.settings?.white_label || {};
  };

  /**
   * Check if platform branding should be hidden
   * @returns {boolean} True if powered by footer should be hidden
   */
  const shouldHidePoweredBy = () => {
    return hasFeature('hide_powered_by') &&
           getWhiteLabelSettings().hide_powered_by === true;
  };

  /**
   * Check if all platform references should be removed
   * @returns {boolean} True if all platform references should be removed
   */
  const shouldRemovePlatformRefs = () => {
    return hasFeature('remove_platform_refs') &&
           getWhiteLabelSettings().remove_all_platform_refs === true;
  };

  return {
    tier,
    tierLevel,
    hasFeature,
    isLocked,
    getRequiredTier,
    meetsMinimumTier,
    getAvailableFeatures,
    getBranding,
    getWhiteLabelSettings,
    shouldHidePoweredBy,
    shouldRemovePlatformRefs
  };
}
