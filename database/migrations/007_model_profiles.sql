-- Migration: Add comprehensive profile fields to agency_models
-- Description: Adds contact info, social media, contract details, content preferences, and visibility controls

-- Add profile fields
ALTER TABLE agency_models
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS joined_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS social_media JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contract_split TEXT,
  ADD COLUMN IF NOT EXISTS contract_notes TEXT,
  ADD COLUMN IF NOT EXISTS content_preferences JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS field_visibility JSONB DEFAULT '{
    "email": false,
    "phone": false,
    "bio": true,
    "social_media": true,
    "onlyfans_handle": true,
    "joined_date": false,
    "contract_split": false,
    "contract_notes": false,
    "content_preferences": false
  }';

-- Add indexes for searchable fields
CREATE INDEX IF NOT EXISTS idx_agency_models_email ON agency_models(email);
CREATE INDEX IF NOT EXISTS idx_agency_models_phone ON agency_models(phone);

-- Add comments for documentation
COMMENT ON COLUMN agency_models.email IS 'Model email address - visibility controlled by field_visibility';
COMMENT ON COLUMN agency_models.phone IS 'Model phone number - visibility controlled by field_visibility';
COMMENT ON COLUMN agency_models.bio IS 'Public bio/description about the model';
COMMENT ON COLUMN agency_models.joined_date IS 'Date when model joined the agency';
COMMENT ON COLUMN agency_models.social_media IS 'JSONB object with platform names as keys and handles as values (e.g. {"instagram": "@handle", "twitter": "@handle"})';
COMMENT ON COLUMN agency_models.contract_split IS 'Revenue split agreement (e.g. "70/30", "60/40")';
COMMENT ON COLUMN agency_models.contract_notes IS 'Private contract terms and special arrangements - never visible to regular users';
COMMENT ON COLUMN agency_models.content_preferences IS 'JSONB object with willing_to_do, will_not_do arrays, and special_notes (e.g. {"willing_to_do": ["lingerie", "bikini"], "will_not_do": ["explicit"], "special_notes": "Prefers outdoor shoots"})';
COMMENT ON COLUMN agency_models.field_visibility IS 'JSONB object controlling which fields are visible to regular users (non-admins) - admins always see all fields';
