-- Seed file for global tracked accounts
-- These accounts are available to all workspaces
-- Run this file manually to add/update global accounts

-- Insert global accounts (curated list of popular content creators)
-- Note: agency_id is NULL for global accounts
INSERT INTO tracked_accounts (instagram_handle, display_name, account_type, agency_id, is_active)
VALUES
  -- Major influencers and content creators
  ('instagram', 'Instagram', 'global', NULL, true),
  ('therock', 'Dwayne Johnson', 'global', NULL, true),
  ('selenagomez', 'Selena Gomez', 'global', NULL, true),
  ('kyliejenner', 'Kylie Jenner', 'global', NULL, true),
  ('leomessi', 'Leo Messi', 'global', NULL, true),

  -- Popular content/meme accounts
  ('9gag', '9GAG', 'global', NULL, true),
  ('worldstar', 'WorldStar', 'global', NULL, true),
  ('complex', 'Complex', 'global', NULL, true),

  -- Fashion/lifestyle
  ('voguemagazine', 'Vogue', 'global', NULL, true),
  ('hypebeast', 'Hypebeast', 'global', NULL, true),

  -- Entertainment
  ('netflix', 'Netflix', 'global', NULL, true),
  ('spotify', 'Spotify', 'global', NULL, true)
ON CONFLICT (instagram_handle, agency_id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  is_active = EXCLUDED.is_active;

-- Note: You can customize this list based on your target audience
-- Run this SQL manually to update the global accounts:
--   psql -d your_database -f global_tracked_accounts.sql
-- Or through Supabase SQL editor
