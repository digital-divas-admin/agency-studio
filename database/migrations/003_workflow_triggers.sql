-- =============================================
-- Migration: Workflow Triggers
-- Adds scheduled + webhook trigger support for workflows.
-- Manual triggers already work via POST /api/workflows/:id/run.
-- =============================================

-- 1. Workflow Triggers
CREATE TABLE IF NOT EXISTS workflow_triggers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

    -- Trigger type
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'webhook')),
    enabled BOOLEAN NOT NULL DEFAULT true,

    -- Schedule config (for scheduled type)
    -- {
    --   "frequency": "daily" | "weekly" | "specific_days",
    --   "days": [0..6],          -- 0=Sun, 6=Sat (for weekly/specific_days)
    --   "time": "14:30",         -- HH:MM 24h
    --   "timezone": "America/New_York"
    -- }
    schedule_config JSONB,

    -- Webhook config (for webhook type — future)
    webhook_token TEXT UNIQUE,

    -- Scheduling state
    next_trigger_at TIMESTAMPTZ,
    last_triggered_at TIMESTAMPTZ,

    -- Safety: prevent overlapping runs
    max_concurrent_runs INTEGER DEFAULT 1,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- =============================================
-- INDEXES
-- =============================================

-- The scheduler polls this: enabled scheduled triggers whose next_trigger_at is in the past
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_next
    ON workflow_triggers (next_trigger_at)
    WHERE enabled = true AND trigger_type = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_workflow_triggers_workflow
    ON workflow_triggers (workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_triggers_agency
    ON workflow_triggers (agency_id);


-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE workflow_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agency workflow triggers"
    ON workflow_triggers FOR SELECT
    USING (agency_id = get_user_agency_id());

CREATE POLICY "Users can create workflow triggers"
    ON workflow_triggers FOR INSERT
    WITH CHECK (agency_id = get_user_agency_id());

CREATE POLICY "Users can update agency workflow triggers"
    ON workflow_triggers FOR UPDATE
    USING (agency_id = get_user_agency_id());

CREATE POLICY "Users can delete agency workflow triggers"
    ON workflow_triggers FOR DELETE
    USING (agency_id = get_user_agency_id());


-- =============================================
-- TRIGGERS
-- =============================================

CREATE TRIGGER update_workflow_triggers_updated_at
    BEFORE UPDATE ON workflow_triggers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
