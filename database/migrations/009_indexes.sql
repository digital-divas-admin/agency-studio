-- Migration 009: Add performance indexes
-- Created: 2026-02-02
-- Purpose: Add indexes for scheduler polling, credit checks, and workflow lookups

-- Index for workflow scheduler polling
-- Used by: backend/services/workflowScheduler.js (pollAndFire function)
-- Improves: Query for finding due scheduled triggers
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_due
  ON workflow_triggers(next_trigger_at)
  WHERE enabled = true AND trigger_type = 'scheduled';

-- Index for agency credit checks
-- Used by: backend/middleware/credits.js (runs on EVERY /api/* request)
-- Improves: Fast lookup of active agencies with their credit pool
CREATE INDEX IF NOT EXISTS idx_agencies_active_pool
  ON agencies(id, credit_pool)
  WHERE status = 'active';

-- Index for workflow run lookups
-- Used by: Workflow scheduler and workflow execution queries
-- Improves: Finding runs by workflow and status
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_status
  ON workflow_runs(workflow_id, status);

-- Index for workflow node results lookups
-- Used by: Workflow execution and status queries
-- Improves: Finding node results by run and status
CREATE INDEX IF NOT EXISTS idx_workflow_node_results_run_status
  ON workflow_node_results(run_id, status);

-- Index for gallery queries filtered by agency
-- Used by: backend/routes/gallery.js (list endpoint)
-- Improves: Fast filtering and sorting of gallery items by agency
CREATE INDEX IF NOT EXISTS idx_gallery_items_agency_created
  ON gallery_items(agency_id, created_at DESC);

-- Index for model profiles by agency
-- Used by: Model profile lookups and listings
-- Improves: Fast filtering of models by agency
CREATE INDEX IF NOT EXISTS idx_model_profiles_agency
  ON model_profiles(agency_id);
