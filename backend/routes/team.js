/**
 * Team Management Routes
 * Handles user invitations, role management, and team administration
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { requireAuth, requireAdmin, requireOwner } = require('../middleware/auth');
const { logger } = require('../services/logger');
const { createTeamInvitation } = require('../services/agencyProvisioning');
const { sendTeamInviteEmail } = require('../services/email');
const { validatePermissions, logTeamActivity } = require('../middleware/permissions');

/**
 * GET /api/team
 * List all team members with their permissions and assigned models
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { agency, agencyUser } = req;

    // All users can see team list, but only admins see email addresses
    const isAdmin = ['owner', 'admin'].includes(agencyUser.role);

    const { data: users, error } = await supabaseAdmin
      .from('agency_users')
      .select('id, name, email, role, status, credits_used_this_cycle, credit_limit, last_active_at, joined_at, permissions')
      .eq('agency_id', agency.id)
      .order('role', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      logger.error('Error fetching team:', error);
      return res.status(500).json({ error: 'Failed to fetch team' });
    }

    // Fetch assigned models for each user
    const usersWithModels = await Promise.all(users.map(async (user) => {
      if (user.permissions?.scope === 'all') {
        return {
          ...user,
          assigned_models: [],
          model_access: 'all'
        };
      }

      const { data: assignments } = await supabaseAdmin
        .from('user_model_assignments')
        .select(`
          model_id,
          agency_models (id, name, slug, avatar_url)
        `)
        .eq('user_id', user.id);

      return {
        ...user,
        assigned_models: (assignments || []).map(a => a.agency_models).filter(Boolean),
        model_access: 'assigned'
      };
    }));

    // Mask emails for non-admins
    const sanitizedUsers = usersWithModels.map((u) => ({
      ...u,
      email: isAdmin ? u.email : maskEmail(u.email),
    }));

    res.json({ users: sanitizedUsers });
  } catch (error) {
    logger.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

/**
 * POST /api/team/invite
 * Invite a new user to the agency (admin only)
 */
