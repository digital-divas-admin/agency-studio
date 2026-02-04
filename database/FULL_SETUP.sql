-- =============================================
-- AGENCY STUDIO - COMPLETE DATABASE SETUP
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- CORE TABLES
-- =============================================

-- Agency Plans (subscription tiers)
CREATE TABLE IF NOT EXISTS agency_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    monthly_credits INTEGER NOT NULL,
    max_users INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    custom_domain_allowed BOOLEAN DEFAULT false,
    features JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agencies (the paying customers)
CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    custom_domain TEXT UNIQUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
    plan_id UUID REFERENCES agency_plans(id),
    stripe_customer_id TEXT,
    billing_email TEXT,
    billing_cycle_start TIMESTAMPTZ DEFAULT NOW(),
    monthly_credit_allocation INTEGER DEFAULT 0,
    credit_pool INTEGER DEFAULT 0,
    credits_used_this_cycle INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{
        "branding": {
            "logo_url": null,
            "favicon_url": null,
            "app_name": "Agency Studio",
            "primary_color": "#6366f1",
            "secondary_color": "#10b981"
        },
        "features": {
            "image_gen": true,
            "video_gen": true,
            "editing": true,
            "chat": true,
            "nsfw_enabled": true,
            "models_allowed": ["seedream", "nanoBanana", "qwen", "kling", "wan", "veo"]
        },
        "defaults": {
            "default_model": "seedream",
            "default_credits_per_user": null
        }
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agency Users (users within an agency)
CREATE TABLE IF NOT EXISTS agency_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    auth_user_id UUID UNIQUE,
    email TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    credit_limit INTEGER,
    credits_used_this_cycle INTEGER DEFAULT 0,
    status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended')),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agency_id, email)
);

-- Agency Models (creators/talent managed by the agency)
CREATE TABLE IF NOT EXISTS agency_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    avatar_url TEXT,
    lora_config JSONB DEFAULT '{}'::jsonb,
    onlyfans_handle TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    portal_token UUID DEFAULT uuid_generate_v4() UNIQUE,
    email TEXT,
    phone TEXT,
    bio TEXT,
    joined_date DATE DEFAULT CURRENT_DATE,
    social_media JSONB DEFAULT '{}',
    contract_split TEXT,
    contract_notes TEXT,
    content_preferences JSONB DEFAULT '{}',
    field_visibility JSONB DEFAULT '{
        "email": false,
        "phone": false,
        "bio": true,
        "social_media": true,
        "onlyfans_handle": true,
        "joined_date": false,
        "contract_split": false,
        "contract_notes": false,
        "content_preferences": false
    }',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agency_id, slug)
);

-- Generations (track all generated content)
CREATE TABLE IF NOT EXISTS generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES agency_users(id) ON DELETE CASCADE,
    model_id UUID REFERENCES agency_models(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('image', 'video', 'edit', 'chat')),
    model TEXT NOT NULL,
    prompt TEXT,
    parameters JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    result_url TEXT,
    result_metadata JSONB,
    error_message TEXT,
    credits_cost INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Gallery Items (saved/favorited content)
CREATE TABLE IF NOT EXISTS gallery_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES agency_users(id) ON DELETE CASCADE,
    generation_id UUID REFERENCES generations(id) ON DELETE SET NULL,
    model_id UUID REFERENCES agency_models(id) ON DELETE SET NULL,
    title TEXT,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    type TEXT NOT NULL CHECK (type IN ('image', 'video')),
    source TEXT DEFAULT 'generated' CHECK (source IN ('upload', 'generated', 'model_upload', 'workflow')),
    is_favorited BOOLEAN DEFAULT false,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- WORKFLOW TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    model_id UUID REFERENCES agency_models(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_template BOOLEAN DEFAULT false,
    source_workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    created_by UUID REFERENCES agency_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL,
    label TEXT NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    position_x FLOAT DEFAULT 0,
    position_y FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    source_port TEXT NOT NULL,
    target_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    target_port TEXT NOT NULL,
    UNIQUE(workflow_id, target_node_id, target_port)
);

