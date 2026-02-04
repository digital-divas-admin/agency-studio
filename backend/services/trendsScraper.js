/**
 * Trends Scraper Service
 * Orchestrates scraping Instagram Reels from tracked accounts
 */

const { supabaseAdmin } = require('./supabase');
const { logger } = require('./logger');
const apifyClient = require('./apifyClient');

// Batch size for Apify requests (balance between efficiency and rate limits)
const BATCH_SIZE = 10;

// Max reels to fetch per account
const MAX_REELS_PER_ACCOUNT = 1;

/**
 * Main entry point: scrape all active tracked accounts
 * Called by the scheduler every 12 hours
 */
async function scrapeAllAccounts() {
  if (!apifyClient.isConfigured()) {
    logger.warn('Apify not configured - skipping trends scrape');
    return { skipped: true, reason: 'Apify not configured' };
  }

  logger.info('Starting trends scrape for all accounts');

  try {
    // Get all active tracked accounts
    const { data: accounts, error: fetchError } = await supabaseAdmin
      .from('tracked_accounts')
      .select('id, instagram_handle')
      .eq('is_active', true);

    if (fetchError) {
      logger.error('Failed to fetch tracked accounts:', fetchError);
      return { error: fetchError.message };
    }

    if (!accounts || accounts.length === 0) {
      logger.info('No active tracked accounts to scrape');
      return { accountsProcessed: 0 };
    }

    // Deduplicate handles (same handle might be tracked by multiple workspaces)
    const uniqueHandles = [...new Set(accounts.map(a => a.instagram_handle.toLowerCase()))];

    logger.info(`Scraping ${uniqueHandles.length} unique handles from ${accounts.length} tracked accounts`);

    // Process in batches
    const batches = [];
    for (let i = 0; i < uniqueHandles.length; i += BATCH_SIZE) {
      batches.push(uniqueHandles.slice(i, i + BATCH_SIZE));
    }

    let totalReels = 0;
    let failedBatches = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      logger.info(`Processing batch ${i + 1}/${batches.length}`, { handles: batch });

      try {
        const result = await processAccountBatch(batch, accounts);
        totalReels += result.reelsSaved || 0;
      } catch (batchError) {
        logger.error(`Batch ${i + 1} failed:`, batchError);
        failedBatches++;
      }

      // Small delay between batches to avoid rate limits
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    logger.info('Trends scrape completed', {
      totalAccounts: accounts.length,
      uniqueHandles: uniqueHandles.length,
      totalReels,
      failedBatches,
    });

    return {
      accountsProcessed: accounts.length,
      uniqueHandles: uniqueHandles.length,
      reelsSaved: totalReels,
      failedBatches,
    };
  } catch (error) {
    logger.error('Trends scrape failed:', error);
    return { error: error.message };
  }
}

/**
 * Process a batch of account handles
 *
 * @param {string[]} handles - Instagram handles to scrape
 * @param {Array} allAccounts - All tracked_accounts records (for mapping results)
 */
