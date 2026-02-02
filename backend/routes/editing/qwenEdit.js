/**
 * Qwen Image Edit Route
 * Uses Replicate API for Qwen Image Edit Plus
 * Ported from Vixxxen — multi-image input, sync Replicate call
 *
 * Accepts 1-3 images + prompt, returns edited images
 */

const express = require('express');
const { logger } = require('../../services/logger');
const { supabaseAdmin } = require('../../services/supabase');
const { requireAuth } = require('../../middleware/auth');
const { requireCredits, deductCredits } = require('../../middleware/credits');
const { config } = require('../../config');
const { runModel, extractOutputUrls } = require('../../services/replicateClient');
const { compressImages } = require('../../services/imageCompression');

const router = express.Router();

const QWEN_EDIT_MODEL = "qwen/qwen-image-edit-plus";

/**
 * POST /api/edit/qwen-edit
 * Edit images using Qwen Image Edit Plus
 */
router.post('/', requireAuth, requireCredits('qwenEdit'), async (req, res) => {
  const { agency, agencyUser } = req;

  try {
    const {
      images,
      prompt,
      aspectRatio = "match_input_image",
      outputFormat = "webp",
      seed,
      goFast = true,
      outputQuality = 95,
      model_id,
    } = req.body;

    // Validate inputs (max 3 images — API hard limit)
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'At least one image is required' });
    }

    if (images.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 images allowed' });
    }

    if (!prompt || prompt.trim() === '') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!config.replicate.apiKey) {
      return res.status(500).json({ error: 'Replicate API key not configured' });
    }

    logger.info('Editing images with Qwen Edit', {
      agencyId: agency.id,
      userId: agencyUser.id,
      imageCount: images.length,
    });

    // Compress input images before sending
    const compressedImages = await compressImages(images, {
      maxDimension: 1536,
      quality: 80,
    });

    const input = {
      image: compressedImages,
      prompt: prompt.trim(),
      aspect_ratio: aspectRatio,
      output_format: outputFormat,
      go_fast: goFast,
      output_quality: outputQuality,
    };

    if (seed !== undefined && seed !== null && seed !== '') {
      input.seed = parseInt(seed);
    }

    const output = await runModel(QWEN_EDIT_MODEL, input);

    // Output is an array of image URLs
    const resultImages = extractOutputUrls(output);

    if (resultImages.length === 0) {
      throw new Error('No images returned from Qwen Edit');
    }

    // Deduct credits
    await deductCredits(req);

    // Log generation
    const { data: generation } = await supabaseAdmin.from('generations').insert({
      agency_id: agency.id,
      user_id: agencyUser.id,
      model_id: model_id || null,
      type: 'edit',
      model: 'qwen-edit',
      prompt,
      parameters: { imageCount: images.length, aspectRatio, outputFormat },
      status: 'completed',
      result_url: resultImages[0],
      result_metadata: { outputCount: resultImages.length },
      credits_cost: req.creditCost,
      completed_at: new Date().toISOString(),
    }).select('id').single();

    // Save each result image to gallery
    const galleryItems = [];
    for (const resultImage of resultImages) {
      const { data: item } = await supabaseAdmin.from('gallery_items').insert({
        agency_id: agency.id,
        user_id: agencyUser.id,
        generation_id: generation?.id,
        model_id: model_id || null,
        title: prompt.substring(0, 100),
        url: resultImage,
        type: 'image',
        source: 'generated',
        tags: ['qwen-edit', 'edit'],
      }).select().single();

      if (item) galleryItems.push(item);
    }

    res.json({
      success: true,
      model: 'qwen-image-edit-plus',
      images: resultImages,
      galleryItems,
      parameters: {
        prompt,
        imageCount: images.length,
        aspectRatio,
        outputFormat,
      },
      creditsUsed: req.creditCost,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Qwen Edit error:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        type: error.type,
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to edit images',
    });
  }
});

/**
 * GET /api/edit/qwen-edit/status
 */
router.get('/status', (req, res) => {
  res.json({
    model: 'qwen-image-edit-plus',
    configured: !!config.replicate.apiKey,
    status: config.replicate.apiKey ? 'ready' : 'missing_api_key',
  });
});

module.exports = router;
