const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { requireWhiteLabelFeature, hasFeatureAccess } = require('../../middleware/tierCheck');
const { supabaseAdmin } = require('../../services/supabase');

/**
 * Get current branding settings
 * GET /api/admin/branding
 */
router.get('/',
  requireAuth,
  async (req, res) => {
    try {
      const { agency } = req;

      const branding = agency.settings?.branding || {};
      const whiteLabelSettings = agency.settings?.white_label || {};

      // Get tier info
      const { data: plan } = await supabaseAdmin
        .from('agency_plans')
        .select('white_label_tier, white_label_features')
        .eq('id', agency.plan_id)
        .single();

      res.json({
        branding,
        whiteLabelSettings,
        tier: plan?.white_label_tier || 'none',
        availableFeatures: plan?.white_label_features || {}
      });

    } catch (error) {
      console.error('Get branding error:', error);
      res.status(500).json({
        error: 'Failed to retrieve branding settings',
        code: 'GET_FAILED'
      });
    }
  }
);

/**
 * Update branding settings
 * PUT /api/admin/branding
 * Body: { branding: {...}, whiteLabelSettings: {...} }
 */
router.put('/',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { agency } = req;
      const { branding = {}, whiteLabelSettings = {} } = req.body;

      // Get agency tier
      const { data: plan } = await supabaseAdmin
        .from('agency_plans')
        .select('white_label_tier')
        .eq('id', agency.plan_id)
        .single();

      const tier = plan?.white_label_tier || 'none';

      // Validate requested features against tier
      const requestedFeatures = [];

      // Check branding features
      if (branding.primary_color) requestedFeatures.push('branding.primary_color');
      if (branding.secondary_color) requestedFeatures.push('branding.secondary_color');
      if (branding.color_palette) requestedFeatures.push('branding.full_color_palette');
      if (branding.custom_css) requestedFeatures.push('branding.custom_css');
      if (branding.login_background_url) requestedFeatures.push('branding.login_customization');

      // Check white-label features
      if (whiteLabelSettings.hide_powered_by) requestedFeatures.push('ui.hide_powered_by');
      if (whiteLabelSettings.remove_all_platform_refs) requestedFeatures.push('ui.remove_platform_references');

      // Validate all requested features
      const lockedFeatures = requestedFeatures.filter(feature => !hasFeatureAccess(tier, feature));

      if (lockedFeatures.length > 0) {
        return res.status(403).json({
          error: 'Some features are not available in your plan',
          code: 'FEATURES_LOCKED',
          lockedFeatures,
          currentTier: tier,
          upgradeUrl: '/admin/settings/billing'
        });
      }

      // Sanitize custom CSS if provided
      if (branding.custom_css) {
        branding.custom_css = sanitizeCSS(branding.custom_css);
      }

      // Merge with existing settings
      const currentSettings = agency.settings || {};

      const updatedSettings = {
        ...currentSettings,
        branding: {
          ...(currentSettings.branding || {}),
          ...branding
        },
        white_label: {
          ...(currentSettings.white_label || {}),
          ...whiteLabelSettings
        }
      };

      // Update in database
      const { error: updateError } = await supabaseAdmin
        .from('agencies')
        .update({
          settings: updatedSettings
        })
        .eq('id', agency.id);

      if (updateError) {
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      res.json({
        message: 'Branding updated successfully',
        branding: updatedSettings.branding,
        whiteLabelSettings: updatedSettings.white_label
      });

    } catch (error) {
      console.error('Update branding error:', error);
      res.status(500).json({
        error: error.message || 'Failed to update branding',
        code: 'UPDATE_FAILED'
      });
    }
  }
);

/**
 * Sanitize custom CSS to remove dangerous patterns
 * @param {string} css - CSS string to sanitize
 * @returns {string} Sanitized CSS
 */
function sanitizeCSS(css) {
  if (!css || typeof css !== 'string') {
    return '';
  }

  // Remove dangerous patterns
  const dangerousPatterns = [
    /javascript:/gi,
    /@import/gi,
    /expression\s*\(/gi,
    /behavior\s*:/gi,
    /-moz-binding/gi,
    /vbscript:/gi,
    /data:text\/html/gi
  ];

  let sanitized = css;
  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Limit CSS length to prevent abuse
  const maxLength = 50000; // 50KB
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Reset branding to defaults
 * POST /api/admin/branding/reset
 */
router.post('/reset',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { agency } = req;

      const currentSettings = agency.settings || {};

      const updatedSettings = {
        ...currentSettings,
        branding: {},
        white_label: {}
      };

      await supabaseAdmin
        .from('agencies')
        .update({
          settings: updatedSettings
        })
        .eq('id', agency.id);

      res.json({
        message: 'Branding reset to defaults',
        branding: {},
        whiteLabelSettings: {}
      });

    } catch (error) {
      console.error('Reset branding error:', error);
      res.status(500).json({
        error: 'Failed to reset branding',
        code: 'RESET_FAILED'
      });
    }
  }
);

module.exports = router;
