/**
 * Workflow Routes
 * CRUD for workflows, nodes, edges. Bulk graph save. Clone. Run management.
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logger } = require('../services/logger');
const {
  getNodeTypeList,
  getNodeType,
  isPortCompatible,
  NODE_CATEGORIES,
} = require('../services/workflowNodeTypes');
const { computeNextTriggerAt } = require('../services/workflowScheduler');

// =============================================
// NODE TYPE REGISTRY
// =============================================

/**
 * GET /api/workflows/node-types
 * Returns all available node types with port definitions and config schemas
 */
router.get('/node-types', requireAuth, (req, res) => {
  res.json({
    nodeTypes: getNodeTypeList(),
    categories: NODE_CATEGORIES,
  });
});

// =============================================
// RUN MANAGEMENT
// These routes MUST be defined before /:id routes,
// otherwise Express matches "runs" as a workflow :id param.
// =============================================

/**
 * GET /api/workflows/runs/:runId
 * Get run status with all node results
 */
router.get('/runs/:runId', requireAuth, async (req, res) => {
  const { agency } = req;
  const { runId } = req.params;

  try {
    const { data: run, error } = await supabaseAdmin
      .from('workflow_runs')
      .select('*, workflows!inner(agency_id)')
      .eq('id', runId)
      .single();

    if (error || !run || run.workflows.agency_id !== agency.id) {
      return res.status(404).json({ error: 'Run not found' });
    }

    // Fetch node results
    const { data: results } = await supabaseAdmin
      .from('workflow_node_results')
      .select('*')
      .eq('run_id', runId);

    // Clean up the response
    const { workflows: _, ...runData } = run;

    res.json({
      ...runData,
      node_results: results || [],
    });
  } catch (error) {
    logger.error('Error fetching run:', error);
    res.status(500).json({ error: 'Failed to fetch run' });
  }
});

/**
 * POST /api/workflows/runs/:runId/nodes/:nodeId/approve
 * Approve a review/pick node to resume workflow execution
 * Body for review: {} (just approve)
 * Body for pick: { selected_index: 0 } (which image from batch)
 */