async function processAccountBatch(handles, allAccounts) {
  // Create a job record
  const { data: job, error: jobError } = await supabaseAdmin
    .from('apify_scrape_jobs')
    .insert({
      apify_run_id: 'pending',
      status: 'pending',
      account_handles: handles,
    })
    .select()
    .single();

  if (jobError) {
    logger.error('Failed to create scrape job record:', jobError);
    throw jobError;
  }

  try {
    // Trigger the Apify scrape
    const { runId } = await apifyClient.triggerReelsScrape(handles, {
      maxReels: MAX_REELS_PER_ACCOUNT,
    });

    // Update job with run ID
    await supabaseAdmin
      .from('apify_scrape_jobs')
      .update({ apify_run_id: runId, status: 'running' })
      .eq('id', job.id);

    // Poll for completion (with timeout)
    const result = await waitForRunCompletion(runId, job.id);

    if (result.status !== 'SUCCEEDED') {
      throw new Error(`Scrape failed with status: ${result.status}`);
    }

    // Get results
    const reels = await apifyClient.getRunResults(runId);

    // Save scraped reels
    const savedCount = await saveScrapedReels(reels, handles, allAccounts);

    // Update job as succeeded
    await supabaseAdmin
      .from('apify_scrape_jobs')
      .update({
        status: 'succeeded',
        items_scraped: savedCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    // Update last_scraped_at for processed accounts
    const handleSet = new Set(handles.map(h => h.toLowerCase()));
    const accountIds = allAccounts
      .filter(a => handleSet.has(a.instagram_handle.toLowerCase()))
      .map(a => a.id);

    if (accountIds.length > 0) {
      await supabaseAdmin
        .from('tracked_accounts')
        .update({
          last_scraped_at: new Date().toISOString(),
          scrape_error: null,
        })
        .in('id', accountIds);
    }

    return { reelsSaved: savedCount };
  } catch (error) {
    // Update job as failed
    await supabaseAdmin
      .from('apify_scrape_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    // Mark accounts with error
    const handleSet = new Set(handles.map(h => h.toLowerCase()));
    const accountIds = allAccounts
      .filter(a => handleSet.has(a.instagram_handle.toLowerCase()))
      .map(a => a.id);

    if (accountIds.length > 0) {
      await supabaseAdmin
        .from('tracked_accounts')
        .update({ scrape_error: error.message })
        .in('id', accountIds);
    }

    throw error;
  }
}

/**
 * Wait for an Apify run to complete with polling
 */
async function waitForRunCompletion(runId, jobId, maxWaitMs = 300000) {
  const pollIntervalMs = 5000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const status = await apifyClient.getRunStatus(runId);

    if (status.status === 'SUCCEEDED' || status.status === 'FAILED' || status.status === 'ABORTED') {
      return status;
    }

    logger.debug('Waiting for Apify run', { runId, status: status.status });
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Apify run timed out after ${maxWaitMs}ms`);
}

/**
 * Save scraped reels to the database with deduplication
 *
 * @param {Array} reels - Normalized reel data from Apify
 * @param {string[]} handles - Handles that were scraped
 * @param {Array} allAccounts - All tracked_accounts records
 */
async function saveScrapedReels(reels, handles, allAccounts) {
  if (!reels || reels.length === 0) {
    return 0;
  }

  // Build a map of handle -> tracked_account_id
  // For reels, we link to the first tracked account for that handle
  const handleToAccountId = {};
  for (const account of allAccounts) {
    const normalizedHandle = account.instagram_handle.toLowerCase();
    if (!handleToAccountId[normalizedHandle]) {
      handleToAccountId[normalizedHandle] = account.id;
    }
  }

  let savedCount = 0;

  for (const reel of reels) {
    if (!reel.instagramReelId || !reel.reelUrl) {
      continue;
    }

    // Find the tracked account for this reel
    const ownerHandle = reel.ownerUsername?.toLowerCase();
    const accountId = ownerHandle ? handleToAccountId[ownerHandle] : null;

    if (!accountId) {
      logger.warn('Could not find tracked account for reel', {
        reelId: reel.instagramReelId,
        owner: ownerHandle,
      });
      continue;
    }

    try {
      // Upsert the reel (instagram_reel_id is unique)
      const { error } = await supabaseAdmin
        .from('trend_content')
        .upsert(
          {
            tracked_account_id: accountId,
            instagram_reel_id: reel.instagramReelId,
            reel_url: reel.reelUrl,
            thumbnail_url: reel.thumbnailUrl,
            video_url: reel.videoUrl,
            caption: reel.caption?.substring(0, 2000), // Limit caption length
            audio_name: reel.audioName,
            audio_url: reel.audioUrl,
            view_count: reel.viewCount || 0,
            like_count: reel.likeCount || 0,
            comment_count: reel.commentCount || 0,
            posted_at: reel.postedAt,
            scraped_at: new Date().toISOString(),
          },
          {
            onConflict: 'instagram_reel_id',
            ignoreDuplicates: false, // Update stats on conflict
          }
        );

      if (error) {
        logger.warn('Failed to save reel:', { reelId: reel.instagramReelId, error: error.message });
      } else {
        savedCount++;
      }
    } catch (saveError) {
      logger.warn('Error saving reel:', { reelId: reel.instagramReelId, error: saveError.message });
    }
  }

  logger.info(`Saved ${savedCount}/${reels.length} reels`);
  return savedCount;
}

/**
 * Manually trigger a scrape for specific accounts (for testing/admin use)
 */
async function scrapeSpecificAccounts(handles) {
  if (!apifyClient.isConfigured()) {
    throw new Error('Apify not configured');
  }

  // Get tracked accounts for these handles
  const { data: accounts, error } = await supabaseAdmin
    .from('tracked_accounts')
    .select('id, instagram_handle')
    .in('instagram_handle', handles.map(h => h.toLowerCase()));

  if (error) {
    throw error;
  }

  if (!accounts || accounts.length === 0) {
    throw new Error('No tracked accounts found for provided handles');
  }

  return processAccountBatch(handles, accounts);
}

module.exports = {
  scrapeAllAccounts,
  processAccountBatch,
  saveScrapedReels,
  scrapeSpecificAccounts,
};
