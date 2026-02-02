/**
 * Qwen Image Generation Route
 * Uses RunPod ComfyUI worker via GPU Router (dedicated-first, serverless fallback)
 *
 * Ported from Vixxxen — async job submission + polling
 * Simplified: no SFW/NSFW mode, no content mode switching, fixed LoRA config
 */

const express = require('express');
const { logger } = require('../../services/logger');
const { supabaseAdmin } = require('../../services/supabase');
const { requireAuth } = require('../../middleware/auth');
const { requireCredits, deductCredits } = require('../../middleware/credits');
const { config } = require('../../config');
const { compressImage } = require('../../services/imageCompression');
const { routeGenerationRequest, getJobStatus } = require('../../services/gpuRouter');
const { extractImageFromOutput, mapJobStatus } = require('../../services/comfyuiOutput');

const router = express.Router();

const POLL_INTERVAL = 3000;   // Poll every 3 seconds
const MAX_POLL_ATTEMPTS = 200; // Max ~10 minutes

// ============================================================================
// COMFYUI WORKFLOW TEMPLATE
// ============================================================================

/**
 * Build Qwen txt2img workflow
 * If a model's lora_config is provided, uses that LoRA.
 * Otherwise falls back to default: Boreal Portraits 0.6 + Lightning 4-step 1.0
 */
