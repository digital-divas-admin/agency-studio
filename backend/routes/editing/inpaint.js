/**
 * Inpainting Route
 * Uses RunPod ComfyUI worker via GPU Router (dedicated-first, serverless fallback)
 *
 * Ported from Vixxxen — SFW Qwen workflow only (no NSFW/SDXL variant)
 * Stripped: no content mode, no NSFW branch, no forceEndpoint
 *
 * Key details from Vixxxen:
 * - Mask must use RED channel (ImageToMask node)
 * - Data URL prefix must be stripped before base64 submission
 * - denoise parameter controls preservation (default 0.6)
 */

const express = require('express');
const { logger } = require('../../services/logger');
const { supabaseAdmin } = require('../../services/supabase');
const { requireAuth } = require('../../middleware/auth');
const { requireCredits, deductCredits } = require('../../middleware/credits');
const { config } = require('../../config');
const { routeGenerationRequest, getJobStatus } = require('../../services/gpuRouter');
const { extractImageFromOutput } = require('../../services/comfyuiOutput');

const router = express.Router();

const POLL_INTERVAL = 3000;   // Poll every 3 seconds
const MAX_POLL_ATTEMPTS = 200; // Max ~10 minutes

// ============================================================================
// COMFYUI INPAINT WORKFLOW (Qwen-based, SFW only)
// ============================================================================

/**
 * Build Qwen inpainting workflow
 * Uses two LoadImage nodes: one for image, one for mask
 * ImageToMask converts the mask image's red channel to a mask tensor
 */
