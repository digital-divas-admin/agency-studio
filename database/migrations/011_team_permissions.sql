-- =============================================
-- Migration 011: Team Permissions & Model Assignments
-- Adds granular permissions, creator assignments, and enhanced team management
-- =============================================

-- =============================================
-- 1. User-Model Assignments Table
-- =============================================
CREATE TABLE IF NOT EXISTS user_model_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES agency_users(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES agency_models(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES agency_users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_user_model_assignments_user ON user_model_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_model_assignments_model ON user_model_assignments(model_id);

COMMENT ON TABLE user_model_assignments IS 'Many-to-many relationship between users and creators/models';
COMMENT ON COLUMN user_model_assignments.user_id IS 'The user (team member) being assigned';
COMMENT ON COLUMN user_model_assignments.model_id IS 'The creator/model being assigned to the user';
COMMENT ON COLUMN user_model_assignments.assigned_by IS 'The admin who made the assignment';

-- =============================================
-- 2. Add Permissions Field to Agency Users
-- =============================================
ALTER TABLE agency_users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{
  "scope": "all",
  "can_view_analytics": true,
  "can_send_messages": true,
  "can_upload_content": true,
  "can_publish_content": false,
  "can_view_subscribers": false,
  "can_export_data": false,
  "can_edit_profiles": false
}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_agency_users_permissions ON agency_users USING gin(permissions);

COMMENT ON COLUMN agency_users.permissions IS 'Granular permissions JSONB object. scope can be "all" or "assigned"';

-- =============================================
-- 3. Enhance Invitation Tokens
-- =============================================
ALTER TABLE invitation_tokens ADD COLUMN IF NOT EXISTS custom_message TEXT;
ALTER TABLE invitation_tokens ADD COLUMN IF NOT EXISTS assigned_models UUID[];

-- Add constraint for custom message length
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invitation_custom_message_length'
  ) THEN
    ALTER TABLE invitation_tokens ADD CONSTRAINT invitation_custom_message_length
      CHECK (char_length(custom_message) <= 500);
  END IF;
END $$;

COMMENT ON COLUMN invitation_tokens.custom_message IS 'Optional personalized message from inviter (max 500 chars)';
COMMENT ON COLUMN invitation_tokens.assigned_models IS 'Array of model IDs to assign to user upon acceptance';

-- =============================================
-- 4. Team Activity Log
-- =============================================
CREATE TABLE IF NOT EXISTS team_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES agency_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'invite_sent', 'invite_resent', 'invite_revoked',
    'user_joined', 'user_removed', 'user_suspended', 'user_activated',
    'role_changed', 'permissions_updated', 'models_assigned', 'models_unassigned'
  )),
  target_user_id UUID REFERENCES agency_users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_activity_agency ON team_activity_log(agency_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_created ON team_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_activity_actor ON team_activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_target ON team_activity_log(target_user_id);

COMMENT ON TABLE team_activity_log IS 'Audit trail for team management actions';
COMMENT ON COLUMN team_activity_log.metadata IS 'Additional context (e.g., permission changes, model names)';

-- =============================================
-- 5. Default Permission Presets Function
-- =============================================
CREATE OR REPLACE FUNCTION get_default_permissions(user_role TEXT)
RETURNS JSONB AS $$
BEGIN
  RETURN CASE user_role
    WHEN 'owner' THEN '{
      "scope": "all",
      "can_view_analytics": true,
      "can_send_messages": true,
      "can_upload_content": true,
      "can_publish_content": true,
      "can_view_subscribers": true,
      "can_export_data": true,
      "can_edit_profiles": true
    }'::jsonb
    WHEN 'admin' THEN '{
      "scope": "all",
      "can_view_analytics": true,
      "can_send_messages": true,
      "can_upload_content": true,
      "can_publish_content": true,
      "can_view_subscribers": true,
      "can_export_data": true,
      "can_edit_profiles": true
    }'::jsonb
    WHEN 'member' THEN '{
      "scope": "assigned",
      "can_view_analytics": false,
      "can_send_messages": true,
      "can_upload_content": true,
      "can_publish_content": false,
      "can_view_subscribers": false,
      "can_export_data": false,
      "can_edit_profiles": false
    }'::jsonb
    ELSE '{
      "scope": "assigned",
      "can_view_analytics": false,
      "can_send_messages": false,
      "can_upload_content": false,
      "can_publish_content": false,
      "can_view_subscribers": false,
      "can_export_data": false,
      "can_edit_profiles": false
    }'::jsonb
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_default_permissions IS 'Returns default permission preset based on user role';

-- =============================================
-- 6. Helper Function: Check Model Access
-- =============================================
CREATE OR REPLACE FUNCTION user_can_access_model(p_user_id UUID, p_model_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_scope TEXT;
  v_role TEXT;
  v_agency_id UUID;
  v_model_agency_id UUID;
  v_has_assignment BOOLEAN;
BEGIN
  -- Get user's scope, role, and agency
  SELECT
    (permissions->>'scope')::TEXT,
    role,
    agency_id
  INTO v_scope, v_role, v_agency_id
  FROM agency_users
  WHERE id = p_user_id;

  -- Get model's agency
  SELECT agency_id INTO v_model_agency_id
  FROM agency_models
  WHERE id = p_model_id;

  -- Must be in same agency
  IF v_agency_id IS NULL OR v_agency_id != v_model_agency_id THEN
    RETURN FALSE;
  END IF;

  -- Owners and admins always have access if scope is 'all'
  IF (v_role IN ('owner', 'admin') AND v_scope = 'all') THEN
    RETURN TRUE;
  END IF;

  -- Check if user has explicit assignment
  SELECT EXISTS(
    SELECT 1 FROM user_model_assignments
    WHERE user_id = p_user_id AND model_id = p_model_id
  ) INTO v_has_assignment;

  RETURN v_has_assignment;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION user_can_access_model IS 'Returns true if user can access the specified model based on scope and assignments';

-- =============================================
-- 7. Set Default Permissions for Existing Users
-- =============================================
UPDATE agency_users
SET permissions = get_default_permissions(role)
WHERE permissions IS NULL OR permissions = '{}'::jsonb;

-- =============================================
-- 8. RLS Policies (if needed in future)
-- =============================================
-- Note: RLS policies are disabled by default in this schema
-- If you enable RLS in the future, uncomment and adjust these:

-- ALTER TABLE user_model_assignments ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "Users can view their own assignments"
--   ON user_model_assignments FOR SELECT
--   USING (user_id = auth.uid());
--
-- CREATE POLICY "Admins can manage assignments"
--   ON user_model_assignments FOR ALL
--   USING (
--     EXISTS (
--       SELECT 1 FROM agency_users
--       WHERE auth_user_id = auth.uid()
--       AND role IN ('owner', 'admin')
--       AND agency_id = (SELECT agency_id FROM agency_users WHERE id = user_model_assignments.user_id)
--     )
--   );

-- =============================================
-- 9. Verification Queries
-- =============================================
-- Run these to verify the migration worked:

-- Check permissions are set:
-- SELECT email, role, permissions FROM agency_users;

-- Check user_model_assignments table exists:
-- SELECT COUNT(*) FROM user_model_assignments;

-- Check team_activity_log table exists:
-- SELECT COUNT(*) FROM team_activity_log;

-- Test the helper function:
-- SELECT user_can_access_model(
--   (SELECT id FROM agency_users WHERE email = 'test@example.com'),
--   (SELECT id FROM agency_models LIMIT 1)
-- );

COMMENT ON COLUMN agency_users.permissions IS 'Granular permissions JSONB. Updated by migration 011';