function getWorkflowTemplate({ prompt, negativePrompt = '', width = 1152, height = 1536, seed = null, loraConfig = null }) {
  const actualSeed = seed ?? Math.floor(Math.random() * 999999999999999);

  return {
    "3": {
      "inputs": {
        "seed": actualSeed,
        "steps": 4,
        "cfg": 1,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1,
        "model": ["66", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["58", 0]
      },
      "class_type": "KSampler",
      "_meta": { "title": "KSampler" }
    },
    "6": {
      "inputs": {
        "text": prompt,
        "clip": ["38", 0]
      },
      "class_type": "CLIPTextEncode",
      "_meta": { "title": "CLIP Text Encode (Positive Prompt)" }
    },
    "7": {
      "inputs": {
        "text": negativePrompt,
        "clip": ["38", 0]
      },
      "class_type": "CLIPTextEncode",
      "_meta": { "title": "CLIP Text Encode (Negative Prompt)" }
    },
    "8": {
      "inputs": {
        "samples": ["3", 0],
        "vae": ["39", 0]
      },
      "class_type": "VAEDecode",
      "_meta": { "title": "VAE Decode" }
    },
    "37": {
      "inputs": {
        "unet_name": "qwen_image_bf16.safetensors",
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader",
      "_meta": { "title": "Load Diffusion Model" }
    },
    "38": {
      "inputs": {
        "clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors",
        "type": "qwen_image",
        "device": "default"
      },
      "class_type": "CLIPLoader",
      "_meta": { "title": "Load CLIP" }
    },
    "39": {
      "inputs": {
        "vae_name": "qwen_image_vae.safetensors"
      },
      "class_type": "VAELoader",
      "_meta": { "title": "Load VAE" }
    },
    "58": {
      "inputs": {
        "width": width,
        "height": height,
        "batch_size": 1
      },
      "class_type": "EmptySD3LatentImage",
      "_meta": { "title": "EmptySD3LatentImage" }
    },
    "60": {
      "inputs": {
        "filename_prefix": "txt2img/%date:yyyy-MM-dd%/%date:yyyy-MM-dd%",
        "images": ["8", 0]
      },
      "class_type": "SaveImage",
      "_meta": { "title": "Save Image" }
    },
    "66": {
      "inputs": {
        "shift": 2,
        "model": ["76", 0]
      },
      "class_type": "ModelSamplingAuraFlow",
      "_meta": { "title": "ModelSamplingAuraFlow" }
    },
    "76": {
      "inputs": {
        "PowerLoraLoaderHeaderWidget": { "type": "PowerLoraLoaderHeaderWidget" },
        // LoRA slot 1: Agency model's LoRA (if provided), otherwise off
        "lora_1": loraConfig?.path
          ? { "on": true, "lora": loraConfig.path, "strength": loraConfig.weight ?? 0.7 }
          : { "on": false, "lora": "None", "strength": 1 },
        // LoRA slot 2: Default base LoRA (Boreal Portraits)
        "lora_2": { "on": true, "lora": "qwen-boreal-portraits-portraits-high-rank.safetensors", "strength": 0.6 },
        // LoRA slot 3: Lightning acceleration LoRA
        "lora_3": { "on": true, "lora": "Qwen-Image-Lightning-4steps-V2.0.safetensors", "strength": 1 },
        "➕ Add Lora": "",
        "model": ["37", 0]
      },
      "class_type": "Power Lora Loader (rgthree)",
      "_meta": { "title": "Power Lora Loader (rgthree)" }
    }
  };
}

// ============================================================================
// JOB POLLING
// ============================================================================

async function pollJob(jobId) {
  logger.debug('Starting job polling', { jobId });

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
        const { imageUrl, images } = extractImageFromOutput(data.output);
        if (imageUrl) {
          return { success: true, imageUrl, images, endpoint: statusResult.endpoint };
        }
        logger.error('Job completed but no image in output', { jobId });
        return { success: false, error: 'No image in output' };
      }

      if (status === 'FAILED') {
        logger.error('Job failed', { jobId, error: data.error });
        return { success: false, error: data.error || 'Job failed' };
      }

      if (status === 'CANCELLED') {
        return { success: false, error: 'Job was cancelled' };
      }

      // Still processing
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
 * POST /api/generate/qwen
 * Generate image using Qwen model via ComfyUI
 */
router.post('/', requireAuth, requireCredits('qwen'), async (req, res) => {
  const { agency, agencyUser } = req;

  try {
    const {
      prompt,
      negativePrompt,
      width = 1152,
      height = 1536,
      seed,
      model_id,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!config.runpod.apiKey) {
      return res.status(500).json({ error: 'RunPod not configured' });
    }

    // Validate dimensions (clamp to safe range — learned from Vixxxen)
    const validatedWidth = Math.min(Math.max(parseInt(width) || 1152, 512), 2048);
    const validatedHeight = Math.min(Math.max(parseInt(height) || 1536, 512), 2048);

    // Look up agency model's LoRA config if model_id provided
    let loraConfig = null;
    let effectivePrompt = prompt;
    if (model_id) {
      const { data: agencyModel } = await supabaseAdmin
        .from('agency_models')
        .select('lora_config')
        .eq('id', model_id)
        .eq('agency_id', agency.id)
        .single();

      if (agencyModel?.lora_config?.path) {
        loraConfig = agencyModel.lora_config;
        // Prepend trigger word to prompt if configured
        if (loraConfig.triggerWord) {
          effectivePrompt = `${loraConfig.triggerWord} ${prompt}`;
        }
      }
    }

    logger.info('Generating image with Qwen', {
      agencyId: agency.id,
      userId: agencyUser.id,
      modelId: model_id || null,
      hasLora: !!loraConfig,
      width: validatedWidth,
      height: validatedHeight,
    });

    // Build workflow
    const workflow = getWorkflowTemplate({
      prompt: effectivePrompt,
      negativePrompt,
      width: validatedWidth,
      height: validatedHeight,
      seed,
      loraConfig,
    });

    // Submit via GPU router (dedicated-first, serverless fallback)
    const submitResult = await routeGenerationRequest({ workflow });

    if (!submitResult.success) {
      return res.status(500).json({
        error: 'Failed to submit job',
        details: submitResult.error,
      });
    }

    logger.info('Qwen job submitted', {
      jobId: submitResult.jobId,
      endpoint: submitResult.endpoint,
      usedFallback: submitResult.usedFallback || false,
    });

    // Poll for completion
    const result = await pollJob(submitResult.jobId);

    if (!result.success) {
      return res.status(500).json({
        error: 'Generation failed',
        message: result.error,
      });
    }

    // Deduct credits
    await deductCredits(req);

    // Log generation
    const { data: generation } = await supabaseAdmin.from('generations').insert({
      agency_id: agency.id,
      user_id: agencyUser.id,
      model_id: model_id || null,
      type: 'image',
      model: 'qwen',
      prompt,
      parameters: { width: validatedWidth, height: validatedHeight, hasLora: !!loraConfig },
      status: 'completed',
      result_url: result.imageUrl,
      result_metadata: { endpoint: result.endpoint },
      credits_cost: req.creditCost,
      completed_at: new Date().toISOString(),
    }).select('id').single();

    // Save to gallery
    const galleryItems = [];
    for (const imageUrl of result.images) {
      // Generate a small thumbnail for dashboard/gallery display
      let thumbnailUrl = null;
      try {
        thumbnailUrl = await compressImage(imageUrl, { maxDimension: 300, quality: 60 });
      } catch (err) {
        logger.warn('Thumbnail generation failed, skipping:', err.message);
      }

      const { data: item } = await supabaseAdmin.from('gallery_items').insert({
        agency_id: agency.id,
        user_id: agencyUser.id,
        generation_id: generation?.id,
        model_id: model_id || null,
        title: prompt.substring(0, 100),
        url: imageUrl,
        thumbnail_url: thumbnailUrl,
        type: 'image',
        source: 'generated',
        tags: ['qwen'],
      }).select().single();

      if (item) galleryItems.push(item);
    }

    res.json({
      success: true,
      model: 'qwen',
      images: result.images,
      galleryItems,
      parameters: {
        prompt,
        width: validatedWidth,
        height: validatedHeight,
      },
      endpoint: result.endpoint,
      creditsUsed: req.creditCost,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Qwen generation error:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate image',
    });
  }
});

/**
 * GET /api/generate/qwen/status
 */
router.get('/status', (req, res) => {
  res.json({
    model: 'qwen',
    configured: !!config.runpod.apiKey,
    status: config.runpod.apiKey ? 'ready' : 'missing_api_key',
  });
});

module.exports = router;
