-- Migration 013: Instagram Trends Discovery Feature
-- Adds tables for tracking Instagram accounts and storing scraped Reels content

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. tracked_accounts - Instagram accounts to monitor for trends
CREATE TABLE IF NOT EXISTS tracked_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instagram_handle TEXT NOT NULL,
    display_name TEXT,
    profile_pic_url TEXT,
    account_type TEXT NOT NULL CHECK (account_type IN ('global', 'workspace')),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,  -- NULL for global accounts
    added_by_user_id UUID REFERENCES agency_users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    last_scraped_at TIMESTAMPTZ,
    scrape_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (instagram_handle, agency_id)
);

-- 2. trend_content - Scraped Reels data
CREATE TABLE IF NOT EXISTS trend_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracked_account_id UUID NOT NULL REFERENCES tracked_accounts(id) ON DELETE CASCADE,
    instagram_reel_id TEXT NOT NULL UNIQUE,
    reel_url TEXT NOT NULL,
    thumbnail_url TEXT,
    video_url TEXT,
    caption TEXT,
    audio_name TEXT,
    audio_url TEXT,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    posted_at TIMESTAMPTZ NOT NULL,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. workspace_saved_trends - Bookmarked trends per agency
CREATE TABLE IF NOT EXISTS workspace_saved_trends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    trend_content_id UUID NOT NULL REFERENCES trend_content(id) ON DELETE CASCADE,
    saved_by_user_id UUID REFERENCES agency_users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (agency_id, trend_content_id)
);

-- 4. apify_scrape_jobs - Track scraping job status
CREATE TABLE IF NOT EXISTS apify_scrape_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    apify_run_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
    account_handles TEXT[] NOT NULL,
    items_scraped INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracked_accounts_agency ON tracked_accounts(agency_id);
CREATE INDEX IF NOT EXISTS idx_tracked_accounts_type ON tracked_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_tracked_accounts_active ON tracked_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_tracked_accounts_handle ON tracked_accounts(instagram_handle);

CREATE INDEX IF NOT EXISTS idx_trend_content_account ON trend_content(tracked_account_id);
CREATE INDEX IF NOT EXISTS idx_trend_content_posted ON trend_content(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_content_reel_id ON trend_content(instagram_reel_id);

CREATE INDEX IF NOT EXISTS idx_workspace_saved_trends_agency ON workspace_saved_trends(agency_id);
CREATE INDEX IF NOT EXISTS idx_workspace_saved_trends_content ON workspace_saved_trends(trend_content_id);

CREATE INDEX IF NOT EXISTS idx_apify_jobs_status ON apify_scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_apify_jobs_run_id ON apify_scrape_jobs(apify_run_id);

-- Update timestamp trigger for tracked_accounts
CREATE OR REPLACE FUNCTION update_tracked_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tracked_accounts_updated_at ON tracked_accounts;
CREATE TRIGGER tracked_accounts_updated_at
    BEFORE UPDATE ON tracked_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_tracked_accounts_updated_at();

-- Update timestamp trigger for workspace_saved_trends
CREATE OR REPLACE FUNCTION update_workspace_saved_trends_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workspace_saved_trends_updated_at ON workspace_saved_trends;
CREATE TRIGGER workspace_saved_trends_updated_at
    BEFORE UPDATE ON workspace_saved_trends
    FOR EACH ROW
    EXECUTE FUNCTION update_workspace_saved_trends_updated_at();

-- Comments for documentation
COMMENT ON TABLE tracked_accounts IS 'Instagram accounts monitored for trending Reels content';
COMMENT ON TABLE trend_content IS 'Scraped Instagram Reels data from tracked accounts';
COMMENT ON TABLE workspace_saved_trends IS 'Agency-specific bookmarked trends with notes';
COMMENT ON TABLE apify_scrape_jobs IS 'Tracking for Apify scraper job runs';

COMMENT ON COLUMN tracked_accounts.account_type IS 'global = available to all workspaces, workspace = agency-specific';
COMMENT ON COLUMN tracked_accounts.agency_id IS 'NULL for global accounts, set for workspace-specific accounts';
COMMENT ON COLUMN trend_content.instagram_reel_id IS 'Instagram''s unique identifier for the reel - used for deduplication';
