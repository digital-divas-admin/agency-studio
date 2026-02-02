/**
 * AI Chat/Caption Route (REST only — no Socket.IO)
 *
 * Simple REST endpoint for Agency Studio:
 * - User sends message + optional images
 * - AI responds with caption/description/answer
 * - Uses DeepSeek via OpenRouter
 *
 * NOT a port of Vixxxen's Socket.IO chat system.
 * Vixxxen's chat has channels, reactions, typing indicators, tier-based access.
 * Agency Studio just needs captioning and image Q&A — REST is sufficient.
 */

const express = require('express');
const fetch = require('node-fetch');
const { logger } = require('../services/logger');
const { supabaseAdmin } = require('../services/supabase');
const { requireAuth } = require('../middleware/auth');
const { requireCredits, deductCredits } = require('../middleware/credits');
const { config } = require('../config');
const { fetchWithRetry } = require('../services/retryWithBackoff');

const router = express.Router();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const CHAT_MODEL = 'deepseek/deepseek-chat-v3-0324:free';

/**
 * POST /api/chat
 * Send a message to the AI, optionally with images for captioning
 *
 * Body:
 * {
 *   message: string (required)
 *   images: string[] (optional, base64 data URLs)
 *   conversationHistory: { role: string, content: string }[] (optional)
 * }
 */
router.post('/', requireAuth, requireCredits('chat'), async (req, res) => {
  const { agency, agencyUser } = req;

  try {
    const {
      message,
      images = [],
      conversationHistory = [],
    } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!config.openrouter.apiKey) {
      return res.status(500).json({ error: 'OpenRouter API key not configured' });
    }

    logger.info('AI chat request', {
      agencyId: agency.id,
      userId: agencyUser.id,
      hasImages: images.length > 0,
      historyLength: conversationHistory.length,
    });

    // Build messages array for the LLM
    const messages = [];

    // System prompt for agency context
    messages.push({
      role: 'system',
      content: 'You are an AI assistant for a creative agency. Help with image captioning, content descriptions, creative writing, and answering questions about uploaded images. Be concise and professional.',
    });

    // Include conversation history for multi-turn context
    if (conversationHistory.length > 0) {
      // Limit history to last 20 messages to manage context window
      const recentHistory = conversationHistory.slice(-20);
      messages.push(...recentHistory);
    }

    // Build current user message (with optional images)
    if (images.length > 0) {
      const contentParts = images.map(imageDataUrl => ({
        type: 'image_url',
        image_url: { url: imageDataUrl },
      }));
      contentParts.push({ type: 'text', text: message.trim() });
      messages.push({ role: 'user', content: contentParts });
    } else {
      messages.push({ role: 'user', content: message.trim() });
    }

    // Call OpenRouter with retry
    const response = await fetchWithRetry(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openrouter.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': config.frontendUrl,
        'X-Title': 'Agency Studio',
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages,
      }),
    }, {
      maxRetries: 3,
      initialBackoffMs: 2000,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const aiMessage = result.choices?.[0]?.message?.content;

    if (!aiMessage) {
      throw new Error('No response from AI model');
    }

    // Deduct credits
    await deductCredits(req);

    // Log to generations table for audit trail
    await supabaseAdmin.from('generations').insert({
      agency_id: agency.id,
      user_id: agencyUser.id,
      type: 'chat',
      model: 'deepseek',
      prompt: message.substring(0, 500),
      parameters: { hasImages: images.length > 0, historyLength: conversationHistory.length },
      status: 'completed',
      result_metadata: { responseLength: aiMessage.length },
      credits_cost: req.creditCost,
      completed_at: new Date().toISOString(),
    });

    res.json({
      success: true,
      response: aiMessage,
      model: CHAT_MODEL,
      usage: result.usage || null,
      creditsUsed: req.creditCost,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Chat error:', error);

    if (error.message?.includes('429')) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Please wait a moment and try again.',
      });
    }

    res.status(500).json({
      error: error.message || 'Chat request failed',
    });
  }
});

/**
 * GET /api/chat/status
 */
router.get('/status', (req, res) => {
  res.json({
    model: CHAT_MODEL,
    configured: !!config.openrouter.apiKey,
    status: config.openrouter.apiKey ? 'ready' : 'missing_api_key',
  });
});

module.exports = router;