router.post('/runs/:runId/nodes/:nodeId/approve', requireAuth, async (req, res) => {
  const { agency } = req;
  const { runId, nodeId } = req.params;
  const { selected_index } = req.body;

  try {
    // Verify run belongs to agency
    const { data: run } = await supabaseAdmin
      .from('workflow_runs')
      .select('*, workflows!inner(agency_id)')
      .eq('id', runId)
      .single();

    if (!run || run.workflows.agency_id !== agency.id) {
      return res.status(404).json({ error: 'Run not found' });
    }

    if (run.status !== 'waiting_for_review') {
      return res.status(400).json({ error: 'Run is not waiting for review' });
    }

    // Get the node result
    const { data: result } = await supabaseAdmin
      .from('workflow_node_results')
      .select('*, workflow_nodes!inner(node_type)')
      .eq('run_id', runId)
      .eq('node_id', nodeId)
      .single();

    if (!result || result.status !== 'waiting_for_review') {
      return res.status(400).json({ error: 'This node is not waiting for review' });
    }

    // For pick nodes, extract the selected image
    let updatedOutput = result.output;
    if (result.workflow_nodes.node_type === 'pick' && selected_index !== undefined) {
      const idx = Number(selected_index);
      if (!Number.isInteger(idx)) {
        return res.status(400).json({ error: 'selected_index must be an integer' });
      }
      const images = result.output?.images || [];
      if (idx < 0 || idx >= images.length) {
        return res.status(400).json({ error: 'Invalid selection index' });
      }
      updatedOutput = { image: images[idx] };
    }

    // Mark node as completed
    await supabaseAdmin
      .from('workflow_node_results')
      .update({
        status: 'completed',
        output: updatedOutput,
        completed_at: new Date().toISOString(),
      })
      .eq('id', result.id);

    // Update run status back to running
    await supabaseAdmin
      .from('workflow_runs')
      .update({ status: 'running' })
      .eq('id', runId);

    // Resume execution
    try {
      const { runWorkflow } = require('../services/workflowRunner');
      runWorkflow(runId).catch((err) => {
        logger.error('Workflow resume failed:', { runId, error: err.message });
      });
    } catch (importError) {
      logger.warn('Workflow runner not available yet:', importError.message);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error approving node:', error);
    res.status(500).json({ error: 'Failed to approve node' });
  }
});

/**
 * POST /api/workflows/runs/:runId/cancel
 * Cancel a running workflow
 */
router.post('/runs/:runId/cancel', requireAuth, async (req, res) => {
  const { agency } = req;
  const { runId } = req.params;

  try {
    const { data: run } = await supabaseAdmin
      .from('workflow_runs')
      .select('*, workflows!inner(agency_id)')
      .eq('id', runId)
      .single();

    if (!run || run.workflows.agency_id !== agency.id) {
      return res.status(404).json({ error: 'Run not found' });
    }

    if (['completed', 'failed', 'cancelled'].includes(run.status)) {
      return res.status(400).json({ error: 'Run is already finished' });
    }

    // Mark run as cancelled
    await supabaseAdmin
      .from('workflow_runs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    // Mark all pending/running node results as skipped
    await supabaseAdmin
      .from('workflow_node_results')
      .update({ status: 'skipped' })
      .eq('run_id', runId)
      .in('status', ['pending', 'running', 'waiting_for_review']);

    logger.info('Workflow run cancelled', { runId });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error cancelling run:', error);
    res.status(500).json({ error: 'Failed to cancel run' });
  }
});

// =============================================
// TRIGGER MANAGEMENT
// These routes use /triggers prefix, defined before /:id routes.
// =============================================

/**
 * GET /api/workflows/:workflowId/triggers
 * List all triggers for a workflow
 */
router.get('/:workflowId/triggers', requireAuth, async (req, res) => {
  const { agency } = req;
  const { workflowId } = req.params;

  try {
    // Verify workflow belongs to agency
    const { data: workflow } = await supabaseAdmin
      .from('workflows')
      .select('id')
      .eq('id', workflowId)
      .eq('agency_id', agency.id)
      .single();

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const { data: triggers, error } = await supabaseAdmin
      .from('workflow_triggers')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching triggers:', error);
      return res.status(500).json({ error: 'Failed to fetch triggers' });
    }

    res.json({ triggers: triggers || [] });
  } catch (error) {
    logger.error('Error in trigger list:', error);
    res.status(500).json({ error: 'Failed to fetch triggers' });
  }
});

/**
 * POST /api/workflows/:workflowId/triggers
 * Create a new trigger for a workflow
 */
router.post('/:workflowId/triggers', requireAuth, async (req, res) => {
  const { agency } = req;
  const { workflowId } = req.params;
  const { trigger_type, schedule_config, enabled } = req.body;

  if (!trigger_type || !['scheduled', 'webhook'].includes(trigger_type)) {
    return res.status(400).json({ error: 'trigger_type must be "scheduled" or "webhook"' });
  }

  try {
    // Verify workflow belongs to agency
    const { data: workflow } = await supabaseAdmin
      .from('workflows')
      .select('id')
      .eq('id', workflowId)
      .eq('agency_id', agency.id)
      .single();

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Build trigger data
    const triggerData = {
      workflow_id: workflowId,
      agency_id: agency.id,
      trigger_type,
      enabled: enabled !== false,
    };

    if (trigger_type === 'scheduled') {
      if (!schedule_config || !schedule_config.time || !schedule_config.frequency) {
        return res.status(400).json({ error: 'schedule_config must include frequency and time' });
      }

      // Validate frequency
      if (!['daily', 'weekly', 'specific_days'].includes(schedule_config.frequency)) {
        return res.status(400).json({ error: 'frequency must be daily, weekly, or specific_days' });
      }

      // Validate days for weekly/specific_days
      if (['weekly', 'specific_days'].includes(schedule_config.frequency)) {
        if (!Array.isArray(schedule_config.days) || schedule_config.days.length === 0) {
          return res.status(400).json({ error: 'days array required for weekly/specific_days frequency' });
        }
        const validDays = schedule_config.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
        if (!validDays) {
          return res.status(400).json({ error: 'days must be integers 0-6 (0=Sunday)' });
        }
      }

      // Validate time format
      const timeMatch = schedule_config.time.match(/^(\d{1,2}):(\d{2})$/);
      if (!timeMatch) {
        return res.status(400).json({ error: 'time must be in HH:MM format' });
      }
      const h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      if (h < 0 || h > 23 || m < 0 || m > 59) {
        return res.status(400).json({ error: 'Invalid time values' });
      }

      triggerData.schedule_config = schedule_config;

      // Compute first trigger time
      if (triggerData.enabled) {
        const nextAt = computeNextTriggerAt(schedule_config);
        triggerData.next_trigger_at = nextAt ? nextAt.toISOString() : null;
      }
    }

    if (trigger_type === 'webhook') {
      // Generate a unique webhook token
      const crypto = require('crypto');
      triggerData.webhook_token = crypto.randomBytes(32).toString('hex');
    }

    const { data: trigger, error } = await supabaseAdmin
      .from('workflow_triggers')
      .insert(triggerData)
      .select()
      .single();

    if (error) {
      logger.error('Error creating trigger:', error);
      return res.status(500).json({ error: 'Failed to create trigger' });
    }

    logger.info('Workflow trigger created', {
      agencyId: agency.id,
      workflowId,
      triggerId: trigger.id,
      type: trigger_type,
    });

    res.status(201).json(trigger);
  } catch (error) {
    logger.error('Error creating trigger:', error);
    res.status(500).json({ error: 'Failed to create trigger' });
  }
});

/**
 * PUT /api/workflows/triggers/:triggerId
 * Update a trigger (enable/disable, change schedule)
 */
router.put('/triggers/:triggerId', requireAuth, async (req, res) => {
  const { agency } = req;
  const { triggerId } = req.params;
  const { enabled, schedule_config } = req.body;

  try {
    // Verify trigger belongs to agency
    const { data: existing } = await supabaseAdmin
      .from('workflow_triggers')
      .select('*')
      .eq('id', triggerId)
      .eq('agency_id', agency.id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    const updates = {};

    if (enabled !== undefined) {
      updates.enabled = !!enabled;
    }

    if (schedule_config !== undefined && existing.trigger_type === 'scheduled') {
      if (!schedule_config.time || !schedule_config.frequency) {
        return res.status(400).json({ error: 'schedule_config must include frequency and time' });
      }

      if (!['daily', 'weekly', 'specific_days'].includes(schedule_config.frequency)) {
        return res.status(400).json({ error: 'frequency must be daily, weekly, or specific_days' });
      }

      if (['weekly', 'specific_days'].includes(schedule_config.frequency)) {
        if (!Array.isArray(schedule_config.days) || schedule_config.days.length === 0) {
          return res.status(400).json({ error: 'days array required for weekly/specific_days frequency' });
        }
      }

      const timeMatch = schedule_config.time.match(/^(\d{1,2}):(\d{2})$/);
      if (!timeMatch) {
        return res.status(400).json({ error: 'time must be in HH:MM format' });
      }

      updates.schedule_config = schedule_config;
    }

    // Recompute next_trigger_at if schedule or enabled changed
    const newEnabled = updates.enabled !== undefined ? updates.enabled : existing.enabled;
    const newConfig = updates.schedule_config || existing.schedule_config;

    if (newEnabled && existing.trigger_type === 'scheduled') {
      const nextAt = computeNextTriggerAt(newConfig);
      updates.next_trigger_at = nextAt ? nextAt.toISOString() : null;
    } else if (!newEnabled) {
      updates.next_trigger_at = null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data: trigger, error } = await supabaseAdmin
      .from('workflow_triggers')
      .update(updates)
      .eq('id', triggerId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating trigger:', error);
      return res.status(500).json({ error: 'Failed to update trigger' });
    }

    logger.info('Workflow trigger updated', { triggerId, updates: Object.keys(updates) });
    res.json(trigger);
  } catch (error) {
    logger.error('Error updating trigger:', error);
    res.status(500).json({ error: 'Failed to update trigger' });
  }
});

/**
 * DELETE /api/workflows/triggers/:triggerId
 * Delete a trigger
 */
router.delete('/triggers/:triggerId', requireAuth, async (req, res) => {
  const { agency } = req;
  const { triggerId } = req.params;

  try {
    const { data: trigger, error } = await supabaseAdmin
      .from('workflow_triggers')
      .delete()
      .eq('id', triggerId)
      .eq('agency_id', agency.id)
      .select()
      .single();

    if (error || !trigger) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    logger.info('Workflow trigger deleted', { triggerId, workflowId: trigger.workflow_id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting trigger:', error);
    res.status(500).json({ error: 'Failed to delete trigger' });
  }
});

// =============================================
// WORKFLOW CRUD
// =============================================

/**
 * GET /api/workflows
 * List workflows. Query params: model_id, is_template, status
 */
router.get('/', requireAuth, async (req, res) => {
  const { agency } = req;
  const { model_id, is_template, status } = req.query;

  try {
    let query = supabaseAdmin
      .from('workflows')
      .select('*, workflow_nodes(id), workflow_runs(id, status, started_at), workflow_triggers(id, enabled, trigger_type, schedule_config, next_trigger_at, last_triggered_at)')
      .eq('agency_id', agency.id)
      .order('updated_at', { ascending: false })
      .order('started_at', { ascending: false, referencedTable: 'workflow_runs' })
      .limit(5, { referencedTable: 'workflow_runs' });

    if (model_id) query = query.eq('model_id', model_id);
    if (is_template === 'true') query = query.eq('is_template', true);
    if (is_template === 'false') query = query.eq('is_template', false);
    if (status && status !== 'all') query = query.eq('status', status);
    // By default, exclude archived
    if (!status) query = query.neq('status', 'archived');

    const { data: workflows, error } = await query;

    if (error) {
      logger.error('Error fetching workflows:', error);
      return res.status(500).json({ error: 'Failed to fetch workflows' });
    }

    // Fetch total run counts for all workflows in one query
    const workflowIds = (workflows || []).map((w) => w.id);
    let runCounts = {};
    if (workflowIds.length > 0) {
      const { data: counts } = await supabaseAdmin
        .from('workflow_runs')
        .select('workflow_id')
        .in('workflow_id', workflowIds);

      if (counts) {
        for (const row of counts) {
          runCounts[row.workflow_id] = (runCounts[row.workflow_id] || 0) + 1;
        }
      }
    }

    // Enrich with counts and trigger info
    const enriched = (workflows || []).map((w) => {
      const triggers = w.workflow_triggers || [];
      const activeTrigger = triggers.find((t) => t.enabled && t.trigger_type === 'scheduled');

      return {
        id: w.id,
        agency_id: w.agency_id,
        model_id: w.model_id,
        name: w.name,
        description: w.description,
        is_template: w.is_template,
        source_workflow_id: w.source_workflow_id,
        status: w.status,
        created_by: w.created_by,
        created_at: w.created_at,
        updated_at: w.updated_at,
        node_count: w.workflow_nodes?.length || 0,
        last_run: w.workflow_runs?.sort((a, b) =>
          new Date(b.started_at) - new Date(a.started_at)
        )[0] || null,
        total_runs: runCounts[w.id] || 0,
        trigger: activeTrigger ? {
          id: activeTrigger.id,
          enabled: activeTrigger.enabled,
          next_trigger_at: activeTrigger.next_trigger_at,
          schedule_config: activeTrigger.schedule_config,
        } : null,
        has_triggers: triggers.length > 0,
        triggers_enabled: triggers.some((t) => t.enabled),
      };
    });

    res.json({ workflows: enriched });
  } catch (error) {
    logger.error('Error in workflows list:', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

/**
 * POST /api/workflows
 * Create a new workflow
 */
router.post('/', requireAuth, async (req, res) => {
  const { agency, agencyUser } = req;
  const { name, description, model_id, is_template } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    // If model_id provided, verify it belongs to agency
    if (model_id) {
      const { data: model } = await supabaseAdmin
        .from('agency_models')
        .select('id')
        .eq('id', model_id)
        .eq('agency_id', agency.id)
        .single();

      if (!model) {
        return res.status(404).json({ error: 'Model not found' });
      }
    }

    const { data: workflow, error } = await supabaseAdmin
      .from('workflows')
      .insert({
        agency_id: agency.id,
        model_id: is_template ? null : (model_id || null),
        name: name.trim(),
        description: description || null,
        is_template: is_template || false,
        status: 'draft',
        created_by: agencyUser.id,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating workflow:', error);
      return res.status(500).json({ error: 'Failed to create workflow' });
    }

    logger.info('Workflow created', { agencyId: agency.id, workflowId: workflow.id, name: workflow.name });
    res.status(201).json(workflow);
  } catch (error) {
    logger.error('Error creating workflow:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

/**
 * GET /api/workflows/:id
 * Get a single workflow with all nodes and edges
 */
router.get('/:id', requireAuth, async (req, res) => {
  const { agency } = req;
  const { id } = req.params;

  try {
    const { data: workflow, error } = await supabaseAdmin
      .from('workflows')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agency.id)
      .single();

    if (error || !workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Fetch nodes and edges in parallel
    const [nodesResult, edgesResult] = await Promise.all([
      supabaseAdmin
        .from('workflow_nodes')
        .select('*')
        .eq('workflow_id', id)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('workflow_edges')
        .select('*')
        .eq('workflow_id', id),
    ]);

    if (nodesResult.error) {
      logger.error('Error fetching nodes:', nodesResult.error);
      return res.status(500).json({ error: 'Failed to fetch workflow nodes' });
    }
    if (edgesResult.error) {
      logger.error('Error fetching edges:', edgesResult.error);
      return res.status(500).json({ error: 'Failed to fetch workflow edges' });
    }

    res.json({
      ...workflow,
      nodes: nodesResult.data || [],
      edges: edgesResult.data || [],
    });
  } catch (error) {
    logger.error('Error fetching workflow:', error);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

/**
 * PUT /api/workflows/:id
 * Update workflow metadata (name, description, status)
 */
router.put('/:id', requireAuth, async (req, res) => {
  const { agency } = req;
  const { id } = req.params;
  const { name, description, status, model_id } = req.body;

  try {
    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('workflows')
      .select('id, created_by')
      .eq('id', id)
      .eq('agency_id', agency.id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (status !== undefined && ['draft', 'active', 'paused', 'archived'].includes(status)) {
      updates.status = status;
    }
    if (model_id !== undefined) updates.model_id = model_id || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data: workflow, error } = await supabaseAdmin
      .from('workflows')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating workflow:', error);
      return res.status(500).json({ error: 'Failed to update workflow' });
    }

    res.json(workflow);
  } catch (error) {
    logger.error('Error updating workflow:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

/**
 * DELETE /api/workflows/:id
 * Archive a workflow (soft delete)
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const { agency } = req;
  const { id } = req.params;

  try {
    const { data: workflow, error } = await supabaseAdmin
      .from('workflows')
      .update({ status: 'archived' })
      .eq('id', id)
      .eq('agency_id', agency.id)
      .select()
      .single();

    if (error || !workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    logger.info('Workflow archived', { agencyId: agency.id, workflowId: id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error archiving workflow:', error);
    res.status(500).json({ error: 'Failed to archive workflow' });
  }
});

// =============================================
// BULK GRAPH SAVE
// =============================================

/**
 * PUT /api/workflows/:id/graph
 * Atomic save of the entire graph state (nodes + edges).
 * Replaces all nodes and edges for this workflow.
 */
router.put('/:id/graph', requireAuth, async (req, res) => {
  const { agency } = req;
  const { id } = req.params;
  const { nodes, edges } = req.body;

  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return res.status(400).json({ error: 'nodes and edges arrays are required' });
  }

  try {
    // Verify workflow belongs to agency
    const { data: workflow } = await supabaseAdmin
      .from('workflows')
      .select('id')
      .eq('id', id)
      .eq('agency_id', agency.id)
      .single();

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Validate limits
    if (nodes.length > 50) {
      return res.status(400).json({ error: 'Workflow cannot exceed 50 nodes' });
    }
    if (edges.length > 200) {
      return res.status(400).json({ error: 'Workflow cannot exceed 200 edges' });
    }

    // Validate node types
    for (const node of nodes) {
      if (!getNodeType(node.node_type)) {
        return res.status(400).json({ error: `Unknown node type: ${node.node_type}` });
      }
      // Reject oversized config
      if (node.config && JSON.stringify(node.config).length > 50000) {
        return res.status(400).json({ error: `Node "${node.label}" config exceeds maximum size` });
      }
    }

    // Validate edges: source/target must reference nodes in this save,
    // and port types must be compatible
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const edge of edges) {
      const sourceNode = nodeMap.get(edge.source_node_id);
      const targetNode = nodeMap.get(edge.target_node_id);

      if (!sourceNode) {
        return res.status(400).json({ error: `Edge references unknown source node: ${edge.source_node_id}` });
      }
      if (!targetNode) {
        return res.status(400).json({ error: `Edge references unknown target node: ${edge.target_node_id}` });
      }

      // Validate port compatibility
      const sourceDef = getNodeType(sourceNode.node_type);
      const targetDef = getNodeType(targetNode.node_type);
      const sourcePort = sourceDef.outputs.find((p) => p.name === edge.source_port);
      const targetPort = targetDef.inputs.find((p) => p.name === edge.target_port);

      if (!sourcePort) {
        return res.status(400).json({ error: `Unknown output port "${edge.source_port}" on node type "${sourceNode.node_type}"` });
      }
      if (!targetPort) {
        return res.status(400).json({ error: `Unknown input port "${edge.target_port}" on node type "${targetNode.node_type}"` });
      }
      if (!isPortCompatible(sourcePort.type, targetPort.type)) {
        return res.status(400).json({
          error: `Incompatible port types: "${sourcePort.type}" cannot connect to "${targetPort.type}"`,
        });
      }
    }

    // Delete existing nodes and edges (edges cascade from nodes via FK)
    await supabaseAdmin
      .from('workflow_edges')
      .delete()
      .eq('workflow_id', id);

    await supabaseAdmin
      .from('workflow_nodes')
      .delete()
      .eq('workflow_id', id);

    // Insert new nodes
    let savedNodes = [];
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (nodes.length > 0) {
      // Build a map from client-side IDs to new UUIDs
      // Nodes may have client-generated IDs that we need to preserve for edge mapping
      const nodeIdMap = new Map();

      const nodeRows = nodes.map((n) => {
        const row = {
          workflow_id: id,
          node_type: n.node_type,
          label: n.label || getNodeType(n.node_type).label,
          config: n.config || {},
          position_x: n.position_x ?? 0,
          position_y: n.position_y ?? 0,
        };
        // Only reuse the ID if it's a valid UUID (client-generated IDs like "node-123" are not)
        if (n.id && UUID_REGEX.test(n.id)) {
          row.id = n.id;
        }
        return row;
      });

      const { data: insertedNodes, error: nodesError } = await supabaseAdmin
        .from('workflow_nodes')
        .insert(nodeRows)
        .select();

      if (nodesError) {
        logger.error('Error inserting nodes:', nodesError);
        return res.status(500).json({ error: 'Failed to save nodes' });
      }

      savedNodes = insertedNodes;

      // Build ID map: client ID → saved ID
      nodes.forEach((n, i) => {
        nodeIdMap.set(n.id, insertedNodes[i].id);
      });

      // Insert edges with mapped IDs
      if (edges.length > 0) {
        const edgeRows = edges.map((e) => ({
          workflow_id: id,
          source_node_id: nodeIdMap.get(e.source_node_id) || e.source_node_id,
          source_port: e.source_port,
          target_node_id: nodeIdMap.get(e.target_node_id) || e.target_node_id,
          target_port: e.target_port,
        }));

        const { data: insertedEdges, error: edgesError } = await supabaseAdmin
          .from('workflow_edges')
          .insert(edgeRows)
          .select();

        if (edgesError) {
          logger.error('Error inserting edges:', edgesError);
          return res.status(500).json({ error: 'Failed to save edges' });
        }

        res.json({ nodes: savedNodes, edges: insertedEdges });
        return;
      }
    }

    res.json({ nodes: savedNodes, edges: [] });
  } catch (error) {
    logger.error('Error saving graph:', error);
    res.status(500).json({ error: 'Failed to save graph' });
  }
});

// =============================================
// CLONE
// =============================================

/**
 * POST /api/workflows/:id/clone
 * Deep copy a workflow to another model or as a template.
 * Body: { target_model_id } or { as_template: true }
 */
router.post('/:id/clone', requireAuth, async (req, res) => {
  const { agency, agencyUser } = req;
  const { id } = req.params;
  const { target_model_id, as_template } = req.body;

  try {
    // Load source workflow with nodes and edges
    const { data: source } = await supabaseAdmin
      .from('workflows')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agency.id)
      .single();

    if (!source) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // If targeting a model, verify it belongs to agency
    if (target_model_id) {
      const { data: model } = await supabaseAdmin
        .from('agency_models')
        .select('id')
        .eq('id', target_model_id)
        .eq('agency_id', agency.id)
        .single();

      if (!model) {
        return res.status(404).json({ error: 'Target model not found' });
      }
    }

    // 1. Create the new workflow
    const { data: newWorkflow, error: wfError } = await supabaseAdmin
      .from('workflows')
      .insert({
        agency_id: agency.id,
        model_id: as_template ? null : (target_model_id || null),
        name: `${source.name} (copy)`,
        description: source.description,
        is_template: as_template || false,
        source_workflow_id: source.id,
        status: 'draft',
        created_by: agencyUser.id,
      })
      .select()
      .single();

    if (wfError) {
      logger.error('Error cloning workflow:', wfError);
      return res.status(500).json({ error: 'Failed to clone workflow' });
    }

    // 2. Load source nodes and edges
    const [nodesResult, edgesResult] = await Promise.all([
      supabaseAdmin.from('workflow_nodes').select('*').eq('workflow_id', id),
      supabaseAdmin.from('workflow_edges').select('*').eq('workflow_id', id),
    ]);

    const sourceNodes = nodesResult.data || [];
    const sourceEdges = edgesResult.data || [];

    // 3. Insert cloned nodes, mapping old IDs to new
    const nodeIdMap = new Map();

    if (sourceNodes.length > 0) {
      const nodeRows = sourceNodes.map((n) => ({
        workflow_id: newWorkflow.id,
        node_type: n.node_type,
        label: n.label,
        config: n.config,
        position_x: n.position_x,
        position_y: n.position_y,
      }));

      const { data: newNodes, error: nodesError } = await supabaseAdmin
        .from('workflow_nodes')
        .insert(nodeRows)
        .select();

      if (nodesError) {
        logger.error('Error cloning nodes:', nodesError);
        // Clean up the workflow we just created
        await supabaseAdmin.from('workflows').delete().eq('id', newWorkflow.id);
        return res.status(500).json({ error: 'Failed to clone nodes' });
      }

      sourceNodes.forEach((orig, i) => {
        nodeIdMap.set(orig.id, newNodes[i].id);
      });
    }

    // 4. Insert cloned edges with remapped node IDs
    if (sourceEdges.length > 0) {
      const edgeRows = sourceEdges.map((e) => ({
        workflow_id: newWorkflow.id,
        source_node_id: nodeIdMap.get(e.source_node_id),
        source_port: e.source_port,
        target_node_id: nodeIdMap.get(e.target_node_id),
        target_port: e.target_port,
      }));

      const { error: edgesError } = await supabaseAdmin
        .from('workflow_edges')
        .insert(edgeRows);

      if (edgesError) {
        logger.error('Error cloning edges:', edgesError);
        // Don't fail — workflow + nodes are already created, edges are secondary
      }
    }

    logger.info('Workflow cloned', {
      agencyId: agency.id,
      sourceId: id,
      newId: newWorkflow.id,
      targetModel: target_model_id || 'template',
    });

    res.status(201).json(newWorkflow);
  } catch (error) {
    logger.error('Error cloning workflow:', error);
    res.status(500).json({ error: 'Failed to clone workflow' });
  }
});

// =============================================
// START RUN (uses /:id param, so stays after CRUD)
// =============================================

/**
 * POST /api/workflows/:id/run
 * Start a workflow run
 */
router.post('/:id/run', requireAuth, async (req, res) => {
  const { agency, agencyUser } = req;
  const { id } = req.params;

  try {
    // Load workflow with nodes
    const { data: workflow } = await supabaseAdmin
      .from('workflows')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agency.id)
      .single();

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    if (!workflow.model_id) {
      return res.status(400).json({ error: 'Cannot run a template workflow. Assign it to a model first.' });
    }

    // Load nodes to verify there's something to run
    const { data: nodes } = await supabaseAdmin
      .from('workflow_nodes')
      .select('*')
      .eq('workflow_id', id);

    if (!nodes || nodes.length === 0) {
      return res.status(400).json({ error: 'Workflow has no nodes' });
    }

    // Pre-flight credit check: ensure agency has at least some credits
    if (agency.credit_pool <= 0) {
      return res.status(402).json({
        error: 'Insufficient credits',
        message: 'Your agency has run out of credits. Please top up before running workflows.',
      });
    }

    // Create the run
    const { data: run, error: runError } = await supabaseAdmin
      .from('workflow_runs')
      .insert({
        workflow_id: id,
        model_id: workflow.model_id,
        started_by: agencyUser.id,
        status: 'running',
      })
      .select()
      .single();

    if (runError) {
      logger.error('Error creating run:', runError);
      return res.status(500).json({ error: 'Failed to start workflow run' });
    }

    // Create pending results for each node
    const resultRows = nodes.map((n) => ({
      run_id: run.id,
      node_id: n.id,
      status: 'pending',
    }));

    const { error: resultsError } = await supabaseAdmin
      .from('workflow_node_results')
      .insert(resultRows);

    if (resultsError) {
      logger.error('Error creating node results:', resultsError);
    }

    // Kick off async execution (fire-and-forget)
    // The workflowRunner will handle the actual execution
    try {
      const { runWorkflow } = require('../services/workflowRunner');
      runWorkflow(run.id).catch((err) => {
        logger.error('Workflow run failed:', { runId: run.id, error: err.message });
      });
    } catch (importError) {
      logger.warn('Workflow runner not available yet:', importError.message);
    }

    logger.info('Workflow run started', { agencyId: agency.id, workflowId: id, runId: run.id });
    res.status(201).json(run);
  } catch (error) {
    logger.error('Error starting workflow run:', error);
    res.status(500).json({ error: 'Failed to start workflow run' });
  }
});

module.exports = router;