function getInpaintWorkflow({ prompt, negativePrompt = '', seed = null, denoise = 0.6 }) {
  const actualSeed = seed ?? Math.floor(Math.random() * 999999999999999);

  return {
    "3": {
      "inputs": {
        "seed": actualSeed,
        "steps": 6,
        "cfg": 1,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": denoise,
        "model": ["15", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["16", 0]
      },
      "class_type": "KSampler",
      "_meta": { "title": "KSampler" }
    },
    "4": {
      "inputs": { "image": "mask_image.png" },
      "class_type": "LoadImage",
      "_meta": { "title": "Load Mask Image" }
    },
    "5": {
      "inputs": { "image": "input_image.png" },
      "class_type": "LoadImage",
      "_meta": { "title": "Load Image" }
    },
    "6": {
      "inputs": {
        "text": prompt,
        "clip": ["15", 1]
      },
      "class_type": "CLIPTextEncode",
      "_meta": { "title": "Positive Prompt" }
    },
    "7": {
      "inputs": {
        "text": negativePrompt || "",
        "clip": ["15", 1]
      },
      "class_type": "CLIPTextEncode",
      "_meta": { "title": "Negative Prompt" }
    },
    "8": {
      "inputs": {
        "samples": ["3", 0],
        "vae": ["11", 0]
      },
      "class_type": "VAEDecode",
      "_meta": { "title": "VAE Decode" }
    },
    "9": {
      "inputs": {
        "filename_prefix": "Inpaint",
        "images": ["8", 0]
      },
      "class_type": "SaveImage",
      "_meta": { "title": "Save Image" }
    },
    "10": {
      "inputs": {
        "clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors",
        "type": "qwen_image",
        "device": "default"
      },
      "class_type": "CLIPLoader",
      "_meta": { "title": "Load CLIP" }
    },
    "11": {
      "inputs": { "vae_name": "qwen_image_vae.safetensors" },
      "class_type": "VAELoader",
      "_meta": { "title": "Load VAE" }
    },
    "12": {
      "inputs": {
        "pixels": ["5", 0],
        "vae": ["11", 0]
      },
      "class_type": "VAEEncode",
      "_meta": { "title": "VAE Encode" }
    },
    "14": {
      "inputs": {
        "unet_name": "qwen_image_bf16.safetensors",
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader",
      "_meta": { "title": "Load Diffusion Model" }
    },
    "15": {
      "inputs": {
        "PowerLoraLoaderHeaderWidget": { "type": "PowerLoraLoaderHeaderWidget" },
        // All LoRAs disabled for inpainting — base model only
        "lora_1": { "on": false, "lora": "None", "strength": 1 },
        "lora_2": { "on": false, "lora": "None", "strength": 1 },
        "lora_3": { "on": false, "lora": "None", "strength": 1 },
        "➕ Add Lora": "",
        "model": ["14", 0],
        "clip": ["10", 0]
      },
      "class_type": "Power Lora Loader (rgthree)",
      "_meta": { "title": "Power Lora Loader (rgthree)" }
    },
    "16": {
      "inputs": {
        "samples": ["12", 0],
        "mask": ["17", 0]
      },
      "class_type": "SetLatentNoiseMask",
      "_meta": { "title": "Set Latent Noise Mask" }
    },
    "17": {
      "inputs": {
        "channel": "red",
        "image": ["4", 0]
      },
      "class_type": "ImageToMask",
      "_meta": { "title": "Image To Mask" }
    }
  };
}

// ============================================================================
// JOB POLLING (same pattern as Qwen gen)
// ============================================================================

async function pollJob(jobId) {
  logger.debug('Starting inpaint job polling', { jobId });

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const statusResult = await getJobStatus(jobId);

      if (!statusResult.success) {
        logger.debug('Poll failed', { attempt: attempt + 1, error: statusResult.error });
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        continue;
      }

      const data = statusResult.data;
      const status = data.status;

      if (status === 'COMPLETED') {
        const { imageUrl } = extractImageFromOutput(data.output);
        if (imageUrl) {
          return { success: true, image: imageUrl, endpoint: statusResult.endpoint };
        }
        logger.error('Inpaint job completed but no image in output', { jobId });
        return { success: false, error: 'No image in output' };
      }

      if (status === 'FAILED') {
        logger.error('Inpaint job failed', { jobId, error: data.error });
        return { success: false, error: data.error || 'Job failed' };
      }

      if (status === 'CANCELLED') {
        return { success: false, error: 'Job was cancelled' };
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

    } catch (err) {
      logger.debug('Polling error', { attempt: attempt + 1, error: err.message });
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  return { success: false, error: 'Job timed out after polling' };
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/edit/inpaint
 * Inpaint a masked region of an image
 *
 * Body:
 * {
 *   image: string (base64 data URL, required)
 *   mask: string (base64 data URL, required — red channel = inpaint area)
 *   prompt: string (required)
 *   denoise: number (0-1, default 0.6 — higher = more change)
 * }
 */
router.post('/', requireAuth, requireCredits('inpaint'), async (req, res) => {
  const { agency, agencyUser } = req;

  try {
    const {
      image,
      mask,
      prompt,
      denoise = 0.6,
      model_id,
    } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }
    if (!mask) {
      return res.status(400).json({ error: 'Mask is required (red channel = inpaint area)' });
    }
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!config.runpod.apiKey) {
      return res.status(500).json({ error: 'RunPod not configured' });
    }

    logger.info('Inpainting image', {
      agencyId: agency.id,
      userId: agencyUser.id,
      denoise,
    });

    // Strip data URL prefix if present (required by ComfyUI worker)
    let base64Image = image;
    if (image.startsWith('data:')) {
      base64Image = image.split(',')[1];
    }
    let base64Mask = mask;
    if (mask.startsWith('data:')) {
      base64Mask = mask.split(',')[1];
    }

    // Build workflow
    const workflow = getInpaintWorkflow({
      prompt,
      denoise: Math.min(Math.max(parseFloat(denoise) || 0.6, 0), 1),
    });

    // Prepare images array (image + mask as named files)
    const images = [
      { name: 'input_image.png', image: base64Image },
      { name: 'mask_image.png', image: base64Mask },
    ];

    // Submit via GPU router (dedicated-first, serverless fallback)
    const submitResult = await routeGenerationRequest({ workflow, images });

    if (!submitResult.success) {
      return res.status(500).json({
        error: 'Failed to submit inpaint job',
        details: submitResult.error,
      });
    }

    logger.info('Inpaint job submitted', {
      jobId: submitResult.jobId,
      endpoint: submitResult.endpoint,
      usedFallback: submitResult.usedFallback || false,
    });

    // Poll for completion
    const result = await pollJob(submitResult.jobId);

    if (!result.success) {
      return res.status(500).json({
        error: 'Inpaint failed',
        message: result.error,
      });
    }

    // Deduct credits
    await deductCredits(req);

    // Log generation
    await supabaseAdmin.from('generations').insert({
      agency_id: agency.id,
      user_id: agencyUser.id,
      model_id: model_id || null,
      type: 'edit',
      model: 'inpaint',
      prompt,
      parameters: { denoise },
      status: 'completed',
      result_url: result.image,
      result_metadata: { endpoint: result.endpoint },
      credits_cost: req.creditCost,
      completed_at: new Date().toISOString(),
    });

    // Save to gallery
    await supabaseAdmin.from('gallery_items').insert({
      agency_id: agency.id,
      user_id: agencyUser.id,
      model_id: model_id || null,
      title: prompt.substring(0, 100),
      url: result.image,
      type: 'image',
      source: 'generated',
      tags: ['inpaint', 'edit'],
    });

    res.json({
      success: true,
      model: 'inpaint-qwen',
      image: result.image,
      parameters: { prompt, denoise },
      endpoint: result.endpoint,
      creditsUsed: req.creditCost,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Inpaint error:', error);
    res.status(500).json({
      error: error.message || 'Inpaint failed',
    });
  }
});

/**
 * GET /api/edit/inpaint/status
 */
router.get('/status', (req, res) => {
  res.json({
    model: 'inpaint-qwen',
    configured: !!config.runpod.apiKey,
    status: config.runpod.apiKey ? 'ready' : 'missing_api_key',
  });
});

module.exports = router;
