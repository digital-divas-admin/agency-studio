-- Migration: Model Invitations System
-- Description: Add support for email-based model invitations and self-service onboarding

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create model_invitations table
CREATE TABLE model_invitations (
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

-- Indexes for performance
CREATE INDEX idx_model_invitations_token ON model_invitations(invite_token);
CREATE INDEX idx_model_invitations_agency ON model_invitations(agency_id);
CREATE INDEX idx_model_invitations_email ON model_invitations(email);
CREATE INDEX idx_model_invitations_status ON model_invitations(status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_model_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_model_invitations_updated_at
    BEFORE UPDATE ON model_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_model_invitations_updated_at();

-- Enable RLS
ALTER TABLE model_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Admin users can view all invitations for their agency
CREATE POLICY "Agency admins can view their invitations"
    ON model_invitations
    FOR SELECT
    USING (agency_id = get_user_agency_id() AND is_agency_admin());

-- Admin users can create invitations for their agency
CREATE POLICY "Agency admins can create invitations"
    ON model_invitations
    FOR INSERT
    WITH CHECK (agency_id = get_user_agency_id() AND is_agency_admin());

-- Admin users can update invitations for their agency (cancel, etc.)
CREATE POLICY "Agency admins can update their invitations"
    ON model_invitations
    FOR UPDATE
    USING (agency_id = get_user_agency_id() AND is_agency_admin());

-- Admin users can delete invitations for their agency
CREATE POLICY "Agency admins can delete their invitations"
    ON model_invitations
    FOR DELETE
    USING (agency_id = get_user_agency_id() AND is_agency_admin());

-- Comment on table
COMMENT ON TABLE model_invitations IS 'Tracks email-based model invitations for self-service onboarding';
COMMENT ON COLUMN model_invitations.invite_token IS 'UUID token used in invitation URL (public, single-use)';
COMMENT ON COLUMN model_invitations.status IS 'Invitation status: pending, accepted, expired, or cancelled';
COMMENT ON COLUMN model_invitations.expires_at IS 'Invitation expiration timestamp (default 14 days from creation)';
COMMENT ON COLUMN model_invitations.custom_message IS 'Optional personal message from admin to model';
