/**
 * Veo Video Generation Route
 * Uses Replicate API for Google Veo 3.1 Fast
 * Ported from Vixxxen — sync Replicate call, follows Kling pattern
 */

const express = require('express');
const { logger } = require('../../services/logger');
const { supabaseAdmin } = require('../../services/supabase');
const { requireAuth } = require('../../middleware/auth');
const { requireCredits, deductCredits } = require('../../middleware/credits');
const { validatePrompt } = require('../../middleware/validation');
const { config } = require('../../config');
const { runModel } = require('../../services/replicateClient');
const { compressImage } = require('../../services/imageCompression');

const router = express.Router();

const VEO_MODEL = "google/veo-3.1-fast";

/**
 * POST /api/generate/veo
 * Generate video using Veo 3.1 Fast
 */
router.post('/', requireAuth, validatePrompt, requireCredits('veo'), async (req, res) => {
  const { agency, agencyUser } = req;

  try {
    const {
      prompt,
      aspectRatio = "16:9",
      duration = 8,
      image,
      lastFrame,
      negativePrompt,
      resolution = "720p",
      generateAudio = true,
      seed,
      model_id,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!config.replicate.apiKey) {
      return res.status(500).json({ error: 'Replicate API key not configured' });
    }

    const validAspectRatios = ["16:9", "9:16", "1:1"];
    if (!validAspectRatios.includes(aspectRatio)) {
      return res.status(400).json({
        error: `Invalid aspect ratio. Must be one of: ${validAspectRatios.join(', ')}`,
      });
    }

    logger.info('Generating video with Veo 3.1', {
      agencyId: agency.id,
      userId: agencyUser.id,
      duration,
      resolution,
    });

    const input = {
      prompt,
      aspect_ratio: aspectRatio,
      duration,
      resolution,
      generate_audio: generateAudio,
    };

    // Compress input images before sending
    if (image) {
      input.image = await compressImage(image, { maxDimension: 1024, quality: 75 });
    }

    if (lastFrame) {
      input.last_frame = await compressImage(lastFrame, { maxDimension: 1024, quality: 75 });
    }

    if (negativePrompt) {
      input.negative_prompt = negativePrompt;
    }

    if (seed !== undefined && seed !== null) {
      input.seed = seed;
    }

    const output = await runModel(VEO_MODEL, input);

    // Deduct credits
    await deductCredits(req);

    // Log generation
    await supabaseAdmin.from('generations').insert({
      agency_id: agency.id,
      user_id: agencyUser.id,
      model_id: model_id || null,
      type: 'video',
      model: 'veo',
      prompt,
      parameters: { aspectRatio, duration, resolution, generateAudio, hasImage: !!image },
      status: 'completed',
      result_url: output,
      result_metadata: { duration, resolution },
      credits_cost: req.creditCost,
      completed_at: new Date().toISOString(),
    });

    // Save to gallery
    await supabaseAdmin.from('gallery_items').insert({
      agency_id: agency.id,
      user_id: agencyUser.id,
      model_id: model_id || null,
      title: prompt.substring(0, 100),
      url: output,
      type: 'video',
      source: 'generated',
      tags: ['veo'],
    });

    res.json({
      success: true,
      model: 'veo-3.1-fast',
      videoUrl: output,
      parameters: {
        prompt,
        aspectRatio,
        duration,
        resolution,
        generateAudio,
        hasImage: !!image,
        hasLastFrame: !!lastFrame,
      },
      creditsUsed: req.creditCost,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Veo generation error:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        type: error.type,
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to generate video',
    });
  }
});

/**
 * GET /api/generate/veo/status
 */
router.get('/status', (req, res) => {
  res.json({
    model: 'veo-3.1-fast',
    configured: !!config.replicate.apiKey,
    status: config.replicate.apiKey ? 'ready' : 'missing_api_key',
  });
});

module.exports = router;