CREATE TABLE IF NOT EXISTS workflow_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    model_id UUID REFERENCES agency_models(id) ON DELETE SET NULL,
    started_by UUID REFERENCES agency_users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'waiting_for_review', 'completed', 'failed', 'cancelled')),
    credits_used INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS workflow_node_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'waiting_for_review', 'completed', 'failed', 'skipped')),
    output JSONB DEFAULT '{}'::jsonb,
    error TEXT,
    credits_used INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE(run_id, node_id)
);

CREATE TABLE IF NOT EXISTS workflow_triggers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'webhook')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    schedule_config JSONB,
    webhook_token TEXT UNIQUE,
    next_trigger_at TIMESTAMPTZ,
    last_triggered_at TIMESTAMPTZ,
    max_concurrent_runs INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CONTENT REQUEST TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS content_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES agency_models(id) ON DELETE CASCADE,
    created_by UUID REFERENCES agency_users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    reference_urls JSONB DEFAULT '[]'::jsonb,
    quantity_photo INTEGER DEFAULT 0,
    quantity_video INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    due_date TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'delivered', 'approved', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_request_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES agency_models(id) ON DELETE CASCADE,
    request_id UUID REFERENCES content_requests(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    file_name TEXT,
    file_type TEXT DEFAULT 'image' CHECK (file_type IN ('image', 'video')),
    file_size INTEGER,
    status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
    rejection_note TEXT,
    reviewed_by UUID REFERENCES agency_users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    gallery_item_id UUID REFERENCES gallery_items(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MODEL INVITATIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS model_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    invite_token UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    invited_by UUID REFERENCES agency_users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
    custom_message TEXT,
    model_id UUID REFERENCES agency_models(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agency_id, email)
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_agencies_slug ON agencies(slug);
CREATE INDEX IF NOT EXISTS idx_agencies_custom_domain ON agencies(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agencies_status ON agencies(status);

CREATE INDEX IF NOT EXISTS idx_agency_users_agency ON agency_users(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_users_auth_user ON agency_users(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agency_users_email ON agency_users(email);
CREATE INDEX IF NOT EXISTS idx_agency_users_status ON agency_users(status);

CREATE INDEX IF NOT EXISTS idx_generations_agency ON generations(agency_id);
CREATE INDEX IF NOT EXISTS idx_generations_user ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created ON generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);

CREATE INDEX IF NOT EXISTS idx_agency_models_agency ON agency_models(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_models_slug ON agency_models(agency_id, slug);
CREATE INDEX IF NOT EXISTS idx_agency_models_portal_token ON agency_models(portal_token);
CREATE INDEX IF NOT EXISTS idx_agency_models_email ON agency_models(email);
CREATE INDEX IF NOT EXISTS idx_agency_models_phone ON agency_models(phone);

CREATE INDEX IF NOT EXISTS idx_gallery_items_agency_user ON gallery_items(agency_id, user_id);
CREATE INDEX IF NOT EXISTS idx_gallery_items_agency_model ON gallery_items(agency_id, model_id);
CREATE INDEX IF NOT EXISTS idx_gallery_items_created ON gallery_items(created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_workflow_triggers_next ON workflow_triggers (next_trigger_at) WHERE enabled = true AND trigger_type = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_workflow ON workflow_triggers (workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_agency ON workflow_triggers (agency_id);

CREATE INDEX IF NOT EXISTS idx_content_requests_agency ON content_requests(agency_id);
CREATE INDEX IF NOT EXISTS idx_content_requests_model ON content_requests(model_id);
CREATE INDEX IF NOT EXISTS idx_content_requests_status ON content_requests(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_content_request_uploads_request ON content_request_uploads(request_id);
CREATE INDEX IF NOT EXISTS idx_content_request_uploads_model ON content_request_uploads(model_id);
CREATE INDEX IF NOT EXISTS idx_content_request_uploads_status ON content_request_uploads(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_content_request_uploads_metadata ON content_request_uploads USING gin(metadata);

CREATE INDEX IF NOT EXISTS idx_model_invitations_token ON model_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_model_invitations_agency ON model_invitations(agency_id);
CREATE INDEX IF NOT EXISTS idx_model_invitations_email ON model_invitations(email);
CREATE INDEX IF NOT EXISTS idx_model_invitations_status ON model_invitations(status);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_node_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_request_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_invitations ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's agency_id
CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT agency_id
        FROM agency_users
        WHERE auth_user_id = auth.uid()
        AND status = 'active'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_agency_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM agency_users
        WHERE auth_user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Agencies
CREATE POLICY "Users can view their own agency" ON agencies FOR SELECT USING (id = get_user_agency_id());

-- Agency Users
CREATE POLICY "Users can view agency members" ON agency_users FOR SELECT USING (agency_id = get_user_agency_id());
CREATE POLICY "Admins can invite users" ON agency_users FOR INSERT WITH CHECK (agency_id = get_user_agency_id() AND is_agency_admin());
CREATE POLICY "Admins can update users" ON agency_users FOR UPDATE USING (agency_id = get_user_agency_id() AND is_agency_admin());
CREATE POLICY "Admins can delete users" ON agency_users FOR DELETE USING (agency_id = get_user_agency_id() AND is_agency_admin());

-- Agency Models
CREATE POLICY "Users can view agency models" ON agency_models FOR SELECT USING (agency_id = get_user_agency_id());
CREATE POLICY "Admins can create models" ON agency_models FOR INSERT WITH CHECK (agency_id = get_user_agency_id() AND is_agency_admin());
CREATE POLICY "Admins can update models" ON agency_models FOR UPDATE USING (agency_id = get_user_agency_id() AND is_agency_admin());
CREATE POLICY "Admins can delete models" ON agency_models FOR DELETE USING (agency_id = get_user_agency_id() AND is_agency_admin());

-- Generations
CREATE POLICY "Users can view agency generations" ON generations FOR SELECT USING (agency_id = get_user_agency_id());
CREATE POLICY "Users can create generations" ON generations FOR INSERT WITH CHECK (agency_id = get_user_agency_id() AND user_id IN (SELECT id FROM agency_users WHERE auth_user_id = auth.uid()));

-- Gallery Items
CREATE POLICY "Users can view agency gallery" ON gallery_items FOR SELECT USING (agency_id = get_user_agency_id());
CREATE POLICY "Users can manage their gallery items" ON gallery_items FOR ALL USING (user_id IN (SELECT id FROM agency_users WHERE auth_user_id = auth.uid()));

-- Workflows
CREATE POLICY "Users can view agency workflows" ON workflows FOR SELECT USING (agency_id = get_user_agency_id());
CREATE POLICY "Users can create workflows" ON workflows FOR INSERT WITH CHECK (agency_id = get_user_agency_id());
CREATE POLICY "Users can update own workflows or admin any" ON workflows FOR UPDATE USING (agency_id = get_user_agency_id() AND (created_by IN (SELECT id FROM agency_users WHERE auth_user_id = auth.uid()) OR is_agency_admin()));
CREATE POLICY "Users can delete own workflows or admin any" ON workflows FOR DELETE USING (agency_id = get_user_agency_id() AND (created_by IN (SELECT id FROM agency_users WHERE auth_user_id = auth.uid()) OR is_agency_admin()));

-- Workflow Nodes
CREATE POLICY "Users can view workflow nodes" ON workflow_nodes FOR SELECT USING (workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id()));
CREATE POLICY "Users can manage workflow nodes" ON workflow_nodes FOR ALL USING (workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id() AND (created_by IN (SELECT id FROM agency_users WHERE auth_user_id = auth.uid()) OR is_agency_admin())));

-- Workflow Edges
CREATE POLICY "Users can view workflow edges" ON workflow_edges FOR SELECT USING (workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id()));
CREATE POLICY "Users can manage workflow edges" ON workflow_edges FOR ALL USING (workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id() AND (created_by IN (SELECT id FROM agency_users WHERE auth_user_id = auth.uid()) OR is_agency_admin())));

-- Workflow Runs
CREATE POLICY "Users can view workflow runs" ON workflow_runs FOR SELECT USING (workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id()));
CREATE POLICY "Users can create workflow runs" ON workflow_runs FOR INSERT WITH CHECK (workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id()));
CREATE POLICY "Users can update own runs or admin any" ON workflow_runs FOR UPDATE USING (workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id()) AND (started_by IN (SELECT id FROM agency_users WHERE auth_user_id = auth.uid()) OR is_agency_admin()));

-- Workflow Node Results
CREATE POLICY "Users can view node results" ON workflow_node_results FOR SELECT USING (run_id IN (SELECT id FROM workflow_runs WHERE workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id())));
CREATE POLICY "Users can manage node results" ON workflow_node_results FOR ALL USING (run_id IN (SELECT id FROM workflow_runs WHERE workflow_id IN (SELECT id FROM workflows WHERE agency_id = get_user_agency_id())));

-- Workflow Triggers
CREATE POLICY "Users can view agency workflow triggers" ON workflow_triggers FOR SELECT USING (agency_id = get_user_agency_id());
CREATE POLICY "Users can create workflow triggers" ON workflow_triggers FOR INSERT WITH CHECK (agency_id = get_user_agency_id());
CREATE POLICY "Users can update agency workflow triggers" ON workflow_triggers FOR UPDATE USING (agency_id = get_user_agency_id());
CREATE POLICY "Users can delete agency workflow triggers" ON workflow_triggers FOR DELETE USING (agency_id = get_user_agency_id());

-- Content Requests
CREATE POLICY "Users can view content requests" ON content_requests FOR SELECT USING (agency_id = get_user_agency_id());
CREATE POLICY "Users can create content requests" ON content_requests FOR INSERT WITH CHECK (agency_id = get_user_agency_id());
CREATE POLICY "Users can update content requests" ON content_requests FOR UPDATE USING (agency_id = get_user_agency_id());
CREATE POLICY "Admins can delete content requests" ON content_requests FOR DELETE USING (agency_id = get_user_agency_id() AND is_agency_admin());

-- Content Request Uploads
CREATE POLICY "Users can view uploads" ON content_request_uploads FOR SELECT USING (agency_id = get_user_agency_id());
CREATE POLICY "Users can update uploads" ON content_request_uploads FOR UPDATE USING (agency_id = get_user_agency_id());
CREATE POLICY "Admins can delete uploads" ON content_request_uploads FOR DELETE USING (agency_id = get_user_agency_id() AND is_agency_admin());

-- Model Invitations
CREATE POLICY "Agency admins can view their invitations" ON model_invitations FOR SELECT USING (agency_id = get_user_agency_id() AND is_agency_admin());
CREATE POLICY "Agency admins can create invitations" ON model_invitations FOR INSERT WITH CHECK (agency_id = get_user_agency_id() AND is_agency_admin());
CREATE POLICY "Agency admins can update their invitations" ON model_invitations FOR UPDATE USING (agency_id = get_user_agency_id() AND is_agency_admin());
CREATE POLICY "Agency admins can delete their invitations" ON model_invitations FOR DELETE USING (agency_id = get_user_agency_id() AND is_agency_admin());

-- =============================================
-- FUNCTIONS
-- =============================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Atomic credit deduction
CREATE OR REPLACE FUNCTION deduct_agency_credits(p_agency_id UUID, p_amount INTEGER)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
    new_pool INTEGER;
BEGIN
    UPDATE agencies
    SET credit_pool = credit_pool - p_amount,
        credits_used_this_cycle = credits_used_this_cycle + p_amount
    WHERE id = p_agency_id AND credit_pool >= p_amount
    RETURNING credit_pool INTO new_pool;
    IF NOT FOUND THEN RETURN -1; END IF;
    RETURN new_pool;
END;
$$;

-- Increment user credits used
CREATE OR REPLACE FUNCTION increment_user_credits_used(p_user_id UUID, p_amount INTEGER)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    UPDATE agency_users SET credits_used_this_cycle = credits_used_this_cycle + p_amount WHERE id = p_user_id;
END;
$$;

-- Link auth user to agency_user on signup
CREATE OR REPLACE FUNCTION link_auth_user_to_agency()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE agency_users
    SET auth_user_id = NEW.id, status = 'active', joined_at = NOW()
    WHERE email = NEW.email AND status = 'invited' AND auth_user_id IS NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGERS
-- =============================================

DROP TRIGGER IF EXISTS update_agencies_updated_at ON agencies;
CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON agencies FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_agency_users_updated_at ON agency_users;
CREATE TRIGGER update_agency_users_updated_at BEFORE UPDATE ON agency_users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_agency_models_updated_at ON agency_models;
CREATE TRIGGER update_agency_models_updated_at BEFORE UPDATE ON agency_models FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_gallery_items_updated_at ON gallery_items;
CREATE TRIGGER update_gallery_items_updated_at BEFORE UPDATE ON gallery_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflows;
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_workflow_nodes_updated_at ON workflow_nodes;
CREATE TRIGGER update_workflow_nodes_updated_at BEFORE UPDATE ON workflow_nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_workflow_triggers_updated_at ON workflow_triggers;
CREATE TRIGGER update_workflow_triggers_updated_at BEFORE UPDATE ON workflow_triggers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_content_requests_updated_at ON content_requests;
CREATE TRIGGER update_content_requests_updated_at BEFORE UPDATE ON content_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_model_invitations_updated_at ON model_invitations;
CREATE TRIGGER trigger_model_invitations_updated_at BEFORE UPDATE ON model_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION link_auth_user_to_agency();

-- =============================================
-- SEED DATA
-- =============================================

-- Insert default plans
INSERT INTO agency_plans (name, description, monthly_credits, max_users, price_cents, custom_domain_allowed, features) VALUES
('Starter', 'Perfect for small teams getting started', 5000, 5, 9900, false, '{"priority_support": false}'::jsonb),
('Professional', 'For growing agencies with more needs', 20000, 25, 29900, true, '{"priority_support": true}'::jsonb),
('Enterprise', 'Custom solution for large organizations', 100000, 999, 99900, true, '{"priority_support": true, "dedicated_support": true}'::jsonb)
ON CONFLICT DO NOTHING;

-- Insert fresh-test agency (matches DEFAULT_AGENCY_SLUG in backend .env)
INSERT INTO agencies (name, slug, status, plan_id, monthly_credit_allocation, credit_pool, settings)
VALUES (
    'Fresh Test Agency',
    'fresh-test',
    'active',
    (SELECT id FROM agency_plans WHERE name = 'Professional'),
    20000,
    20000,
    '{
        "branding": {
            "logo_url": null,
            "favicon_url": null,
            "app_name": "Agency Studio",
            "primary_color": "#6366f1",
            "secondary_color": "#10b981"
        },
        "features": {
            "image_gen": true,
            "video_gen": true,
            "editing": true,
            "chat": true,
            "nsfw_enabled": true,
            "models_allowed": ["seedream", "nanoBanana", "qwen", "kling", "wan", "veo"]
        },
        "defaults": {
            "default_model": "seedream",
            "default_credits_per_user": null
        }
    }'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- DONE! Now you need to:
-- 1. Create a user in Supabase Auth (Authentication > Users > Add user)
-- 2. Run the SQL below to add them to the agency
-- =============================================

-- AFTER creating a user in Auth, run this (replace the email):
--
-- INSERT INTO agency_users (agency_id, auth_user_id, email, name, role, status, joined_at)
-- SELECT
--     (SELECT id FROM agencies WHERE slug = 'fresh-test'),
--     id,
--     email,
--     'Admin User',
--     'owner',
--     'active',
--     NOW()
-- FROM auth.users
-- WHERE email = 'YOUR_EMAIL_HERE';
