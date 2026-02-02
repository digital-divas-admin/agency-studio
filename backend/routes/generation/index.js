/**
 * Generation Routes Index
 * Combines all generation model routes
 */

const express = require('express');
const router = express.Router();

const seedreamRoutes = require('./seedream');
const nanoBananaRoutes = require('./nanoBanana');
const klingRoutes = require('./kling');
const wanRoutes = require('./wan');
const veoRoutes = require('./veo');
const qwenRoutes = require('./qwen');

// Mount routes
router.use('/seedream', seedreamRoutes);
router.use('/nano-banana', nanoBananaRoutes);
router.use('/kling', klingRoutes);
router.use('/wan', wanRoutes);
router.use('/veo', veoRoutes);
router.use('/qwen', qwenRoutes);

// GET /api/generate/status - Get all model statuses
router.get('/status', (req, res) => {
  const { config } = require('../../config');

  res.json({
    models: {
      image: [
        {
          id: 'seedream',
          name: 'Seedream 4.5',
          configured: !!config.wavespeed.apiKey,
          creditCost: config.creditCosts.seedream,
        },
        {
          id: 'nanoBanana',
          name: 'Nano Banana Pro',
          configured: !!config.openrouter.apiKey,
          creditCost: config.creditCosts.nanoBanana,
        },
        {
          id: 'qwen',
          name: 'Qwen Image',
          configured: !!config.runpod.apiKey,
          creditCost: config.creditCosts.qwen,
        },
      ],
      video: [
        {
          id: 'kling',
          name: 'Kling 2.5 Turbo Pro',
          configured: !!config.replicate.apiKey,
          creditCost: config.creditCosts.kling,
        },
        {
          id: 'wan',
          name: 'WAN 2.2',
          configured: !!config.replicate.apiKey,
          creditCost: config.creditCosts.wan,
        },
        {
          id: 'veo',
          name: 'Veo 3.1 Fast',
          configured: !!config.replicate.apiKey,
          creditCost: config.creditCosts.veo,
        },
      ],
    },
  });
});

module.exports = router;
