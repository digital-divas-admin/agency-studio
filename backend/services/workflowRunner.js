/**
 * Workflow Execution Engine
 *
 * Runs a workflow by:
 * 1. Loading the graph (nodes + edges)
 * 2. Topological sorting for execution order
 * 3. Resolving {{model.*}} template variables
 * 4. Executing nodes sequentially (parallel branches where possible)
 * 5. Passing outputs between connected nodes
 * 6. Pausing at review/pick gates for human approval
 * 7. Tracking credits consumed per node
 *
 * Node execution is handled by workflowExecutors.js which calls
 * the real generation, editing, and chat APIs directly (no HTTP overhead).
 * Qwen image generation auto-injects the model's LoRA.
 */

const { supabaseAdmin } = require('./supabase');
const { logger } = require('./logger');
const { resolveNodeConfig } = require('./workflowTemplateVars');
const { calculateNodeCreditCost } = require('./workflowNodeTypes');
const executors = require('./workflowExecutors');

/**
 * Main entry point: run (or resume) a workflow run.
 */
async function runWorkflow(runId) {
  const ctx = await loadRunContext(runId);
  if (!ctx) return;

  const { run, workflow, model, nodes, edges, nodeResults } = ctx;

  logger.info('Workflow execution starting', { runId, workflowId: workflow.id, nodeCount: nodes.length });

  try {
    // Build adjacency data structures
    const { adjList, inDegree, nodeMap, resultMap } = buildGraph(nodes, edges, nodeResults);

    // Topological sort
    const executionOrder = topologicalSort(nodes, adjList, inDegree);

    // Execute nodes in order
    for (const nodeId of executionOrder) {
      const node = nodeMap.get(nodeId);
      const result = resultMap.get(nodeId);

      // Skip already completed nodes (for resume after review)
      if (result && ['completed', 'skipped', 'failed'].includes(result.status)) {
        continue;
      }

      // Collect inputs from upstream nodes
      const inputs = collectInputs(nodeId, edges, nodeMap, resultMap);

      // Resolve template variables
      const resolvedConfig = resolveNodeConfig(node.config || {}, model);

      // Mark node as running
      await updateNodeResult(result.id, { status: 'running', started_at: new Date().toISOString() });

      try {
        const output = await executeNode(node, resolvedConfig, inputs, ctx);

        // Check if this is a review/pick node that needs human approval
        if (['review', 'pick'].includes(node.node_type)) {
          await updateNodeResult(result.id, {
            status: 'waiting_for_review',
            output,
          });
          await updateRunStatus(runId, 'waiting_for_review');
          logger.info('Workflow paused for review', { runId, nodeId, nodeType: node.node_type });
          return; // Stop execution — will resume when user approves
        }

        // Calculate and track credits
        const creditsCost = calculateNodeCreditCost(node.node_type, resolvedConfig);
        if (creditsCost > 0) {
          await deductRunCredits(run, creditsCost, ctx);
        }

        // Mark node completed with output
        await updateNodeResult(result.id, {
          status: 'completed',
          output,
          credits_used: creditsCost,
          completed_at: new Date().toISOString(),
        });

        // Update result map for downstream nodes
        resultMap.set(nodeId, { ...result, status: 'completed', output });

        logger.info('Node completed', { runId, nodeId, nodeType: node.node_type, creditsCost });
      } catch (nodeError) {
        logger.error('Node execution failed', { runId, nodeId, error: nodeError.message });
        await updateNodeResult(result.id, {
          status: 'failed',
          error: nodeError.message,
          completed_at: new Date().toISOString(),
        });
        await updateRunStatus(runId, 'failed', new Date().toISOString());
        return; // Stop execution on failure
      }
    }

    // All nodes completed successfully
    await updateRunStatus(runId, 'completed', new Date().toISOString());
    logger.info('Workflow run completed', { runId });
  } catch (error) {
    logger.error('Workflow execution error', { runId, error: error.message });
    await updateRunStatus(runId, 'failed', new Date().toISOString());
  }
}

/**
 * Load all context needed to execute a run
 */
async function loadRunContext(runId) {
  const { data: run, error: runError } = await supabaseAdmin
    .from('workflow_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (runError || !run) {
    logger.error('Run not found:', { runId });
    return null;
  }

  if (['completed', 'failed', 'cancelled'].includes(run.status)) {
    logger.warn('Run already finished:', { runId, status: run.status });
    return null;
  }

  const [workflowResult, modelResult, nodesResult, edgesResult, resultsResult] = await Promise.all([
    supabaseAdmin.from('workflows').select('*').eq('id', run.workflow_id).single(),
    supabaseAdmin.from('agency_models').select('*').eq('id', run.model_id).single(),
    supabaseAdmin.from('workflow_nodes').select('*').eq('workflow_id', run.workflow_id),
    supabaseAdmin.from('workflow_edges').select('*').eq('workflow_id', run.workflow_id),
    supabaseAdmin.from('workflow_node_results').select('*').eq('run_id', runId),
  ]);

  return {
    run,
    workflow: workflowResult.data,
    model: modelResult.data,
    nodes: nodesResult.data || [],
    edges: edgesResult.data || [],
    nodeResults: resultsResult.data || [],
  };
}

