/**
 * Background Remover Route
 * Uses Replicate API for 851-labs background remover
 * Ported from Vixxxen — simplest editing route (single image in/out)
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

const BG_REMOVER_MODEL = "851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc";

/**
 * POST /api/edit/bg-remover
 * Remove background from an image
 */
router.post('/', requireAuth, requireCredits('bgRemover'), async (req, res) => {
  const { agency, agencyUser } = req;

  try {
    const { image, model_id } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    if (!config.replicate.apiKey) {
      return res.status(500).json({ error: 'Replicate API key not configured' });
    }

    logger.info('Removing background', {
      agencyId: agency.id,
      userId: agencyUser.id,
    });

    // Compress input image before sending
    const compressedImage = await compressImage(image, { maxDimension: 1536, quality: 80 });

    const output = await runModel(BG_REMOVER_MODEL, { image: compressedImage });

    // Handle Replicate's dual output format (File object vs URL string)
    const resultUrl = extractOutputUrl(output) || output;

    // Deduct credits
    await deductCredits(req);

    // Log generation
    await supabaseAdmin.from('generations').insert({
      agency_id: agency.id,
      user_id: agencyUser.id,
      model_id: model_id || null,
      type: 'edit',
      model: 'bg-remover',
      parameters: {},
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
      title: 'Background Removed',
      url: resultUrl,
      type: 'image',
      source: 'generated',
      tags: ['bg-remover', 'edit'],
    });

    res.json({
      success: true,
      model: 'bg-remover',
      image: resultUrl,
      creditsUsed: req.creditCost,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Background removal error:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        type: error.type,
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to remove background',
    });
  }
});

/**
 * GET /api/edit/bg-remover/status
 */
router.get('/status', (req, res) => {
  res.json({
    model: 'bg-remover',
    configured: !!config.replicate.apiKey,
    status: config.replicate.apiKey ? 'ready' : 'missing_api_key',
  });
});

module.exports = router;
