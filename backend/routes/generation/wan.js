/**
 * WAN Video Generation Route
 * Uses Replicate API for WAN 2.2 I2V model
 * Ported from Vixxxen — sync Replicate call, follows Kling pattern
 */

const express = require('express');
const { logger } = require('../../services/logger');
const { supabaseAdmin } = require('../../services/supabase');
const { requireAuth } = require('../../middleware/auth');
const { requireCredits, deductCredits } = require('../../middleware/credits');
const { config } = require('../../config');
const { runModel } = require('../../services/replicateClient');
const { compressImage } = require('../../services/imageCompression');

const router = express.Router();

const WAN_MODEL = "wan-video/wan-2.2-i2v-a14b";

/**
 * POST /api/generate/wan
 * Generate video using WAN 2.2
 */
router.post('/', requireAuth, requireCredits('wan'), async (req, res) => {
  const { agency, agencyUser } = req;

  try {
    const {
      prompt,
      image,
      resolution = "480p",
      numFrames = 81,
      framesPerSecond = 16,
      sampleSteps = 30,
      sampleShift = 5,
      goFast = false,
      seed,
      model_id,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!config.replicate.apiKey) {
      return res.status(500).json({ error: 'Replicate API key not configured' });
    }

    logger.info('Generating video with WAN 2.2', {
      agencyId: agency.id,
      userId: agencyUser.id,
      resolution,
      hasImage: !!image,
    });

    const input = {
      prompt,
      resolution,
      num_frames: numFrames,
      frames_per_second: framesPerSecond,
      sample_steps: sampleSteps,
      sample_shift: sampleShift,
      go_fast: goFast,
    };

    // Compress input image before sending (lesson from Vixxxen)
    if (image) {
      input.image = await compressImage(image, { maxDimension: 1024, quality: 75 });
    }

    if (seed !== undefined && seed !== null) {
      input.seed = seed;
    }

    const output = await runModel(WAN_MODEL, input);

    // Deduct credits
    await deductCredits(req);

    // Log generation
    await supabaseAdmin.from('generations').insert({
      agency_id: agency.id,
      user_id: agencyUser.id,
      model_id: model_id || null,
      type: 'video',
      model: 'wan',
      prompt,
      parameters: { resolution, numFrames, framesPerSecond, hasImage: !!image },
      status: 'completed',
      result_url: output,
      result_metadata: { resolution, numFrames },
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
      tags: ['wan'],
    });

    res.json({
      success: true,
      model: 'wan-2.2-i2v-a14b',
      videoUrl: output,
      parameters: {
        prompt,
        resolution,
        numFrames,
        framesPerSecond,
        hasImage: !!image,
      },
      creditsUsed: req.creditCost,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('WAN generation error:', error);

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
 * GET /api/generate/wan/status
 */
router.get('/status', (req, res) => {
  res.json({
    model: 'wan-2.2-i2v-a14b',
    configured: !!config.replicate.apiKey,
    status: config.replicate.apiKey ? 'ready' : 'missing_api_key',
  });
});

module.exports = router;
