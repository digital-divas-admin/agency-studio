-- =============================================
-- Migration: Agency Models Feature
-- Run this against your existing database to add
-- the agency_models table and model_id/source columns.
-- =============================================

-- 1. Create agency_models table
CREATE TABLE IF NOT EXISTS agency_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    avatar_url TEXT,

    -- LoRA configuration for AI generation (RunPod)
    lora_config JSONB DEFAULT '{}'::jsonb,
    -- Expected shape: { "path": "model.safetensors", "triggerWord": "sks_name", "weight": 0.7 }

    -- Metadata
    onlyfans_handle TEXT,
    notes TEXT,

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(agency_id, slug)
);

-- 2. Add model_id to generations (nullable — backwards compatible)
ALTER TABLE generations
    ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES agency_models(id) ON DELETE SET NULL;

-- 3. Add model_id and source to gallery_items
ALTER TABLE gallery_items
    ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES agency_models(id) ON DELETE SET NULL;

ALTER TABLE gallery_items
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'generated' CHECK (source IN ('upload', 'generated'));

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_agency_models_agency ON agency_models(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_models_slug ON agency_models(agency_id, slug);
CREATE INDEX IF NOT EXISTS idx_gallery_items_agency_model ON gallery_items(agency_id, model_id);

-- 5. RLS
ALTER TABLE agency_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agency models"
    ON agency_models FOR SELECT
    USING (agency_id = get_user_agency_id());

CREATE POLICY "Admins can create models"
    ON agency_models FOR INSERT
    WITH CHECK (agency_id = get_user_agency_id() AND is_agency_admin());

CREATE POLICY "Admins can update models"
    ON agency_models FOR UPDATE
    USING (agency_id = get_user_agency_id() AND is_agency_admin());

CREATE POLICY "Admins can delete models"
    ON agency_models FOR DELETE
    USING (agency_id = get_user_agency_id() AND is_agency_admin());

-- 6. Auto-update updated_at trigger
CREATE TRIGGER update_agency_models_updated_at
    BEFORE UPDATE ON agency_models
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
