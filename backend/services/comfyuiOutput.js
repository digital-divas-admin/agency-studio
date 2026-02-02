/**
 * ComfyUI Output Extraction
 * Handles the 5+ different formats RunPod ComfyUI workers return images in
 *
 * Ported from Vixxxen's qwen.js and inpaint.js — this is battle-tested
 * against real production responses. Do not simplify.
 */

const { logger } = require('./logger');

/**
 * Extract image URL from ComfyUI job output
 *
 * RunPod ComfyUI workers return images in different formats:
 * 1. output.images[0] — string (base64 or data URL)
 * 2. output.images[0] — { data: "base64string" }
 * 3. output.images[0] — { image: "base64string" }
 * 4. output.image — string or { data: "..." }
 * 5. output.message — base64 string
 *
 * @param {object} output - The job output object from RunPod
 * @returns {{ imageUrl: string|null, images: string[] }}
 */
function extractImageFromOutput(output) {
  if (!output) {
    logger.debug('ComfyUI output is null/undefined');
    return { imageUrl: null, images: [] };
  }

  // Format 1-3: output.images array
  if (output.images && output.images.length > 0) {
    const firstImage = output.images[0];
    let base64Data;

    if (typeof firstImage === 'string') {
      base64Data = firstImage;
    } else if (firstImage && typeof firstImage === 'object' && firstImage.data) {
      base64Data = firstImage.data;
    } else if (firstImage && typeof firstImage === 'object' && firstImage.image) {
      base64Data = firstImage.image;
    }

    if (base64Data) {
      const imageUrl = ensureDataUrl(base64Data);
      return { imageUrl, images: [imageUrl] };
    }

    logger.debug('Could not extract base64 from images[0]', {
      type: typeof firstImage,
      keys: firstImage && typeof firstImage === 'object' ? Object.keys(firstImage) : 'n/a'
    });
  }

  // Format 4: output.image (single)
  if (output.image) {
    let base64Data;
    if (typeof output.image === 'string') {
      base64Data = output.image;
    } else if (typeof output.image === 'object' && output.image.data) {
      base64Data = output.image.data;
    }

    if (base64Data) {
      const imageUrl = ensureDataUrl(base64Data);
      return { imageUrl, images: [imageUrl] };
    }
  }

  // Format 5: output.message (base64 string from ComfyUI worker)
  if (output.message && typeof output.message === 'string') {
    const imageUrl = ensureDataUrl(output.message);
    logger.debug('Extracted image from output.message');
    return { imageUrl, images: [imageUrl] };
  }

  logger.debug('No recognized image format in ComfyUI output', {
    keys: Object.keys(output)
  });
  return { imageUrl: null, images: [] };
}

/**
 * Ensure a string is a proper data URL
 * Handles both raw base64 and already-prefixed data URLs
 */
function ensureDataUrl(data) {
  if (data.startsWith('data:')) {
    return data;
  }
  return `data:image/png;base64,${data}`;
}

/**
 * Map RunPod job status to application status
 */
function mapJobStatus(runpodStatus) {
  const statusMap = {
    'IN_QUEUE': 'queued',
    'IN_PROGRESS': 'processing',
    'COMPLETED': 'completed',
    'FAILED': 'failed',
    'CANCELLED': 'cancelled',
  };
  return statusMap[runpodStatus] || runpodStatus;
}

module.exports = {
  extractImageFromOutput,
  ensureDataUrl,
  mapJobStatus,
};
