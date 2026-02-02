/**
 * Agency Routes
 * Handles agency configuration and management
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getCreditBalance } = require('../middleware/credits');
const { logger } = require('../services/logger');

/**
 * GET /api/agency/config
 * Returns agency configuration for frontend theming
 * Public route - no auth required
 */
router.get('/config', async (req, res) => {
  try {
    const { agency } = req;

    if (!agency) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    // Parse settings if stored as string
    const settings = typeof agency.settings === 'string'
      ? JSON.parse(agency.settings)
      : agency.settings || {};

    res.json({
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      branding: settings.branding || {
        logo_url: null,
        favicon_url: null,
        app_name: agency.name,
        primary_color: '#6366f1',
        secondary_color: '#4f46e5',
      },
      features: settings.features || {
        image_gen: true,
        video_gen: true,
        editing: true,
        chat: true,
        nsfw_enabled: true,
        models_allowed: ['seedream', 'nanoBanana', 'qwen', 'kling', 'wan', 'veo'],
      },
    });
  } catch (error) {
    logger.error('Error fetching agency config:', error);
    res.status(500).json({ error: 'Failed to fetch agency configuration' });
  }
});

/**
 * GET /api/agency/me
 * Returns current user's agency membership info
 * Requires authentication
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { agency, agencyUser, user } = req;

    const creditBalance = await getCreditBalance(agency, agencyUser);

    res.json({
      user: {
        id: agencyUser.id,
        email: user.email,
        name: agencyUser.name,
        role: agencyUser.role,
        avatar_url: agencyUser.avatar_url,
      },
      agency: {
        id: agency.id,
        name: agency.name,
        slug: agency.slug,
      },
      credits: creditBalance,
    });
  } catch (error) {
    logger.error('Error fetching user info:', error);
    res.status(500).json({ error: 'Failed to fetch user information' });
  }
});

/**
 * PUT /api/agency/settings
 * Update agency settings (admin only)
 */
