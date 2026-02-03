const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { requireWhiteLabelFeature } = require('../../middleware/tierCheck');
const { uploadAsset, deleteAsset, getAssetUrl } = require('../../services/assetStorage');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max (overridden by individual asset limits)
  }
});

/**
 * Upload asset
 * POST /api/admin/assets/upload
 * Body: multipart/form-data with 'file' and 'type' fields
 */
router.post('/upload',
  requireAuth,
  requireAdmin,
  upload.single('file'),
  async (req, res) => {
    try {
      const { type } = req.body;
      const { agency, agencyUser } = req;

      if (!req.file) {
        return res.status(400).json({
          error: 'No file provided',
          code: 'NO_FILE'
        });
      }

      if (!type) {
        return res.status(400).json({
          error: 'Asset type required',
          code: 'NO_TYPE'
        });
      }

      // Validate asset type
      const validTypes = ['logo', 'favicon', 'login_background', 'email_header_logo'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: 'Invalid asset type',
          code: 'INVALID_TYPE',
          validTypes
        });
      }

      // Check tier permissions based on asset type
      let featureRequired = 'branding.logo_upload';
      if (type === 'favicon') {
        featureRequired = 'branding.favicon';
      } else if (type === 'login_background') {
        featureRequired = 'branding.login_customization';
      }

      // Manual tier check (instead of middleware for flexibility)
      const { supabaseAdmin } = require('../../services/supabase');
      const { hasFeatureAccess } = require('../../middleware/tierCheck');

      const { data: plan } = await supabaseAdmin
        .from('agency_plans')
        .select('white_label_tier')
        .eq('id', agency.plan_id)
        .single();

      const tier = plan?.white_label_tier || 'none';

      if (!hasFeatureAccess(tier, featureRequired)) {
        return res.status(403).json({
          error: 'Feature not available in your plan',
          code: 'FEATURE_LOCKED',
          feature: featureRequired,
          currentTier: tier,
          upgradeUrl: '/admin/settings/billing'
        });
      }

      // Upload asset
      const result = await uploadAsset(
        agency.id,
        req.file,
        type,
        agencyUser.id
      );

      // Update agency settings with new asset URL
      const currentSettings = agency.settings || {};
      const branding = currentSettings.branding || {};

      // Map asset type to settings key
      const settingsKeyMap = {
        logo: 'logo_url',
        favicon: 'favicon_url',
        login_background: 'login_background_url',
        email_header_logo: 'email_header_logo_url'
      };

      const settingsKey = settingsKeyMap[type];
      branding[settingsKey] = result.url;

      await supabaseAdmin
        .from('agencies')
        .update({
          settings: {
            ...currentSettings,
            branding
          }
        })
        .eq('id', agency.id);

      res.json({
        message: 'Asset uploaded successfully',
        asset: {
          type,
          url: result.url,
          fileName: result.fileName,
          size: result.size
        }
      });

    } catch (error) {
      console.error('Asset upload error:', error);
      res.status(500).json({
        error: error.message || 'Failed to upload asset',
        code: 'UPLOAD_FAILED'
      });
    }
  }
);

/**
 * Delete asset
 * DELETE /api/admin/assets/:type
 */
router.delete('/:type',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { type } = req.params;
      const { agency } = req;

      const validTypes = ['logo', 'favicon', 'login_background', 'email_header_logo'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: 'Invalid asset type',
          code: 'INVALID_TYPE'
        });
      }

      // Delete from storage
      const deleted = await deleteAsset(agency.id, type);

      if (!deleted) {
        return res.status(404).json({
          error: 'Asset not found',
          code: 'NOT_FOUND'
        });
      }

      // Update agency settings to remove asset URL
      const { supabaseAdmin } = require('../../services/supabase');
      const currentSettings = agency.settings || {};
      const branding = currentSettings.branding || {};

      const settingsKeyMap = {
        logo: 'logo_url',
        favicon: 'favicon_url',
        login_background: 'login_background_url',
        email_header_logo: 'email_header_logo_url'
      };

      const settingsKey = settingsKeyMap[type];
      delete branding[settingsKey];

      await supabaseAdmin
        .from('agencies')
        .update({
          settings: {
            ...currentSettings,
            branding
          }
        })
        .eq('id', agency.id);

      res.json({
        message: 'Asset deleted successfully',
        type
      });

    } catch (error) {
      console.error('Asset deletion error:', error);
      res.status(500).json({
        error: 'Failed to delete asset',
        code: 'DELETE_FAILED'
      });
    }
  }
);

/**
 * Get asset info
 * GET /api/admin/assets/:type
 */
router.get('/:type',
  requireAuth,
  async (req, res) => {
    try {
      const { type } = req.params;
      const { agency } = req;

      const url = await getAssetUrl(agency.id, type);

      if (!url) {
        return res.status(404).json({
          error: 'Asset not found',
          code: 'NOT_FOUND'
        });
      }

      res.json({
        type,
        url
      });

    } catch (error) {
      console.error('Asset retrieval error:', error);
      res.status(500).json({
        error: 'Failed to retrieve asset',
        code: 'RETRIEVAL_FAILED'
      });
    }
  }
);

module.exports = router;
