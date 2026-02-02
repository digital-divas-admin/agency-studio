/**
 * GPU Router Service (Simplified for Agency Studio)
 *
 * Routes ComfyUI generation requests to dedicated GPU first,
 * falls back to serverless if dedicated is unavailable.
 *
 * Simplified from Vixxxen's 4-mode router:
 * - No SFW/NSFW endpoint splitting
 * - No forceEndpoint parameter
 * - No settingsService dependency
 * - Single strategy: dedicated-primary with serverless fallback
 */

const { logger } = require('./logger');
const { config } = require('../config');

// Dedicated GPU submit timeout (30s — enough for pod wake-up)
const DEDICATED_TIMEOUT = 30000;

// Job tracking: maps jobId to { endpoint, timestamp }
const jobEndpoints = new Map();

// Clean up old job mappings (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [jobId, data] of jobEndpoints.entries()) {
    if (data.timestamp < oneHourAgo) {
      jobEndpoints.delete(jobId);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if dedicated GPU is healthy
 */
async function checkDedicatedHealth(dedicatedUrl) {
  if (!dedicatedUrl) return { healthy: false, reason: 'No URL configured' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${dedicatedUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { healthy: false, reason: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      healthy: data.status === 'healthy',
      queueDepth: data.queue?.depth || 0,
      reason: data.status !== 'healthy' ? 'Unhealthy status' : null,
    };
  } catch (error) {
    return {
      healthy: false,
      reason: error.name === 'AbortError' ? 'Timeout' : error.message,
    };
  }
}

/**
 * Submit job to dedicated GPU
 */
async function submitToDedicated(dedicatedUrl, workflow, timeout = DEDICATED_TIMEOUT, images = null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const input = { workflow };
    if (images && images.length > 0) {
      input.images = images;
    }

    const response = await fetch(`${dedicatedUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dedicated GPU error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      success: true,
      jobId: data.id,
      status: data.status,
      endpoint: 'dedicated',
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      success: false,
      error: error.name === 'AbortError' ? 'Timeout' : error.message,
      endpoint: 'dedicated',
    };
  }
}

/**
 * Submit job to serverless (RunPod)
 */
async function submitToServerless(runpodUrl, runpodApiKey, workflow, images = null) {
  try {
    const input = { workflow };
    if (images && images.length > 0) {
      input.images = images;
    }

    const response = await fetch(`${runpodUrl}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${runpodApiKey}`,
      },
      body: JSON.stringify({ input }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Serverless error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      success: true,
      jobId: data.id,
      status: data.status,
      endpoint: 'serverless',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      endpoint: 'serverless',
    };
  }
}

/**
 * Track which endpoint a job was submitted to
 */
function trackJob(jobId, endpoint) {
  jobEndpoints.set(jobId, {
    endpoint,
    timestamp: Date.now(),
  });
}

/**
 * Route a generation request: dedicated first, serverless fallback
 *
 * Skips health check — submits directly to dedicated with a 30s timeout
 * to allow for pod wake-up. Only falls back to serverless if the
 * submission itself fails or times out.
 *
 * @param {object} options
 * @param {object} options.workflow - ComfyUI workflow
 * @param {array}  options.images - Optional array of {name, image} for inpainting
 * @returns {Promise<{ success, jobId, status, endpoint, error?, usedFallback? }>}
 */
async function routeGenerationRequest({ workflow, images = null }) {
  const dedicatedUrl = config.runpod.dedicatedUrl;
  const runpodUrl = config.runpod.serverlessUrl;
  const runpodApiKey = config.runpod.apiKey;

  // If no dedicated URL configured, go straight to serverless
  if (!dedicatedUrl) {
    logger.debug('GPU Router: No dedicated URL, using serverless');
    const result = await submitToServerless(runpodUrl, runpodApiKey, workflow, images);
    if (result.success) trackJob(result.jobId, 'serverless');
    return result;
  }

  // Try dedicated directly (no health check — allow time for pod wake-up)
  logger.debug('GPU Router: Submitting to dedicated GPU', { url: dedicatedUrl, timeout: DEDICATED_TIMEOUT });
  const dedicatedResult = await submitToDedicated(dedicatedUrl, workflow, DEDICATED_TIMEOUT, images);
  if (dedicatedResult.success) {
    logger.debug('GPU Router: Dedicated GPU accepted job', { jobId: dedicatedResult.jobId });
    trackJob(dedicatedResult.jobId, 'dedicated');
    return dedicatedResult;
  }

  // Dedicated failed after full timeout, fall back to serverless
  logger.debug('GPU Router: Dedicated failed, falling back to serverless', { error: dedicatedResult.error });
  const serverlessResult = await submitToServerless(runpodUrl, runpodApiKey, workflow, images);
  if (serverlessResult.success) trackJob(serverlessResult.jobId, 'serverless');
  return { ...serverlessResult, usedFallback: true, fallbackReason: dedicatedResult.error };
}

/**
 * Get job status from the correct endpoint
 */
async function getJobStatus(jobId) {
  const tracked = jobEndpoints.get(jobId);
  const endpoint = tracked?.endpoint || null;

  if (endpoint === 'dedicated' && config.runpod.dedicatedUrl) {
    return await getStatusFromDedicated(config.runpod.dedicatedUrl, jobId);
  }

  // Default to serverless
  return await getStatusFromServerless(
    config.runpod.serverlessUrl,
    config.runpod.apiKey,
    jobId
  );
}

async function getStatusFromDedicated(dedicatedUrl, jobId) {
  try {
    const response = await fetch(`${dedicatedUrl}/status/${jobId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return { success: true, data, endpoint: 'dedicated' };
  } catch (error) {
    return { success: false, error: error.message, endpoint: 'dedicated' };
  }
}

async function getStatusFromServerless(runpodUrl, runpodApiKey, jobId) {
  try {
    const response = await fetch(`${runpodUrl}/status/${jobId}`, {
      headers: { 'Authorization': `Bearer ${runpodApiKey}` },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return { success: true, data, endpoint: 'serverless' };
  } catch (error) {
    return { success: false, error: error.message, endpoint: 'serverless' };
  }
}

module.exports = {
  routeGenerationRequest,
  getJobStatus,
  checkDedicatedHealth,
};