router.put('/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { agency } = req;
    const { branding, features } = req.body;

    // Get current settings
    const currentSettings = typeof agency.settings === 'string'
      ? JSON.parse(agency.settings)
      : agency.settings || {};

    // Merge updates
    const newSettings = {
      ...currentSettings,
      branding: branding ? { ...currentSettings.branding, ...branding } : currentSettings.branding,
      features: features ? { ...currentSettings.features, ...features } : currentSettings.features,
    };

    const { data, error } = await supabaseAdmin
      .from('agencies')
      .update({ settings: newSettings })
      .eq('id', agency.id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating agency settings:', error);
      return res.status(500).json({ error: 'Failed to update settings' });
    }

    res.json({
      message: 'Settings updated successfully',
      settings: newSettings,
    });
  } catch (error) {
    logger.error('Error updating agency settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * GET /api/agency/usage
 * Get agency usage statistics (admin only)
 */
router.get('/usage', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { agency } = req;

    // Get aggregated usage stats
    const { data: generations, error: genError } = await supabaseAdmin
      .from('generations')
      .select('type, model, credits_cost, created_at')
      .eq('agency_id', agency.id)
      .gte('created_at', agency.billing_cycle_start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (genError) {
      logger.error('Error fetching generations:', genError);
    }

    // Get per-user usage
    const { data: userUsage, error: userError } = await supabaseAdmin
      .from('agency_users')
      .select('id, name, email, credits_used_this_cycle, credit_limit')
      .eq('agency_id', agency.id)
      .eq('status', 'active')
      .order('credits_used_this_cycle', { ascending: false });

    if (userError) {
      logger.error('Error fetching user usage:', userError);
    }

    // Aggregate by type
    const byType = {};
    const byModel = {};
    (generations || []).forEach((gen) => {
      byType[gen.type] = (byType[gen.type] || 0) + gen.credits_cost;
      byModel[gen.model] = (byModel[gen.model] || 0) + gen.credits_cost;
    });

    res.json({
      agency: {
        credit_pool: agency.credit_pool,
        credits_used_this_cycle: agency.credits_used_this_cycle,
        monthly_credit_allocation: agency.monthly_credit_allocation,
      },
      usage: {
        byType,
        byModel,
        totalGenerations: (generations || []).length,
      },
      users: userUsage || [],
    });
  } catch (error) {
    logger.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

/**
 * GET /api/agency/dashboard
 * Aggregated dashboard data: models with stats, recent activity, alerts
 */
router.get('/dashboard', requireAuth, async (req, res) => {
  const { agency, agencyUser } = req;

  try {
    // All queries run in a single parallel batch
    const [
      creditBalance,
      modelsResult,
      galleryResult,
      runsResult,
      pendingReviewsResult,
      triggersResult,
    ] = await Promise.all([
      getCreditBalance(agency, agencyUser),

      // Models with embedded counts — Postgres does the counting server-side
      supabaseAdmin
        .from('agency_models')
        .select('id, name, slug, avatar_url, onlyfans_handle, gallery_items(count), workflows(count)')
        .eq('agency_id', agency.id)
        .eq('status', 'active')
        .order('name'),

      // Recent gallery items (6 for larger thumbnails)
      supabaseAdmin
        .from('gallery_items')
        .select('id, url, thumbnail_url, type, model_id, title, created_at')
        .eq('agency_id', agency.id)
        .order('created_at', { ascending: false })
        .limit(6),

      // Recent workflow runs (last 8)
      supabaseAdmin
        .from('workflow_runs')
        .select('id, workflow_id, status, started_at, completed_at, credits_used, workflows!inner(name, model_id, agency_id)')
        .eq('workflows.agency_id', agency.id)
        .order('started_at', { ascending: false })
        .limit(8),

      // Runs waiting for review (capped for dashboard performance)
      supabaseAdmin
        .from('workflow_runs')
        .select('id, workflow_id, started_at, workflows!inner(name, model_id, agency_id)')
        .eq('workflows.agency_id', agency.id)
        .eq('status', 'waiting_for_review')
        .order('started_at', { ascending: false })
        .limit(20),

      // Upcoming scheduled triggers
      supabaseAdmin
        .from('workflow_triggers')
        .select('id, workflow_id, schedule_config, next_trigger_at, workflows!inner(name, model_id, agency_id)')
        .eq('workflows.agency_id', agency.id)
        .eq('enabled', true)
        .eq('trigger_type', 'scheduled')
        .not('next_trigger_at', 'is', null)
        .order('next_trigger_at')
        .limit(5),
    ]);

    const models = modelsResult.data || [];
    const galleryItems = galleryResult.data || [];
    const recentRuns = runsResult.data || [];
    const pendingReviews = pendingReviewsResult.data || [];
    const triggers = triggersResult.data || [];

    // Count active schedules per model from the triggers we already fetched
    const activeScheduleCounts = {};
    for (const t of triggers) {
      const mid = t.workflows?.model_id;
      if (mid) activeScheduleCounts[mid] = (activeScheduleCounts[mid] || 0) + 1;
    }

    // Build model cards — counts come from embedded relations
    const modelCards = models.map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      avatar_url: m.avatar_url,
      onlyfans_handle: m.onlyfans_handle,
      gallery_count: m.gallery_items?.[0]?.count || 0,
      workflow_count: m.workflows?.[0]?.count || 0,
      active_schedules: activeScheduleCounts[m.id] || 0,
      pending_reviews: pendingReviews.filter((r) => r.workflows.model_id === m.id).length,
    }));

    // Recent runs enriched with model name
    const modelMap = Object.fromEntries(models.map((m) => [m.id, m.name]));
    const enrichedRuns = recentRuns.map((r) => ({
      id: r.id,
      workflow_id: r.workflow_id,
      workflow_name: r.workflows.name,
      model_name: modelMap[r.workflows.model_id] || null,
      model_id: r.workflows.model_id,
      status: r.status,
      started_at: r.started_at,
      completed_at: r.completed_at,
      credits_used: r.credits_used,
    }));

    // Failed runs in last 24h
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const recentFailures = enrichedRuns.filter(
      (r) => r.status === 'failed' && r.started_at > dayAgo
    );

    // Upcoming triggers enriched
    const upcomingTriggers = triggers.map((t) => ({
      id: t.id,
      workflow_id: t.workflow_id,
      workflow_name: t.workflows.name,
      model_name: modelMap[t.workflows.model_id] || null,
      model_id: t.workflows.model_id,
      next_trigger_at: t.next_trigger_at,
      schedule_config: t.schedule_config,
    }));

    res.json({
      credits: creditBalance,
      models: modelCards,
      recent_gallery: galleryItems,
      recent_runs: enrichedRuns,
      pending_reviews: pendingReviews.map((r) => ({
        id: r.id,
        workflow_id: r.workflow_id,
        workflow_name: r.workflows.name,
        model_name: modelMap[r.workflows.model_id] || null,
        model_id: r.workflows.model_id,
        started_at: r.started_at,
      })),
      recent_failures: recentFailures,
      upcoming_triggers: upcomingTriggers,
    });
  } catch (error) {
    logger.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;
