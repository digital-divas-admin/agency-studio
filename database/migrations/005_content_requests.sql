-- =============================================
-- Migration: Content Requests & Model Portal
-- Adds content request system for manager-to-model
-- content ordering and a model upload portal.
-- =============================================

-- 1. Add portal_token to agency_models for model upload portal auth
ALTER TABLE agency_models
    ADD COLUMN IF NOT EXISTS portal_token UUID DEFAULT uuid_generate_v4() UNIQUE;

-- Backfill existing models with tokens
UPDATE agency_models SET portal_token = uuid_generate_v4() WHERE portal_token IS NULL;

-- 2. Expand gallery_items source check to include 'model_upload'
ALTER TABLE gallery_items DROP CONSTRAINT IF EXISTS gallery_items_source_check;
ALTER TABLE gallery_items
    ADD CONSTRAINT gallery_items_source_check
    CHECK (source IN ('upload', 'generated', 'model_upload', 'workflow'));

-- 3. Create content_requests table
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

-- 4. Create content_request_uploads table
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

    -- Review status
    status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
    rejection_note TEXT,
    reviewed_by UUID REFERENCES agency_users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,

    -- Link to gallery_item if approved and imported
    gallery_item_id UUID REFERENCES gallery_items(id) ON DELETE SET NULL,

    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_content_requests_agency ON content_requests(agency_id);
CREATE INDEX IF NOT EXISTS idx_content_requests_model ON content_requests(model_id);
CREATE INDEX IF NOT EXISTS idx_content_requests_status ON content_requests(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_content_request_uploads_request ON content_request_uploads(request_id);
CREATE INDEX IF NOT EXISTS idx_content_request_uploads_model ON content_request_uploads(model_id);
CREATE INDEX IF NOT EXISTS idx_content_request_uploads_status ON content_request_uploads(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_agency_models_portal_token ON agency_models(portal_token);

-- 6. RLS
ALTER TABLE content_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_request_uploads ENABLE ROW LEVEL SECURITY;

-- Content requests: agency users can view, admins can manage
CREATE POLICY "Users can view content requests"
    ON content_requests FOR SELECT
    USING (agency_id = get_user_agency_id());

CREATE POLICY "Users can create content requests"
    ON content_requests FOR INSERT
    WITH CHECK (agency_id = get_user_agency_id());

CREATE POLICY "Users can update content requests"
    ON content_requests FOR UPDATE
    USING (agency_id = get_user_agency_id());

CREATE POLICY "Admins can delete content requests"
    ON content_requests FOR DELETE
    USING (agency_id = get_user_agency_id() AND is_agency_admin());

-- Uploads: agency users can view, service role handles inserts from portal
CREATE POLICY "Users can view uploads"
    ON content_request_uploads FOR SELECT
    USING (agency_id = get_user_agency_id());

CREATE POLICY "Users can update uploads"
    ON content_request_uploads FOR UPDATE
    USING (agency_id = get_user_agency_id());

CREATE POLICY "Admins can delete uploads"
    ON content_request_uploads FOR DELETE
    USING (agency_id = get_user_agency_id() AND is_agency_admin());

-- 7. Auto-update triggers
CREATE TRIGGER update_content_requests_updated_at
    BEFORE UPDATE ON content_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
