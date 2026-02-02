/**
 * Workflow Scheduler Service
 *
 * Polls the database every 60 seconds for scheduled triggers
 * whose next_trigger_at has passed, and fires them.
 *
 * Uses the same setInterval pattern as gpuRouter.js cleanup.
 * No external cron libraries — just a timer + DB query.
 */

const { supabaseAdmin } = require('./supabase');
const { logger } = require('./logger');

const POLL_INTERVAL_MS = 60 * 1000; // 60 seconds

let _intervalId = null;

/**
 * Start the scheduler. Call once at server boot.
 */
function start() {
  if (_intervalId) {
    logger.warn('Workflow scheduler already running');
    return;
  }

  logger.info('Workflow scheduler started', { pollIntervalMs: POLL_INTERVAL_MS });

  // Run immediately on startup, then every 60s
  pollAndFire().catch((err) => {
    logger.error('Scheduler initial poll failed:', err.message);
  });

  _intervalId = setInterval(() => {
    pollAndFire().catch((err) => {
      logger.error('Scheduler poll failed:', err.message);
    });
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the scheduler. Call on graceful shutdown.
 */
function stop() {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
    logger.info('Workflow scheduler stopped');
  }
}

/**
 * Poll for due triggers and fire them.
 */
async function pollAndFire() {
  const now = new Date().toISOString();

  // Find all enabled scheduled triggers that are due
  const { data: triggers, error } = await supabaseAdmin
    .from('workflow_triggers')
    .select('*, workflows!inner(id, agency_id, model_id, status)')
    .eq('enabled', true)
    .eq('trigger_type', 'scheduled')
    .lte('next_trigger_at', now)
    .not('next_trigger_at', 'is', null);

  if (error) {
    logger.error('Scheduler query failed:', error.message);
    return;
  }

  if (!triggers || triggers.length === 0) return;

  logger.info(`Scheduler found ${triggers.length} due trigger(s)`);

  for (const trigger of triggers) {
    try {
      await fireTrigger(trigger);
    } catch (err) {
      logger.error('Failed to fire trigger:', { triggerId: trigger.id, error: err.message });
    }
  }
}

/**
 * Fire a single trigger: create a workflow run and advance next_trigger_at.
 */
async function fireTrigger(trigger) {
  const workflow = trigger.workflows;

  // Skip if workflow is not active or has no model
  if (workflow.status !== 'active') {
    logger.debug('Skipping trigger: workflow not active', {
      triggerId: trigger.id,
      workflowStatus: workflow.status,
    });
    // Still advance the schedule so we don't re-fire every poll
    await advanceTrigger(trigger);
    return;
  }

  if (!workflow.model_id) {
    logger.debug('Skipping trigger: workflow has no model', { triggerId: trigger.id });
    await advanceTrigger(trigger);
    return;
  }

  // Check max_concurrent_runs — don't start if we're already at the limit
  const { count: activeRuns } = await supabaseAdmin
    .from('workflow_runs')
    .select('id', { count: 'exact', head: true })
    .eq('workflow_id', workflow.id)
    .in('status', ['running', 'waiting_for_review']);

  if (activeRuns >= (trigger.max_concurrent_runs || 1)) {
    logger.debug('Skipping trigger: max concurrent runs reached', {
      triggerId: trigger.id,
      activeRuns,
      maxConcurrent: trigger.max_concurrent_runs,
    });
    // Still advance so we don't re-fire every 60s while a run is active
    await advanceTrigger(trigger);
    return;
  }

  // Pre-flight credit check
  const { data: agency } = await supabaseAdmin
    .from('agencies')
    .select('credit_pool')
    .eq('id', trigger.agency_id)
    .single();

  if (!agency || agency.credit_pool <= 0) {
    logger.warn('Skipping trigger: insufficient credits', {
      triggerId: trigger.id,
      agencyId: trigger.agency_id,
    });
    await advanceTrigger(trigger);
    return;
  }

  // Load nodes to verify workflow has content
  const { data: nodes } = await supabaseAdmin
    .from('workflow_nodes')
    .select('id')
    .eq('workflow_id', workflow.id);

  if (!nodes || nodes.length === 0) {
    logger.debug('Skipping trigger: workflow has no nodes', { triggerId: trigger.id });
    await advanceTrigger(trigger);
    return;
  }

  // Create the run (same as POST /:id/run)
  const { data: run, error: runError } = await supabaseAdmin
    .from('workflow_runs')
    .insert({
      workflow_id: workflow.id,
      model_id: workflow.model_id,
      started_by: null, // Scheduled — no user
      status: 'running',
    })
    .select()
    .single();

  if (runError) {
    logger.error('Scheduler failed to create run:', { triggerId: trigger.id, error: runError.message });
    await advanceTrigger(trigger);
    return;
  }

  // Create pending node results
  const resultRows = nodes.map((n) => ({
    run_id: run.id,
    node_id: n.id,
    status: 'pending',
  }));

  await supabaseAdmin
    .from('workflow_node_results')
    .insert(resultRows);

  // Fire-and-forget execution (same pattern as the manual run endpoint)
  try {
    const { runWorkflow } = require('./workflowRunner');
    runWorkflow(run.id).catch((err) => {
      logger.error('Scheduled workflow run failed:', { runId: run.id, error: err.message });
    });
  } catch (importError) {
    logger.warn('Workflow runner not available:', importError.message);
  }

  logger.info('Scheduled workflow run started', {
    triggerId: trigger.id,
    workflowId: workflow.id,
    runId: run.id,
  });

  // Advance the trigger
  await advanceTrigger(trigger);
}

/**
 * Update last_triggered_at and compute + set next_trigger_at.
 */
async function advanceTrigger(trigger) {
  const now = new Date();
  const nextAt = computeNextTriggerAt(trigger.schedule_config, now);

  const { error } = await supabaseAdmin
    .from('workflow_triggers')
    .update({
      last_triggered_at: now.toISOString(),
      next_trigger_at: nextAt ? nextAt.toISOString() : null,
    })
    .eq('id', trigger.id);

  if (error) {
    logger.error('Failed to advance trigger:', { triggerId: trigger.id, error: error.message });
  }
}

// =============================================
// Schedule computation
// =============================================

/**
 * Compute the next trigger time from a schedule config.
 *
 * @param {object} scheduleConfig - { frequency, days, time, timezone }
 * @param {Date} fromTime - Compute next after this time
 * @returns {Date|null}
 */
function computeNextTriggerAt(scheduleConfig, fromTime = new Date()) {
  if (!scheduleConfig || !scheduleConfig.time) return null;

  const { frequency, days, time, timezone } = scheduleConfig;
  const [hours, minutes] = time.split(':').map(Number);

  if (isNaN(hours) || isNaN(minutes)) return null;

  const tz = timezone || 'UTC';

  if (frequency === 'daily') {
    return nextDailyOccurrence(fromTime, hours, minutes, tz);
  }

  if (frequency === 'weekly' || frequency === 'specific_days') {
    if (!Array.isArray(days) || days.length === 0) return null;
    return nextWeekdayOccurrence(fromTime, days, hours, minutes, tz);
  }

  return null;
}

/**
 * Next daily occurrence of HH:MM in the given timezone.
 * If today's time hasn't passed yet (in that timezone), returns today.
 * Otherwise returns tomorrow.
 */
function nextDailyOccurrence(fromTime, hours, minutes, tz) {
  // Get current date components in target timezone
  const parts = getDatePartsInTz(fromTime, tz);

  // Build candidate: today at the specified time
  let candidate = buildDateInTz(parts.year, parts.month, parts.day, hours, minutes, tz);

  // If candidate is in the past (or within 60s to avoid re-fire), go to tomorrow
  if (candidate.getTime() <= fromTime.getTime() + 60000) {
    const tomorrow = new Date(fromTime.getTime() + 24 * 60 * 60 * 1000);
    const tParts = getDatePartsInTz(tomorrow, tz);
    candidate = buildDateInTz(tParts.year, tParts.month, tParts.day, hours, minutes, tz);
  }

  return candidate;
}

/**
 * Next occurrence of HH:MM on one of the specified days of week.
 * days: array of 0-6 (0=Sunday)
 */
function nextWeekdayOccurrence(fromTime, days, hours, minutes, tz) {
  const sortedDays = [...new Set(days)].sort((a, b) => a - b);

  // Check the next 8 days (guarantees we wrap around the week)
  for (let offset = 0; offset <= 7; offset++) {
    const candidateDate = new Date(fromTime.getTime() + offset * 24 * 60 * 60 * 1000);
    const parts = getDatePartsInTz(candidateDate, tz);
    const candidateDow = parts.dayOfWeek; // 0=Sunday

    if (!sortedDays.includes(candidateDow)) continue;

    const candidate = buildDateInTz(parts.year, parts.month, parts.day, hours, minutes, tz);

    // Must be in the future (with 60s buffer)
    if (candidate.getTime() > fromTime.getTime() + 60000) {
      return candidate;
    }
  }

  return null;
}

/**
 * Get date parts (year, month, day, dayOfWeek) in a timezone.
 * Uses Intl.DateTimeFormat — Node.js has built-in timezone data.
 */
function getDatePartsInTz(date, tz) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = {};
  for (const { type, value } of formatter.formatToParts(date)) {
    if (type === 'year') parts.year = parseInt(value, 10);
    if (type === 'month') parts.month = parseInt(value, 10);
    if (type === 'day') parts.day = parseInt(value, 10);
    if (type === 'hour') parts.hour = parseInt(value, 10);
    if (type === 'minute') parts.minute = parseInt(value, 10);
    if (type === 'weekday') {
      const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      parts.dayOfWeek = map[value] ?? 0;
    }
  }

  return parts;
}

/**
 * Build a Date object for a specific local time in a timezone.
 * Approach: start with a UTC guess, then adjust based on offset.
 */
function buildDateInTz(year, month, day, hours, minutes, tz) {
  // Create a UTC date with the target date/time values
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

  // Find the actual offset at that time in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Parse the local time that our UTC guess maps to
  const parts = {};
  for (const { type, value } of formatter.formatToParts(utcGuess)) {
    if (type === 'hour') parts.hour = parseInt(value, 10);
    if (type === 'minute') parts.minute = parseInt(value, 10);
  }

  // Calculate offset: difference between what we wanted and what we got
  const wantedMinutes = hours * 60 + minutes;
  const gotMinutes = (parts.hour || 0) * 60 + (parts.minute || 0);
  let diffMinutes = wantedMinutes - gotMinutes;

  // Handle day wrap-around
  if (diffMinutes > 720) diffMinutes -= 1440;
  if (diffMinutes < -720) diffMinutes += 1440;

  // Adjust by the difference
  return new Date(utcGuess.getTime() - diffMinutes * 60 * 1000);
}

module.exports = {
  start,
  stop,
  computeNextTriggerAt,
  // Exported for testing
  _test: { pollAndFire, fireTrigger, advanceTrigger },
};
