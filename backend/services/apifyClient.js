/**
 * Apify Client Service
 * Wrapper for Apify API to scrape Instagram Reels
 */

const { config } = require('../config');
const { logger } = require('./logger');

const APIFY_BASE_URL = 'https://api.apify.com/v2';

// Instagram Reels scraper actor ID (using the official Apify actor)
// Note: Use ~ instead of / for actor ID in API calls
const INSTAGRAM_REELS_ACTOR = 'apify~instagram-reel-scraper';

/**
 * Make a request to the Apify API
 */
async function apifyRequest(path, options = {}) {
  const apiKey = config.apify?.apiKey;

  if (!apiKey) {
    throw new Error('APIFY_API_KEY is not configured');
  }

  const url = `${APIFY_BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Apify API error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
      path,
    });
    throw new Error(`Apify API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Trigger a scrape job for Instagram Reels from specified handles
 *
 * @param {string[]} handles - Array of Instagram usernames to scrape
 * @param {Object} options - Scrape options
 * @param {number} options.maxReels - Max reels per account (default: 10)
 * @returns {Promise<{runId: string, status: string}>}
 */
async function triggerReelsScrape(handles, options = {}) {
  const { maxReels = 1 } = options;

  if (!handles || handles.length === 0) {
    throw new Error('No handles provided for scraping');
  }

  logger.info('Triggering Apify Instagram Reels scrape', {
    handleCount: handles.length,
    maxReels,
  });

  // Format input for the Apify Instagram Reel Scraper
  // This actor accepts usernames and scrapes their reels
  const input = {
    username: handles.map(handle => handle.replace('@', '')),
    resultsLimit: maxReels,
  };

  try {
    const result = await apifyRequest(`/acts/${INSTAGRAM_REELS_ACTOR}/runs`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    const runId = result.data?.id;

    if (!runId) {
      throw new Error('No run ID returned from Apify');
    }

    logger.info('Apify scrape job started', { runId });

    return {
      runId,
      status: result.data?.status || 'RUNNING',
    };
  } catch (error) {
    logger.error('Failed to trigger Apify scrape:', error);
    throw error;
  }
}

/**
 * Get the status of a running or completed scrape job
 *
 * @param {string} runId - The Apify run ID
 * @returns {Promise<{status: string, itemCount: number}>}
 */
async function getRunStatus(runId) {
  if (!runId) {
    throw new Error('Run ID is required');
  }

  try {
    const result = await apifyRequest(`/actor-runs/${runId}`);
    const data = result.data;

    return {
      status: data?.status || 'UNKNOWN',
      itemCount: data?.stats?.itemCount || 0,
      startedAt: data?.startedAt,
      finishedAt: data?.finishedAt,
      errorMessage: data?.status === 'FAILED' ? (data?.statusMessage || 'Unknown error') : null,
    };
  } catch (error) {
    logger.error('Failed to get run status:', { runId, error: error.message });
    throw error;
  }
}

/**
 * Get results from a completed scrape job
 *
 * @param {string} runId - The Apify run ID
 * @returns {Promise<Array>} Array of scraped reel data
 */
async function getRunResults(runId) {
  if (!runId) {
    throw new Error('Run ID is required');
  }

  try {
    // Get the default dataset ID for this run
    const runInfo = await apifyRequest(`/actor-runs/${runId}`);
    const datasetId = runInfo.data?.defaultDatasetId;

    if (!datasetId) {
      logger.warn('No dataset found for run', { runId });
      return [];
    }

    // Fetch items from the dataset
    const result = await apifyRequest(`/datasets/${datasetId}/items?format=json`);

    const items = Array.isArray(result) ? result : [];

    logger.info('Fetched Apify results', {
      runId,
      itemCount: items.length,
    });

    // Map Apify response to our internal format
    return items.map(item => normalizeReelData(item));
  } catch (error) {
    logger.error('Failed to get run results:', { runId, error: error.message });
    throw error;
  }
}

/**
 * Normalize Apify scraper output to our internal format
 */
function normalizeReelData(item) {
  // The exact field names depend on the Apify actor being used
  // This handles common patterns from Instagram scraper actors
  return {
    instagramReelId: item.id || item.shortCode || item.pk,
    reelUrl: item.url || item.permalink || `https://www.instagram.com/reel/${item.shortCode || item.id}/`,
    thumbnailUrl: item.displayUrl || item.thumbnailUrl || item.thumbnail_src,
    videoUrl: item.videoUrl || item.video_url,
    caption: item.caption || item.text || '',
    audioName: item.musicInfo?.name || item.audio?.title || null,
    audioUrl: item.musicInfo?.url || item.audio?.url || null,
    viewCount: parseInt(item.videoViewCount || item.playCount || item.views || 0, 10),
    likeCount: parseInt(item.likesCount || item.likeCount || item.likes || 0, 10),
    commentCount: parseInt(item.commentsCount || item.commentCount || item.comments || 0, 10),
    postedAt: item.timestamp || item.takenAtTimestamp
      ? new Date(item.timestamp || item.takenAtTimestamp * 1000).toISOString()
      : new Date().toISOString(),
    ownerUsername: item.ownerUsername || item.owner?.username || item.username,
  };
}

/**
 * Check if Apify is configured
 */
function isConfigured() {
  return !!config.apify?.apiKey;
}

module.exports = {
  triggerReelsScrape,
  getRunStatus,
  getRunResults,
  isConfigured,
};
