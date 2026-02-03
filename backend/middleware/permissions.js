/**
 * Permissions Middleware
 * Provides granular permission checks for team members
 */

const { getSupabaseAdmin } = require('../services/supabase');

/**
 * Check if user has a specific permission
 * @param {string} permissionKey - The permission to check (e.g., 'can_view_analytics')
 * @returns {Function} Express middleware
 */
function hasPermission(permissionKey) {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Owners and admins with 'all' scope have all permissions
      if (user.role === 'owner' || user.role === 'admin') {
        const scope = user.permissions?.scope || 'all';
        if (scope === 'all') {
          return next();
        }
      }

      // Check specific permission
      const hasPermissionValue = user.permissions?.[permissionKey];

      if (hasPermissionValue === true) {
        return next();
      }

      return res.status(403).json({
        error: 'Permission denied',
        message: `You don't have permission to perform this action (${permissionKey})`,
        required_permission: permissionKey
      });
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Failed to check permissions' });
    }
  };
}

/**
 * Check if user can access a specific model
 * Expects req.params.modelId to be present
 * @returns {Function} Express middleware
 */
async function requireModelAccess(req, res, next) {
  try {
    const user = req.user;
    const modelId = req.params.modelId || req.body.modelId || req.query.modelId;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!modelId) {
      return res.status(400).json({ error: 'Model ID required' });
    }

    // Owners and admins with 'all' scope can access all models
    if ((user.role === 'owner' || user.role === 'admin') && user.permissions?.scope === 'all') {
      return next();
    }

    // Check if user has access to this specific model
    const supabase = getSupabaseAdmin();

    const { data: hasAccess, error } = await supabase.rpc('user_can_access_model', {
      p_user_id: user.id,
      p_model_id: modelId
    });

    if (error) {
      console.error('Error checking model access:', error);
      return res.status(500).json({ error: 'Failed to verify model access' });
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this creator'
      });
    }

    return next();
  } catch (error) {
    console.error('Model access check error:', error);
    return res.status(500).json({ error: 'Failed to check model access' });
  }
}

/**
 * Load user's assigned models and attach to request
 * Useful for filtering queries to only show accessible models
 * @returns {Function} Express middleware
 */
async function loadUserModels(req, res, next) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // If scope is 'all', load all agency models
    if (user.permissions?.scope === 'all') {
      const supabase = getSupabaseAdmin();
      const { data: models, error } = await supabase
        .from('agency_models')
        .select('id, name, slug, avatar_url')
        .eq('agency_id', user.agency_id)
        .eq('status', 'active');

      if (error) {
        console.error('Error loading all models:', error);
        return res.status(500).json({ error: 'Failed to load models' });
      }

      req.userModels = models || [];
      return next();
    }

    // Otherwise, load only assigned models
    const supabase = getSupabaseAdmin();
    const { data: assignments, error } = await supabase
      .from('user_model_assignments')
      .select(`
        model_id,
        agency_models (
          id,
          name,
          slug,
          avatar_url
        )
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error loading assigned models:', error);
      return res.status(500).json({ error: 'Failed to load assigned models' });
    }

    req.userModels = (assignments || [])
      .map(a => a.agency_models)
      .filter(Boolean);

    return next();
  } catch (error) {
    console.error('Load user models error:', error);
    return res.status(500).json({ error: 'Failed to load user models' });
  }
}

/**
 * Validate permission object structure
 * @param {Object} permissions - The permissions object to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validatePermissions(permissions) {
  const errors = [];

  if (!permissions || typeof permissions !== 'object') {
    errors.push('Permissions must be an object');
    return { valid: false, errors };
  }

  const validScopes = ['all', 'assigned'];
  if (permissions.scope && !validScopes.includes(permissions.scope)) {
    errors.push(`Invalid scope. Must be one of: ${validScopes.join(', ')}`);
  }

  const booleanPermissions = [
    'can_view_analytics',
    'can_send_messages',
    'can_upload_content',
    'can_publish_content',
    'can_view_subscribers',
    'can_export_data',
    'can_edit_profiles'
  ];

  for (const key of Object.keys(permissions)) {
    if (key === 'scope') continue;

    if (!booleanPermissions.includes(key)) {
      errors.push(`Unknown permission key: ${key}`);
    } else if (typeof permissions[key] !== 'boolean') {
      errors.push(`Permission ${key} must be a boolean`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Log team activity
 * @param {Object} params - Activity log parameters
 * @param {string} params.agencyId - Agency ID
 * @param {string} params.actorId - User who performed the action
 * @param {string} params.action - Action type
 * @param {string} params.targetUserId - Target user (optional)
 * @param {Object} params.metadata - Additional context (optional)
 */
async function logTeamActivity({ agencyId, actorId, action, targetUserId = null, metadata = {} }) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('team_activity_log').insert({
      agency_id: agencyId,
      actor_id: actorId,
      action,
      target_user_id: targetUserId,
      metadata
    });
  } catch (error) {
    console.error('Failed to log team activity:', error);
    // Don't throw - logging failure shouldn't break the main operation
  }
}

module.exports = {
  hasPermission,
  requireModelAccess,
  loadUserModels,
  validatePermissions,
  logTeamActivity
};