/**
 * Build graph adjacency structures from nodes and edges
 */
function buildGraph(nodes, edges, nodeResults) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const resultMap = new Map(nodeResults.map((r) => [r.node_id, r]));

  // Adjacency list: nodeId -> [downstream nodeIds]
  const adjList = new Map();
  // In-degree count for each node
  const inDegree = new Map();

  for (const node of nodes) {
    adjList.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    adjList.get(edge.source_node_id).push(edge.target_node_id);
    inDegree.set(edge.target_node_id, (inDegree.get(edge.target_node_id) || 0) + 1);
  }

  return { adjList, inDegree, nodeMap, resultMap };
}

/**
 * Kahn's algorithm for topological sort
 */
function topologicalSort(nodes, adjList, inDegree) {
  const queue = [];
  const order = [];

  // Start with nodes that have no incoming edges
  for (const node of nodes) {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  }

  while (queue.length > 0) {
    const nodeId = queue.shift();
    order.push(nodeId);

    for (const neighbor of (adjList.get(nodeId) || [])) {
      const newDegree = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (order.length !== nodes.length) {
    throw new Error('Workflow graph contains a cycle');
  }

  return order;
}

/**
 * Collect input values for a node from its upstream connections
 * Returns: { portName: value, ... }
 */
function collectInputs(nodeId, edges, nodeMap, resultMap) {
  const inputs = {};

  const incomingEdges = edges.filter((e) => e.target_node_id === nodeId);
  for (const edge of incomingEdges) {
    const sourceResult = resultMap.get(edge.source_node_id);
    if (sourceResult && sourceResult.output) {
      inputs[edge.target_port] = sourceResult.output[edge.source_port];
    }
  }

  return inputs;
}

/**
 * Execute a single node based on its type.
 * Delegates to workflowExecutors.js for real API calls.
 */
async function executeNode(node, resolvedConfig, inputs, ctx) {
  switch (node.node_type) {
    case 'generate_image':
      return executors.executeGenerateImage(resolvedConfig, inputs, ctx);

    case 'generate_video':
      return executors.executeGenerateVideo(resolvedConfig, inputs, ctx);

    case 'edit_bg_remove':
      return executors.executeEditBgRemove(inputs, ctx);

    case 'ai_caption':
      return executors.executeAiCaption(resolvedConfig, inputs, ctx);

    case 'review':
      // Pass through inputs as outputs — execution pauses in the caller
      return {
        media: inputs.media || null,
        text: inputs.text || null,
      };

    case 'pick':
      // Present the batch — execution pauses for user selection
      return {
        images: inputs.images || [],
      };

    case 'save_to_gallery':
      return executors.executeSaveToGallery(resolvedConfig, inputs, ctx);

    case 'export': {
      const platform = resolvedConfig.platform || 'download';
      logger.info('Export node executed', { platform, hasMedia: !!inputs.media, hasCaption: !!inputs.caption });
      // Placeholder — platform integrations are future work
      return {};
    }

    default:
      throw new Error(`Unknown node type: ${node.node_type}`);
  }
}

// =============================================
// Helper functions
// =============================================

async function updateNodeResult(resultId, updates) {
  const { error } = await supabaseAdmin
    .from('workflow_node_results')
    .update(updates)
    .eq('id', resultId);

  if (error) {
    logger.error('Failed to update node result:', { resultId, error });
  }
}

async function updateRunStatus(runId, status, completedAt) {
  const updates = { status };
  if (completedAt) updates.completed_at = completedAt;

  const { error } = await supabaseAdmin
    .from('workflow_runs')
    .update(updates)
    .eq('id', runId);

  if (error) {
    logger.error('Failed to update run status:', { runId, error });
  }
}

async function deductRunCredits(run, creditsCost, ctx) {
  // Update run total
  await supabaseAdmin
    .from('workflow_runs')
    .update({ credits_used: run.credits_used + creditsCost })
    .eq('id', run.id);

  run.credits_used += creditsCost;

  // Atomic credit deduction — single UPDATE with WHERE credit_pool >= cost
  // prevents race conditions when multiple runs deduct concurrently
  const { data: newPool, error: rpcError } = await supabaseAdmin
    .rpc('deduct_agency_credits', {
      p_agency_id: ctx.workflow.agency_id,
      p_amount: creditsCost,
    });

  if (rpcError) {
    logger.error('Credit deduction RPC failed:', { error: rpcError.message });
    throw new Error('Failed to deduct credits');
  }

  if (newPool === -1) {
    throw new Error('Insufficient credits to continue workflow');
  }

  // Atomic user usage increment
  if (run.started_by) {
    const { error: userError } = await supabaseAdmin
      .rpc('increment_user_credits_used', {
        p_user_id: run.started_by,
        p_amount: creditsCost,
      });

    if (userError) {
      logger.error('User credit tracking failed:', { error: userError.message });
      // Non-fatal — agency pool was already deducted correctly
    }
  }
}

module.exports = { runWorkflow };
