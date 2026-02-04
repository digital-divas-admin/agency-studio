/**
 * Trends Routes
 * API endpoints for Instagram trends discovery feature
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logger } = require('../services/logger');

// Maximum workspace accounts per agency
const MAX_WORKSPACE_ACCOUNTS = 20;

// ============================================================================
// TRACKED ACCOUNTS
// ============================================================================

/**
 * GET /api/trends/accounts
 * List tracked accounts (global + workspace)
 */
router.get('/accounts', requireAuth, async (req, res) => {
  const { agency } = req;

  try {
    // Get global accounts
    const { data: globalAccounts, error: globalError } = await supabaseAdmin
      .from('tracked_accounts')
      .select('id, instagram_handle, display_name, profile_pic_url, account_type, last_scraped_at, scrape_error, is_active, created_at')
      .eq('account_type', 'global')
      .is('agency_id', null)
      .eq('is_active', true)
      .order('instagram_handle');

    if (globalError) {
      logger.error('Failed to fetch global accounts:', globalError);
      return res.status(500).json({ error: 'Failed to fetch accounts' });
    }

    // Get workspace accounts for this agency
    const { data: workspaceAccounts, error: workspaceError } = await supabaseAdmin
      .from('tracked_accounts')
      .select('id, instagram_handle, display_name, profile_pic_url, account_type, last_scraped_at, scrape_error, is_active, created_at, added_by_user_id')
      .eq('account_type', 'workspace')
      .eq('agency_id', agency.id)
      .eq('is_active', true)
      .order('instagram_handle');

    if (workspaceError) {
      logger.error('Failed to fetch workspace accounts:', workspaceError);
      return res.status(500).json({ error: 'Failed to fetch accounts' });
    }

    res.json({
      global: globalAccounts || [],
      workspace: workspaceAccounts || [],
      workspaceLimit: MAX_WORKSPACE_ACCOUNTS,
    });
  } catch (error) {
    logger.error('Error fetching tracked accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

/**
 * POST /api/trends/accounts
 * Add a workspace account (admin only)
 */
router.post('/accounts', requireAuth, requireAdmin, async (req, res) => {
  const { agency, agencyUser } = req;
  const { instagram_handle, display_name } = req.body;

  if (!instagram_handle) {
    return res.status(400).json({ error: 'Instagram handle is required' });
  }

  // Normalize handle (remove @ if present)
  const normalizedHandle = instagram_handle.replace('@', '').toLowerCase().trim();

  if (!normalizedHandle || normalizedHandle.length < 1) {
    return res.status(400).json({ error: 'Invalid Instagram handle' });
  }

  try {
    // Check workspace account limit
    const { count, error: countError } = await supabaseAdmin
      .from('tracked_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agency.id)
      .eq('account_type', 'workspace')
      .eq('is_active', true);

    if (countError) {
      logger.error('Failed to count workspace accounts:', countError);
      return res.status(500).json({ error: 'Failed to add account' });
    }

    if (count >= MAX_WORKSPACE_ACCOUNTS) {
      return res.status(400).json({
        error: `Maximum of ${MAX_WORKSPACE_ACCOUNTS} workspace accounts allowed`,
      });
    }

    // Check if already exists for this agency
    const { data: existing } = await supabaseAdmin
      .from('tracked_accounts')
      .select('id, is_active')
      .eq('instagram_handle', normalizedHandle)
      .eq('agency_id', agency.id)
      .single();

    if (existing) {
      if (existing.is_active) {
        return res.status(400).json({ error: 'Account already being tracked' });
      }

      // Reactivate the account
      const { data: reactivated, error: reactivateError } = await supabaseAdmin
        .from('tracked_accounts')
        .update({ is_active: true, scrape_error: null })
        .eq('id', existing.id)
        .select()
        .single();

      if (reactivateError) {
        logger.error('Failed to reactivate account:', reactivateError);
        return res.status(500).json({ error: 'Failed to add account' });
      }

      return res.status(201).json({ account: reactivated });
    }

    // Create new account
    const { data: account, error: createError } = await supabaseAdmin
      .from('tracked_accounts')
      .insert({
        instagram_handle: normalizedHandle,
        display_name: display_name || normalizedHandle,
        account_type: 'workspace',
        agency_id: agency.id,
        added_by_user_id: agencyUser.id,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      logger.error('Failed to create tracked account:', createError);
      return res.status(500).json({ error: 'Failed to add account' });
    }

    logger.info('Tracked account added', {
      agencyId: agency.id,
      handle: normalizedHandle,
      addedBy: agencyUser.id,
    });

    res.status(201).json({ account });
  } catch (error) {
    logger.error('Error adding tracked account:', error);
    res.status(500).json({ error: 'Failed to add account' });
  }
});

/**
 * DELETE /api/trends/accounts/:id
 * Remove a workspace account (admin only)
 */
router.delete('/accounts/:id', requireAuth, requireAdmin, async (req, res) => {
  const { agency } = req;
  const { id } = req.params;

  try {
    // Verify account belongs to this agency and is a workspace account
    const { data: account, error: fetchError } = await supabaseAdmin
      .from('tracked_accounts')
      .select('id, account_type, agency_id')
      .eq('id', id)
      .single();

    if (fetchError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (account.account_type === 'global') {
      return res.status(403).json({ error: 'Cannot remove global accounts' });
    }

    if (account.agency_id !== agency.id) {
      return res.status(403).json({ error: 'Account does not belong to this agency' });
    }

    // Soft delete (set is_active = false)
    const { error: deleteError } = await supabaseAdmin
      .from('tracked_accounts')
      .update({ is_active: false })
      .eq('id', id);

    if (deleteError) {
      logger.error('Failed to remove tracked account:', deleteError);
      return res.status(500).json({ error: 'Failed to remove account' });
    }

    logger.info('Tracked account removed', { agencyId: agency.id, accountId: id });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing tracked account:', error);
    res.status(500).json({ error: 'Failed to remove account' });
  }
});

// ============================================================================
// SAVED TRENDS (must be defined BEFORE /:id routes)
// ============================================================================

/**
 * GET /api/trends/saved
 * List saved trends for the agency
 */
router.get('/saved', requireAuth, async (req, res) => {
  const { agency } = req;
  const {
    limit: rawLimit = 20,
    offset: rawOffset = 0,
  } = req.query;

  try {
    const limit = Math.min(Math.max(parseInt(rawLimit) || 20, 1), 50);
    const offset = Math.max(parseInt(rawOffset) || 0, 0);

    const { data: savedTrends, error } = await supabaseAdmin
      .from('workspace_saved_trends')
      .select(`
        id,
        notes,
        created_at,
        trend_content (
          id,
          instagram_reel_id,
          reel_url,
          thumbnail_url,
          video_url,
          caption,
          audio_name,
          view_count,
          like_count,
          comment_count,
          posted_at,
          tracked_accounts (
            instagram_handle,
            display_name,
            profile_pic_url,
            account_type
          )
        )
      `)
      .eq('agency_id', agency.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to fetch saved trends:', error);
      return res.status(500).json({ error: 'Failed to fetch saved trends' });
    }

    // Get total count
    const { count } = await supabaseAdmin
      .from('workspace_saved_trends')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agency.id);

    // Flatten the response
    const items = (savedTrends || []).map(saved => ({
      saved_id: saved.id,
      notes: saved.notes,
      saved_at: saved.created_at,
      ...saved.trend_content,
      account: saved.trend_content?.tracked_accounts,
      is_saved: true,
    }));

    res.json({
      items,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error fetching saved trends:', error);
    res.status(500).json({ error: 'Failed to fetch saved trends' });
  }
});

/**
 * PUT /api/trends/saved/:id
 * Update notes on a saved trend
 */
router.put('/saved/:id', requireAuth, async (req, res) => {
  const { agency } = req;
  const { id } = req.params;
  const { notes } = req.body;

  try {
    const { data: updated, error } = await supabaseAdmin
      .from('workspace_saved_trends')
      .update({ notes: notes || null })
      .eq('id', id)
      .eq('agency_id', agency.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Saved trend not found' });
      }
      logger.error('Failed to update saved trend:', error);
      return res.status(500).json({ error: 'Failed to update saved trend' });
    }

    res.json({ saved: updated });
  } catch (error) {
    logger.error('Error updating saved trend:', error);
    res.status(500).json({ error: 'Failed to update saved trend' });
  }
});

/**
 * DELETE /api/trends/saved/:id
 * Remove a saved trend
 */
router.delete('/saved/:id', requireAuth, async (req, res) => {
  const { agency } = req;
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('workspace_saved_trends')
      .delete()
      .eq('id', id)
      .eq('agency_id', agency.id);

    if (error) {
      logger.error('Failed to delete saved trend:', error);
      return res.status(500).json({ error: 'Failed to remove saved trend' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing saved trend:', error);
    res.status(500).json({ error: 'Failed to remove saved trend' });
  }
});

// ============================================================================
// ADMIN ENDPOINTS (before /:id to avoid conflict)
// ============================================================================

/**
 * POST /api/trends/admin/scrape
 * Manually trigger a scrape (for testing)
 */
router.post('/admin/scrape', requireAuth, requireAdmin, async (req, res) => {
  try {
    const trendsScheduler = require('../services/trendsScheduler');
    const result = await trendsScheduler.triggerManualScrape();

    if (result?.skipped) {
      return res.status(409).json({
        message: 'Scrape skipped',
        reason: result.reason,
      });
    }

    res.json({
      message: 'Scrape triggered',
      result,
    });
  } catch (error) {
    logger.error('Failed to trigger manual scrape:', error);
    res.status(500).json({ error: 'Failed to trigger scrape' });
  }
});

// ============================================================================
// TREND CONTENT FEED
// ============================================================================

/**
 * GET /api/trends
 * List trends feed (paginated)
 */
router.get('/', requireAuth, async (req, res) => {
  const { agency } = req;
  const {
    limit: rawLimit = 20,
    offset: rawOffset = 0,
    source = 'all', // 'all', 'global', 'workspace'
  } = req.query;

  try {
    const limit = Math.min(Math.max(parseInt(rawLimit) || 20, 1), 50);
    const offset = Math.max(parseInt(rawOffset) || 0, 0);

    // Build the query based on source filter
    let accountIds = [];

    if (source === 'global' || source === 'all') {
      const { data: globalAccounts } = await supabaseAdmin
        .from('tracked_accounts')
        .select('id')
        .eq('account_type', 'global')
        .is('agency_id', null)
        .eq('is_active', true);

      accountIds.push(...(globalAccounts || []).map(a => a.id));
    }

    if (source === 'workspace' || source === 'all') {
      const { data: workspaceAccounts } = await supabaseAdmin
        .from('tracked_accounts')
        .select('id')
        .eq('account_type', 'workspace')
        .eq('agency_id', agency.id)
        .eq('is_active', true);

      accountIds.push(...(workspaceAccounts || []).map(a => a.id));
    }

    if (accountIds.length === 0) {
      return res.json({
        items: [],
        total: 0,
        limit,
        offset,
      });
    }

    // Fetch trend content
    let query = supabaseAdmin
      .from('trend_content')
      .select(`
        id,
        instagram_reel_id,
        reel_url,
        thumbnail_url,
        video_url,
        caption,
        audio_name,
        audio_url,
        view_count,
        like_count,
        comment_count,
        posted_at,
        scraped_at,
        tracked_accounts!inner (
          id,
          instagram_handle,
          display_name,
          profile_pic_url,
          account_type
        )
      `)
      .in('tracked_account_id', accountIds)
      .order('posted_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: items, error: itemsError } = await query;

    if (itemsError) {
      logger.error('Failed to fetch trend content:', itemsError);
      return res.status(500).json({ error: 'Failed to fetch trends' });
    }

    // Get total count
    const { count, error: countError } = await supabaseAdmin
      .from('trend_content')
      .select('*', { count: 'exact', head: true })
      .in('tracked_account_id', accountIds);

    if (countError) {
      logger.error('Failed to count trends:', countError);
    }

    // Get saved status for these items
    const itemIds = (items || []).map(i => i.id);
    let savedSet = new Set();

    if (itemIds.length > 0) {
      const { data: savedItems } = await supabaseAdmin
        .from('workspace_saved_trends')
        .select('trend_content_id')
        .eq('agency_id', agency.id)
        .in('trend_content_id', itemIds);

      savedSet = new Set((savedItems || []).map(s => s.trend_content_id));
    }

    // Add saved status to items
    const enrichedItems = (items || []).map(item => ({
      ...item,
      is_saved: savedSet.has(item.id),
      account: item.tracked_accounts,
    }));

    res.json({
      items: enrichedItems,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// ============================================================================
// PARAMETERIZED ROUTES (must be LAST to avoid conflicts)
// ============================================================================

/**
 * GET /api/trends/:id
 * Get single trend detail
 */
router.get('/:id', requireAuth, async (req, res) => {
  const { agency } = req;
  const { id } = req.params;

  try {
    const { data: item, error } = await supabaseAdmin
      .from('trend_content')
      .select(`
        *,
        tracked_accounts (
          id,
          instagram_handle,
          display_name,
          profile_pic_url,
          account_type,
          agency_id
        )
      `)
      .eq('id', id)
      .single();

    if (error || !item) {
      return res.status(404).json({ error: 'Trend not found' });
    }

    // Verify access: global accounts are accessible to all, workspace accounts only to their agency
    const account = item.tracked_accounts;
    if (account.account_type === 'workspace' && account.agency_id !== agency.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if saved
    const { data: saved } = await supabaseAdmin
      .from('workspace_saved_trends')
      .select('id, notes')
      .eq('agency_id', agency.id)
      .eq('trend_content_id', id)
      .single();

    res.json({
      ...item,
      account: item.tracked_accounts,
      is_saved: !!saved,
      saved_notes: saved?.notes || null,
    });
  } catch (error) {
    logger.error('Error fetching trend:', error);
    res.status(500).json({ error: 'Failed to fetch trend' });
  }
});

/**
 * POST /api/trends/:id/save
 * Save/bookmark a trend
 */
router.post('/:id/save', requireAuth, async (req, res) => {
  const { agency, agencyUser } = req;
  const { id } = req.params;
  const { notes } = req.body;

  try {
    // Verify trend exists and is accessible
    const { data: trend, error: trendError } = await supabaseAdmin
      .from('trend_content')
      .select('id, tracked_accounts(account_type, agency_id)')
      .eq('id', id)
      .single();

    if (trendError || !trend) {
      return res.status(404).json({ error: 'Trend not found' });
    }

    // Check access
    const account = trend.tracked_accounts;
    if (account.account_type === 'workspace' && account.agency_id !== agency.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Save the trend
    const { data: saved, error: saveError } = await supabaseAdmin
      .from('workspace_saved_trends')
      .upsert({
        agency_id: agency.id,
        trend_content_id: id,
        saved_by_user_id: agencyUser.id,
        notes: notes || null,
      }, {
        onConflict: 'agency_id,trend_content_id',
      })
      .select()
      .single();

    if (saveError) {
      logger.error('Failed to save trend:', saveError);
      return res.status(500).json({ error: 'Failed to save trend' });
    }

    logger.info('Trend saved', { agencyId: agency.id, trendId: id });

    res.status(201).json({ saved });
  } catch (error) {
    logger.error('Error saving trend:', error);
    res.status(500).json({ error: 'Failed to save trend' });
  }
});

/**
 * DELETE /api/trends/:id/save
 * Unsave a trend by content ID
 */
router.delete('/:id/save', requireAuth, async (req, res) => {
  const { agency } = req;
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('workspace_saved_trends')
      .delete()
      .eq('trend_content_id', id)
      .eq('agency_id', agency.id);

    if (error) {
      logger.error('Failed to unsave trend:', error);
      return res.status(500).json({ error: 'Failed to unsave trend' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error unsaving trend:', error);
    res.status(500).json({ error: 'Failed to unsave trend' });
  }
});

module.exports = router;
