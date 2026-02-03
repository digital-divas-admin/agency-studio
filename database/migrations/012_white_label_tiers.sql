-- Migration 012: White-Label Tier System
-- Adds tiered white-label customization capabilities

-- Add tier columns to agency_plans
ALTER TABLE agency_plans ADD COLUMN IF NOT EXISTS white_label_tier TEXT
  DEFAULT 'none' CHECK (white_label_tier IN ('none', 'basic', 'professional', 'enterprise'));

ALTER TABLE agency_plans ADD COLUMN IF NOT EXISTS white_label_features JSONB DEFAULT '{
  "branding": {
    "logo_upload": false,
    "favicon": false,
    "primary_color": false,
    "secondary_color": false,
    "full_color_palette": false,
    "custom_css": false,
    "login_customization": false
  },
  "domain": {
    "subdomain": true,
    "custom_domain": false
  },
  "email": {
    "agency_name_sender": false,
    "custom_templates": false
  },
  "ui": {
    "hide_powered_by": false,
    "remove_platform_references": false
  }
}'::jsonb;

-- Create custom_domains table for Professional/Enterprise tier
CREATE TABLE IF NOT EXISTS custom_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  domain TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending_verification' CHECK (status IN (
    'pending_verification', 'dns_verified', 'ssl_provisioning', 'active', 'failed', 'disabled'
  )),
  verification_token TEXT UNIQUE NOT NULL,
  dns_verified_at TIMESTAMPTZ,
  ssl_provisioned_at TIMESTAMPTZ,
  ssl_expires_at TIMESTAMPTZ,
  last_health_check TIMESTAMPTZ,
  created_by UUID REFERENCES agency_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_domains_agency ON custom_domains(agency_id);
CREATE INDEX idx_custom_domains_domain ON custom_domains(domain);
CREATE INDEX idx_custom_domains_status ON custom_domains(status);

-- Create asset_uploads table for tracking branding assets
CREATE TABLE IF NOT EXISTS asset_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'logo', 'favicon', 'login_background', 'email_header_logo'
  )),
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES agency_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_logo_size CHECK (
    asset_type != 'logo' OR file_size_bytes <= 2097152  -- 2MB
  ),
  CONSTRAINT valid_favicon_size CHECK (
    asset_type != 'favicon' OR file_size_bytes <= 524288  -- 512KB
  ),
  CONSTRAINT valid_login_bg_size CHECK (
    asset_type != 'login_background' OR file_size_bytes <= 5242880  -- 5MB
  )
);

CREATE INDEX idx_asset_uploads_agency ON asset_uploads(agency_id);
CREATE INDEX idx_asset_uploads_type ON asset_uploads(asset_type);

-- Seed tier data for existing plans (assuming plans exist from previous migrations)
-- Update Starter plan to have no white-label features
UPDATE agency_plans SET
  white_label_tier = 'none',
  white_label_features = '{
    "branding": {
      "logo_upload": false,
      "favicon": false,
      "primary_color": false,
      "secondary_color": false,
      "full_color_palette": false,
      "custom_css": false,
      "login_customization": false
    },
    "domain": {
      "subdomain": true,
      "custom_domain": false
    },
    "email": {
      "agency_name_sender": false,
      "custom_templates": false
    },
    "ui": {
      "hide_powered_by": false,
      "remove_platform_references": false
    }
  }'::jsonb
WHERE name = 'Starter';

-- Update Professional plan to have Professional tier features
UPDATE agency_plans SET
  white_label_tier = 'professional',
  white_label_features = '{
    "branding": {
      "logo_upload": true,
      "favicon": true,
      "primary_color": true,
      "secondary_color": true,
      "full_color_palette": false,
      "custom_css": false,
      "login_customization": true
    },
    "domain": {
      "subdomain": true,
      "custom_domain": true
    },
    "email": {
      "agency_name_sender": true,
      "custom_templates": false
    },
    "ui": {
      "hide_powered_by": true,
      "remove_platform_references": false
    }
  }'::jsonb
WHERE name = 'Professional';

-- Update Enterprise plan to have all white-label features
UPDATE agency_plans SET
  white_label_tier = 'enterprise',
  white_label_features = '{
    "branding": {
      "logo_upload": true,
      "favicon": true,
      "primary_color": true,
      "secondary_color": true,
      "full_color_palette": true,
      "custom_css": true,
      "login_customization": true
    },
    "domain": {
      "subdomain": true,
      "custom_domain": true
    },
    "email": {
      "agency_name_sender": true,
      "custom_templates": true
    },
    "ui": {
      "hide_powered_by": true,
      "remove_platform_references": true
    }
  }'::jsonb
WHERE name = 'Enterprise';

-- Add comment for documentation
COMMENT ON TABLE custom_domains IS 'Custom domain configurations for Professional and Enterprise tiers';
COMMENT ON TABLE asset_uploads IS 'Tracks uploaded branding assets (logos, favicons, backgrounds)';
COMMENT ON COLUMN agency_plans.white_label_tier IS 'White-label tier: none, basic, professional, or enterprise';
COMMENT ON COLUMN agency_plans.white_label_features IS 'JSONB map of enabled white-label features for this plan';
