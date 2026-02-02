-- Migration: Add metadata support to content request uploads
-- Description: Adds JSONB column for per-upload metadata (captions, pricing, platform, etc.)

-- Add metadata column to content_request_uploads
ALTER TABLE content_request_uploads
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add index on metadata for faster queries
CREATE INDEX IF NOT EXISTS idx_content_request_uploads_metadata
ON content_request_uploads USING gin(metadata);

-- Comment explaining the metadata structure
COMMENT ON COLUMN content_request_uploads.metadata IS 'Upload metadata in JSON format: { caption, price, platform, schedule_date, hashtags, category, notes }';
