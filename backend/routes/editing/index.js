/**
 * Editing Routes Index
 * Combines all editing tool routes
 */

const express = require('express');
const router = express.Router();

const bgRemoverRoutes = require('./bgRemover');
const eraserRoutes = require('./eraser');
const qwenEditRoutes = require('./qwenEdit');
const inpaintRoutes = require('./inpaint');

// Mount routes
router.use('/bg-remover', bgRemoverRoutes);
router.use('/eraser', eraserRoutes);
router.use('/qwen-edit', qwenEditRoutes);
router.use('/inpaint', inpaintRoutes);

// GET /api/edit/status - Get all editing tool statuses
router.get('/status', (req, res) => {
  const { config } = require('../../config');

  res.json({
    tools: [
      {
        id: 'bgRemover',
        name: 'Background Remover',
        configured: !!config.replicate.apiKey,
        creditCost: config.creditCosts.bgRemover,
      },
      {
        id: 'eraser',
        name: 'Object Eraser',
        configured: !!config.replicate.apiKey,
        creditCost: config.creditCosts.eraser,
      },
      {
        id: 'qwenEdit',
        name: 'Qwen Image Edit',
        configured: !!config.replicate.apiKey,
        creditCost: config.creditCosts.qwenEdit,
      },
      {
        id: 'inpaint',
        name: 'Inpainting',
        configured: !!config.runpod.apiKey,
        creditCost: config.creditCosts.inpaint,
      },
    ],
  });
});

module.exports = router;