router.post('/invite', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { agency, agencyUser } = req;
    const { email, role = 'member', customMessage, assignedModels = [] } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate custom message length
    if (customMessage && customMessage.length > 500) {
      return res.status(400).json({ error: 'Custom message must be 500 characters or less' });
    }

    // Validate role - admins can only invite members, owners can invite anyone
    const allowedRoles = agencyUser.role === 'owner'
      ? ['member', 'admin']
      : ['member'];

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: `You cannot invite users with role: ${role}` });
    }

    // Validate assigned models belong to agency
    if (assignedModels.length > 0) {
      const { data: models } = await supabaseAdmin
        .from('agency_models')
        .select('id')
        .eq('agency_id', agency.id)
        .in('id', assignedModels);

      if (!models || models.length !== assignedModels.length) {
        return res.status(400).json({ error: 'Invalid model IDs provided' });
      }
    }

    // Check user limit
    const { count } = await supabaseAdmin
      .from('agency_users')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agency.id)
      .in('status', ['active', 'invited']);

    // Get plan limits
    const { data: plan } = await supabaseAdmin
      .from('agency_plans')
      .select('max_users')
      .eq('id', agency.plan_id)
      .single();

    if (plan && count >= plan.max_users) {
      return res.status(403).json({
        error: 'User limit reached',
        message: `Your plan allows ${plan.max_users} users. Please upgrade to add more.`,
      });
    }

    // Create invitation token
    const invitation = await createTeamInvitation({
      agencyId: agency.id,
      email: email.toLowerCase(),
      role,
      invitedBy: agencyUser.id,
      customMessage,
      assignedModels
    });

    // Send invitation email
    await sendTeamInviteEmail(agency, invitation, agencyUser);

    // Log activity
    await logTeamActivity({
      agencyId: agency.id,
      actorId: agencyUser.id,
      action: 'invite_sent',
      metadata: { email, role, has_custom_message: !!customMessage, models_count: assignedModels.length }
    });

    logger.info(`User ${email} invited to agency ${agency.id} by ${agencyUser.email}`);

    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation: {
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at
      }
    });
  } catch (error) {
    logger.error('Error inviting user:', error);

    // Handle specific errors
    if (error.message.includes('already a member') || error.message.includes('already been invited')) {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

/**
 * PUT /api/team/:userId
 * Update a team member (admin only)
 */
router.put('/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { agency, agencyUser } = req;
    const { userId } = req.params;
    const { name, role, credit_limit, status } = req.body;

    // Fetch target user
    const { data: targetUser, error: fetchError } = await supabaseAdmin
      .from('agency_users')
      .select('*')
      .eq('id', userId)
      .eq('agency_id', agency.id)
      .single();

    if (fetchError || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent self-demotion for owner
    if (targetUser.id === agencyUser.id && role && role !== agencyUser.role) {
      return res.status(403).json({ error: 'You cannot change your own role' });
    }

    // Only owner can change roles to/from admin
    if (role && (role === 'admin' || targetUser.role === 'admin') && agencyUser.role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can modify admin roles' });
    }

    // Cannot change owner's role
    if (targetUser.role === 'owner' && role && role !== 'owner') {
      return res.status(403).json({ error: 'Cannot change the owner\'s role' });
    }

    // Build update object
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined && role !== 'owner') updates.role = role;
    if (credit_limit !== undefined) updates.credit_limit = credit_limit;
    if (status !== undefined && ['active', 'suspended'].includes(status)) {
      // Cannot suspend owner
      if (targetUser.role === 'owner' && status === 'suspended') {
        return res.status(403).json({ error: 'Cannot suspend the owner' });
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('agency_users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating user:', updateError);
      return res.status(500).json({ error: 'Failed to update user' });
    }

    logger.info(`User ${userId} updated by ${agencyUser.email}: ${JSON.stringify(updates)}`);

    res.json({ user: updatedUser });
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/team/:userId
 * Remove a team member (admin only)
 */
router.delete('/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { agency, agencyUser } = req;
    const { userId } = req.params;

    // Fetch target user
    const { data: targetUser, error: fetchError } = await supabaseAdmin
      .from('agency_users')
      .select('*')
      .eq('id', userId)
      .eq('agency_id', agency.id)
      .single();

    if (fetchError || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot delete yourself
    if (targetUser.id === agencyUser.id) {
      return res.status(403).json({ error: 'You cannot remove yourself' });
    }

    // Cannot delete owner
    if (targetUser.role === 'owner') {
      return res.status(403).json({ error: 'Cannot remove the owner' });
    }

    // Only owner can delete admins
    if (targetUser.role === 'admin' && agencyUser.role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can remove admins' });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('agency_users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      logger.error('Error deleting user:', deleteError);
      return res.status(500).json({ error: 'Failed to remove user' });
    }

    logger.info(`User ${userId} removed from agency ${agency.id} by ${agencyUser.email}`);

    res.json({ message: 'User removed successfully' });
  } catch (error) {
    logger.error('Error removing user:', error);
    res.status(500).json({ error: 'Failed to remove user' });
  }
});

/**
 * GET /api/team/pending-invites
 * List pending invitations (admin only)
 */
router.get('/pending-invites', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { agency } = req;

    const { data: invites, error } = await supabaseAdmin
      .from('invitation_tokens')
      .select(`
        id,
        email,
        role,
        expires_at,
        created_at,
        custom_message,
        assigned_models,
        invited_by,
        agency_users!invitation_tokens_invited_by_fkey (name, email)
      `)
      .eq('agency_id', agency.id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching pending invites:', error);
      return res.status(500).json({ error: 'Failed to fetch invitations' });
    }

    // Enrich with model names if assigned_models present
    const enrichedInvites = await Promise.all(invites.map(async (invite) => {
      if (invite.assigned_models && invite.assigned_models.length > 0) {
        const { data: models } = await supabaseAdmin
          .from('agency_models')
          .select('id, name, slug')
          .in('id', invite.assigned_models);

        return {
          ...invite,
          assigned_models_details: models || []
        };
      }
      return { ...invite, assigned_models_details: [] };
    }));

    res.json({ invites: enrichedInvites });
  } catch (error) {
    logger.error('Error fetching pending invites:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

/**
 * POST /api/team/invite/:id/resend
 * Resend an invitation (admin only)
 */
router.post('/invite/:id/resend', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { agency, agencyUser } = req;
    const { id } = req.params;

    // Fetch invitation
    const { data: invitation, error: fetchError } = await supabaseAdmin
      .from('invitation_tokens')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agency.id)
      .is('accepted_at', null)
      .single();

    if (fetchError || !invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Extend expiry by 7 days from now
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 7);

    const { error: updateError } = await supabaseAdmin
      .from('invitation_tokens')
      .update({ expires_at: newExpiry.toISOString() })
      .eq('id', id);

    if (updateError) {
      logger.error('Error updating invitation expiry:', updateError);
      return res.status(500).json({ error: 'Failed to resend invitation' });
    }

    // Resend email
    await sendTeamInviteEmail(agency, { ...invitation, expires_at: newExpiry }, agencyUser);

    // Log activity
    await logTeamActivity({
      agencyId: agency.id,
      actorId: agencyUser.id,
      action: 'invite_resent',
      metadata: { email: invitation.email }
    });

    logger.info(`Invitation ${id} resent by ${agencyUser.email}`);

    res.json({
      message: 'Invitation resent successfully',
      expires_at: newExpiry
    });
  } catch (error) {
    logger.error('Error resending invitation:', error);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

/**
 * DELETE /api/team/invite/:id
 * Revoke a pending invitation (admin only)
 */
router.delete('/invite/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { agency, agencyUser } = req;
    const { id } = req.params;

    // Fetch invitation to get email for logging
    const { data: invitation } = await supabaseAdmin
      .from('invitation_tokens')
      .select('email')
      .eq('id', id)
      .eq('agency_id', agency.id)
      .single();

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const { error } = await supabaseAdmin
      .from('invitation_tokens')
      .delete()
      .eq('id', id)
      .eq('agency_id', agency.id);

    if (error) {
      logger.error('Error revoking invitation:', error);
      return res.status(500).json({ error: 'Failed to revoke invitation' });
    }

    // Log activity
    await logTeamActivity({
      agencyId: agency.id,
      actorId: agencyUser.id,
      action: 'invite_revoked',
      metadata: { email: invitation.email }
    });

    logger.info(`Invitation ${id} revoked by ${agencyUser.email}`);

    res.json({ message: 'Invitation revoked successfully' });
  } catch (error) {
    logger.error('Error revoking invitation:', error);
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
});

/**
 * PUT /api/team/:userId/permissions
 * Update user permissions (admin only)
 */
router.put('/:userId/permissions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { agency, agencyUser } = req;
    const { userId } = req.params;
    const { permissions } = req.body;

    if (!permissions) {
      return res.status(400).json({ error: 'Permissions object required' });
    }

    // Validate permissions structure
    const validation = validatePermissions(permissions);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid permissions', details: validation.errors });
    }

    // Fetch target user
    const { data: targetUser, error: fetchError } = await supabaseAdmin
      .from('agency_users')
      .select('*')
      .eq('id', userId)
      .eq('agency_id', agency.id)
      .single();

    if (fetchError || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot modify owner/admin permissions unless you're owner
    if ((targetUser.role === 'owner' || targetUser.role === 'admin') && agencyUser.role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can modify admin/owner permissions' });
    }

    // Update permissions
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('agency_users')
      .update({ permissions })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating permissions:', updateError);
      return res.status(500).json({ error: 'Failed to update permissions' });
    }

    // Log activity
    await logTeamActivity({
      agencyId: agency.id,
      actorId: agencyUser.id,
      action: 'permissions_updated',
      targetUserId: userId,
      metadata: { permissions }
    });

    logger.info(`Permissions updated for user ${userId} by ${agencyUser.email}`);

    res.json({ user: updatedUser });
  } catch (error) {
    logger.error('Error updating permissions:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

/**
 * PUT /api/team/:userId/models
 * Assign models to a user (admin only)
 */
router.put('/:userId/models', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { agency, agencyUser } = req;
    const { userId } = req.params;
    const { modelIds = [] } = req.body;

    // Fetch target user
    const { data: targetUser, error: fetchError } = await supabaseAdmin
      .from('agency_users')
      .select('*')
      .eq('id', userId)
      .eq('agency_id', agency.id)
      .single();

    if (fetchError || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate all model IDs belong to agency
    if (modelIds.length > 0) {
      const { data: models } = await supabaseAdmin
        .from('agency_models')
        .select('id')
        .eq('agency_id', agency.id)
        .in('id', modelIds);

      if (!models || models.length !== modelIds.length) {
        return res.status(400).json({ error: 'Invalid model IDs provided' });
      }
    }

    // Delete existing assignments
    await supabaseAdmin
      .from('user_model_assignments')
      .delete()
      .eq('user_id', userId);

    // Create new assignments
    if (modelIds.length > 0) {
      const assignments = modelIds.map(modelId => ({
        user_id: userId,
        model_id: modelId,
        assigned_by: agencyUser.id
      }));

      const { error: insertError } = await supabaseAdmin
        .from('user_model_assignments')
        .insert(assignments);

      if (insertError) {
        logger.error('Error creating assignments:', insertError);
        return res.status(500).json({ error: 'Failed to assign models' });
      }
    }

    // Log activity
    await logTeamActivity({
      agencyId: agency.id,
      actorId: agencyUser.id,
      action: modelIds.length > 0 ? 'models_assigned' : 'models_unassigned',
      targetUserId: userId,
      metadata: { model_ids: modelIds, count: modelIds.length }
    });

    logger.info(`Models assigned to user ${userId} by ${agencyUser.email}: ${modelIds.length} models`);

    res.json({ message: 'Models assigned successfully', count: modelIds.length });
  } catch (error) {
    logger.error('Error assigning models:', error);
    res.status(500).json({ error: 'Failed to assign models' });
  }
});

/**
 * GET /api/team/:userId/models
 * Get user's assigned models
 */
router.get('/:userId/models', requireAuth, async (req, res) => {
  try {
    const { agency } = req;
    const { userId } = req.params;

    // Verify user belongs to agency
    const { data: user } = await supabaseAdmin
      .from('agency_users')
      .select('permissions')
      .eq('id', userId)
      .eq('agency_id', agency.id)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If scope is 'all', return all agency models
    if (user.permissions?.scope === 'all') {
      const { data: allModels, error } = await supabaseAdmin
        .from('agency_models')
        .select('id, name, slug, avatar_url, status')
        .eq('agency_id', agency.id)
        .eq('status', 'active');

      if (error) {
        logger.error('Error fetching all models:', error);
        return res.status(500).json({ error: 'Failed to fetch models' });
      }

      return res.json({ models: allModels || [], access: 'all' });
    }

    // Otherwise, fetch assigned models
    const { data: assignments, error } = await supabaseAdmin
      .from('user_model_assignments')
      .select(`
        model_id,
        agency_models (
          id,
          name,
          slug,
          avatar_url,
          status
        )
      `)
      .eq('user_id', userId);

    if (error) {
      logger.error('Error fetching assigned models:', error);
      return res.status(500).json({ error: 'Failed to fetch assigned models' });
    }

    const models = (assignments || [])
      .map(a => a.agency_models)
      .filter(Boolean);

    res.json({ models, access: 'assigned' });
  } catch (error) {
    logger.error('Error fetching user models:', error);
    res.status(500).json({ error: 'Failed to fetch user models' });
  }
});

/**
 * GET /api/team/activity
 * Get team activity log (admin only)
 */
router.get('/activity', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { agency } = req;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const { data: activities, error } = await supabaseAdmin
      .from('team_activity_log')
      .select(`
        id,
        action,
        created_at,
        metadata,
        actor:agency_users!team_activity_log_actor_id_fkey (id, name, email),
        target:agency_users!team_activity_log_target_user_id_fkey (id, name, email)
      `)
      .eq('agency_id', agency.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Error fetching activity log:', error);
      return res.status(500).json({ error: 'Failed to fetch activity log' });
    }

    // Get total count for pagination
    const { count } = await supabaseAdmin
      .from('team_activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agency.id);

    res.json({
      activities: activities || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Error fetching activity log:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

/**
 * Helper: Mask email for privacy
 */
function maskEmail(email) {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${local[1]}***@${domain}`;
}

module.exports = router;
