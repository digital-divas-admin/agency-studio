-- =============================================
-- Migration 010: Self-Serve Onboarding
-- Adds support for self-serve signup, trials, and invitations
-- =============================================

-- Add trial and onboarding tracking to agencies
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS signup_source TEXT DEFAULT 'self-serve' CHECK (signup_source IN ('self-serve', 'sales-led'));
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled'));

-- Update existing agencies to have completed onboarding and active status
UPDATE agencies SET
  onboarding_completed = TRUE,
  subscription_status = 'active'
WHERE onboarding_completed IS NULL OR subscription_status IS NULL;

-- Add premium features columns (for future premium tier)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS email_domain TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS white_label_config JSONB DEFAULT '{
  "hide_powered_by": false,
  "custom_model_portal": false,
  "content_watermark": false
}'::jsonb;

-- Invitation tokens table for email-based team invitations
CREATE TABLE IF NOT EXISTS invitation_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by UUID REFERENCES agency_users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick token lookup
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_token ON invitation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_agency ON invitation_tokens(agency_id);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_email ON invitation_tokens(email);

-- Audit logs table (for premium tier)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES agency_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_agency ON audit_logs(agency_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- API keys table (for premium tier)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 chars for display (e.g., "ask_1234...")
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES agency_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,

  CONSTRAINT api_keys_agency_name_unique UNIQUE (agency_id, name)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_agency ON api_keys(agency_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(agency_id) WHERE revoked_at IS NULL;

-- Webhook subscriptions table (for premium tier)
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES agency_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ,

  CONSTRAINT webhook_subscriptions_url_unique UNIQUE (agency_id, url)
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_agency ON webhook_subscriptions(agency_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_enabled ON webhook_subscriptions(agency_id) WHERE enabled = TRUE;

-- Function to auto-expire invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  -- Mark invitations as expired if they're past expiration and not accepted
  -- (We don't delete them to maintain audit trail)
  UPDATE invitation_tokens
  SET expires_at = NOW() - INTERVAL '1 day'
  WHERE expires_at < NOW()
  AND accepted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to generate a secure random token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
  exists_token BOOLEAN;
BEGIN
  LOOP
    -- Generate a random token (32 chars)
    token := encode(gen_random_bytes(24), 'base64');
    token := replace(token, '/', '_');
    token := replace(token, '+', '-');

    -- Check if it exists
    SELECT EXISTS(SELECT 1 FROM invitation_tokens WHERE invitation_tokens.token = token) INTO exists_token;

    -- Exit loop if unique
    EXIT WHEN NOT exists_token;
  END LOOP;

  RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Update the agencies status check constraint to include new subscription statuses
ALTER TABLE agencies DROP CONSTRAINT IF EXISTS agencies_status_check;
ALTER TABLE agencies ADD CONSTRAINT agencies_status_check
  CHECK (status IN ('trial', 'active', 'suspended', 'cancelled'));

-- Comment for documentation
COMMENT ON TABLE invitation_tokens IS 'Stores email invitation tokens for team member invitations';
COMMENT ON TABLE audit_logs IS 'Audit trail for sensitive actions (Premium feature)';
COMMENT ON TABLE api_keys IS 'API keys for programmatic access (Premium feature)';
COMMENT ON TABLE webhook_subscriptions IS 'Webhook subscriptions for event notifications (Premium feature)';
COMMENT ON COLUMN agencies.onboarding_completed IS 'Whether the agency has completed the initial onboarding wizard';
COMMENT ON COLUMN agencies.trial_ends_at IS 'When the trial period ends (7 days from signup)';
COMMENT ON COLUMN agencies.signup_source IS 'How the agency was created: self-serve or sales-led';
COMMENT ON COLUMN agencies.subscription_status IS 'Current subscription status independent of agency status';
