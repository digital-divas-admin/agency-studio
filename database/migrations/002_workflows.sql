-- =============================================
-- Migration: Workflows Feature
-- Adds workflow tables for node-graph automation pipelines.
-- Workflows are model-scoped, cloneable, and support
-- template variables ({{model.*}}) for cross-model reuse.
-- =============================================

-- 1. Workflows (top-level container)
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    model_id UUID REFERENCES agency_models(id) ON DELETE SET NULL,

    name TEXT NOT NULL,
    description TEXT,

    -- Template flag: model_id is null, reusable as a starting point
    is_template BOOLEAN DEFAULT false,

    -- Lineage: track what this was cloned from
    source_workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,

    -- Lifecycle
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),

    created_by UUID REFERENCES agency_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Workflow Nodes (individual steps in the graph)
CREATE TABLE IF NOT EXISTS workflow_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

    node_type TEXT NOT NULL,
    label TEXT NOT NULL,

    -- Node-specific parameters (prompt, model selection, aspect ratio, etc.)
    config JSONB DEFAULT '{}'::jsonb,

    -- Canvas position for the graph editor
    position_x FLOAT DEFAULT 0,
    position_y FLOAT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Workflow Edges (connections between node ports)
CREATE TABLE IF NOT EXISTS workflow_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

    source_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    source_port TEXT NOT NULL,

    target_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    target_port TEXT NOT NULL,

    -- Each input port accepts exactly one connection
    UNIQUE(workflow_id, target_node_id, target_port)
);

-- 4. Workflow Runs (execution instances)
CREATE TABLE IF NOT EXISTS workflow_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    model_id UUID REFERENCES agency_models(id) ON DELETE SET NULL,

    started_by UUID REFERENCES agency_users(id) ON DELETE SET NULL,

    status TEXT DEFAULT 'running' CHECK (status IN (
        'running', 'waiting_for_review', 'completed', 'failed', 'cancelled'
    )),

    credits_used INTEGER DEFAULT 0,

    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 5. Workflow Node Results (per-node output within a run)
CREATE TABLE IF NOT EXISTS workflow_node_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,

    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'running', 'waiting_for_review', 'completed', 'failed', 'skipped'
    )),

    -- Output keyed by port name: { "images": ["url1", "url2"], "text": "caption" }
    output JSONB DEFAULT '{}'::jsonb,

    error TEXT,
    credits_used INTEGER DEFAULT 0,

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- One result per node per run
    UNIQUE(run_id, node_id)
);


-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_workflows_agency ON workflows(agency_id);
CREATE INDEX IF NOT EXISTS idx_workflows_model ON workflows(model_id);
CREATE INDEX IF NOT EXISTS idx_workflows_agency_model ON workflows(agency_id, model_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_template ON workflows(agency_id, is_template) WHERE is_template = true;
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);

CREATE INDEX IF NOT EXISTS idx_workflow_nodes_workflow ON workflow_nodes(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_workflow ON workflow_edges(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_source ON workflow_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_target ON workflow_edges(target_node_id);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_model ON workflow_runs(model_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started ON workflow_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_node_results_run ON workflow_node_results(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_node_results_node ON workflow_node_results(node_id);


-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_node_results ENABLE ROW LEVEL SECURITY;

-- Workflows: all agency users can view
CREATE POLICY "Users can view agency workflows"
    ON workflows FOR SELECT
    USING (agency_id = get_user_agency_id());

-- Workflows: all authenticated agency users can create
CREATE POLICY "Users can create workflows"
    ON workflows FOR INSERT
    WITH CHECK (agency_id = get_user_agency_id());

-- Workflows: creator or admin can update
CREATE POLICY "Users can update own workflows or admin any"
    ON workflows FOR UPDATE
    USING (
        agency_id = get_user_agency_id()
        AND (
            created_by IN (SELECT id FROM agency_users WHERE auth_user_id = auth.uid())
            OR is_agency_admin()
        )
    );

-- Workflows: creator or admin can delete
CREATE POLICY "Users can delete own workflows or admin any"
    ON workflows FOR DELETE
    USING (
        agency_id = get_user_agency_id()
        AND (
            created_by IN (SELECT id FROM agency_users WHERE auth_user_id = auth.uid())
            OR is_agency_admin()
        )
    );

-- Workflow Nodes: access follows parent workflow
CREATE POLICY "Users can view workflow nodes"
    ON workflow_nodes FOR SELECT
    USING (workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id()));

CREATE POLICY "Users can manage workflow nodes"
    ON workflow_nodes FOR ALL
    USING (workflow_id IN (
        SELECT id FROM workflows
        WHERE agency_id = get_user_agency_id()
        AND (
            created_by IN (SELECT id FROM agency_users WHERE auth_user_id = auth.uid())
            OR is_agency_admin()
        )
    ));

-- Workflow Edges: access follows parent workflow
CREATE POLICY "Users can view workflow edges"
    ON workflow_edges FOR SELECT
    USING (workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id()));

CREATE POLICY "Users can manage workflow edges"
    ON workflow_edges FOR ALL
    USING (workflow_id IN (
        SELECT id FROM workflows
        WHERE agency_id = get_user_agency_id()
        AND (
            created_by IN (SELECT id FROM agency_users WHERE auth_user_id = auth.uid())
            OR is_agency_admin()
        )
    ));

-- Workflow Runs: all agency users can view runs
CREATE POLICY "Users can view workflow runs"
    ON workflow_runs FOR SELECT
    USING (workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id()));

-- Workflow Runs: authenticated users can start runs
CREATE POLICY "Users can create workflow runs"
    ON workflow_runs FOR INSERT
    WITH CHECK (workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id()));

-- Workflow Runs: starter or admin can update (cancel, approve review)
CREATE POLICY "Users can update own runs or admin any"
    ON workflow_runs FOR UPDATE
    USING (
        workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id())
        AND (
            started_by IN (SELECT id FROM agency_users WHERE auth_user_id = auth.uid())
            OR is_agency_admin()
        )
    );

-- Workflow Node Results: access follows parent run
CREATE POLICY "Users can view node results"
    ON workflow_node_results FOR SELECT
    USING (run_id IN (
        SELECT id FROM workflow_runs
        WHERE workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id())
    ));

CREATE POLICY "Users can manage node results"
    ON workflow_node_results FOR ALL
    USING (run_id IN (
        SELECT id FROM workflow_runs
        WHERE workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id())
    ));


-- =============================================
-- TRIGGERS
-- =============================================

CREATE TRIGGER update_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_workflow_nodes_updated_at
    BEFORE UPDATE ON workflow_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
