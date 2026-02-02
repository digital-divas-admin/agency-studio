/**
 * Object Eraser Route
 * Uses Replicate API for Bria Eraser
 * Ported from Vixxxen — image + mask in, edited image out
 */

const express = require('express');
const { logger } = require('../../services/logger');
const { supabaseAdmin } = require('../../services/supabase');
const { requireAuth } = require('../../middleware/auth');
const { requireCredits, deductCredits } = require('../../middleware/credits');
const { config } = require('../../config');
const { runModel, extractOutputUrl } = require('../../services/replicateClient');
const { compressImage } = require('../../services/imageCompression');

const router = express.Router();

const ERASER_MODEL = "bria/eraser";

/**
 * POST /api/edit/eraser
 * Erase objects from an image using a mask
 */
router.post('/', requireAuth, requireCredits('eraser'), async (req, res) => {
  const { agency, agencyUser } = req;

  try {
    const {
      image,
      mask,
      preserveAlpha = true,
      model_id,
    } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    if (!mask) {
      return res.status(400).json({ error: 'Mask is required' });
    }

    if (!config.replicate.apiKey) {
      return res.status(500).json({ error: 'Replicate API key not configured' });
    }

    logger.info('Erasing objects from image', {
      agencyId: agency.id,
      userId: agencyUser.id,
    });

    // Compress both image and mask before sending
    const compressedImage = await compressImage(image, { maxDimension: 1536, quality: 80 });
    const compressedMask = await compressImage(mask, { maxDimension: 1536, quality: 80 });

    const input = {
      image: compressedImage,
      mask: compressedMask,
      preserve_alpha: preserveAlpha,
      content_moderation: false,
      sync: true,
    };

    const output = await runModel(ERASER_MODEL, input);

    // Handle dual output format
    const resultUrl = extractOutputUrl(output) || output;

    // Deduct credits
    await deductCredits(req);

    // Log generation
    await supabaseAdmin.from('generations').insert({
      agency_id: agency.id,
      user_id: agencyUser.id,
      model_id: model_id || null,
      type: 'edit',
      model: 'eraser',
      parameters: { preserveAlpha },
      status: 'completed',
      result_url: resultUrl,
      credits_cost: req.creditCost,
      completed_at: new Date().toISOString(),
    });

    // Save to gallery
    await supabaseAdmin.from('gallery_items').insert({
      agency_id: agency.id,
      user_id: agencyUser.id,
      model_id: model_id || null,
      title: 'Object Erased',
      url: resultUrl,
      type: 'image',
      source: 'generated',
      tags: ['eraser', 'edit'],
    });

    res.json({
      success: true,
      model: 'bria-eraser',
      image: resultUrl,
      parameters: { preserveAlpha },
      creditsUsed: req.creditCost,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Object eraser error:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        type: error.type,
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to erase objects',
    });
  }
});

/**
 * GET /api/edit/eraser/status
 */
router.get('/status', (req, res) => {
  res.json({
    model: 'bria-eraser',
    configured: !!config.replicate.apiKey,
    status: config.replicate.apiKey ? 'ready' : 'missing_api_key',
  });
});

module.exports = router;
