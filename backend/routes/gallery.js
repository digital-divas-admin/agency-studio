/**
 * Gallery Routes
 * Fetch and manage saved gallery items
 * Supports per-model filtering, source type filtering, and image uploads
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { requireAuth } = require('../middleware/auth');
const { logger } = require('../services/logger');

/**
 * GET /api/gallery
 * Fetch gallery items for the current user
 * Query params: limit, offset, type, favorites, model_id, source
 */
router.get('/', requireAuth, async (req, res) => {
  const { agency, agencyUser } = req;
  const {
    limit: rawLimit = 50,
    offset: rawOffset = 0,
    type,
    favorites,
    model_id,
    source,
  } = req.query;

  try {
    // Enforce maximum limit to prevent excessive data fetching
    const MAX_LIMIT = 100;
    const limit = Math.min(Math.max(parseInt(rawLimit) || 50, 1), MAX_LIMIT);
    const offset = Math.max(parseInt(rawOffset) || 0, 0);

    let query = supabaseAdmin
      .from('gallery_items')
      .select('*')
      .eq('agency_id', agency.id)
      .eq('user_id', agencyUser.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('type', type);
    }

    if (favorites === 'true') {
      query = query.eq('is_favorited', true);
    }

    if (model_id) {
      query = query.eq('model_id', model_id);
    }

    if (source) {
      query = query.eq('source', source);
    }

    const { data: items, error } = await query;

    if (error) {
      logger.error('Error fetching gallery items:', error);
      return res.status(500).json({ error: 'Failed to fetch gallery items' });
    }

    // Get total count with same filters
    let countQuery = supabaseAdmin
      .from('gallery_items')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agency.id)
      .eq('user_id', agencyUser.id);

    if (type) countQuery = countQuery.eq('type', type);
    if (favorites === 'true') countQuery = countQuery.eq('is_favorited', true);
    if (model_id) countQuery = countQuery.eq('model_id', model_id);
    if (source) countQuery = countQuery.eq('source', source);

    const { count } = await countQuery;

    res.json({
      items: items || [],
      total: count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Error in gallery route:', error);
    res.status(500).json({ error: 'Failed to fetch gallery items' });
  }
});

/**
 * POST /api/gallery/upload
 * Upload reference images to a model's gallery
 * Body: { model_id, images: [{ url, title? }], ... } or { model_id, url, title? }
 */
router.post('/upload', requireAuth, async (req, res) => {
  const { agency, agencyUser } = req;

  try {
    const { model_id, images, url, title } = req.body;

    if (!model_id) {
      return res.status(400).json({ error: 'model_id is required' });
    }

    // Verify model belongs to agency
    const { data: model } = await supabaseAdmin
      .from('agency_models')
      .select('id')
      .eq('id', model_id)
      .eq('agency_id', agency.id)
      .single();

    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // Support single or batch upload
    const toInsert = [];

    if (images && Array.isArray(images)) {
      for (const img of images) {
        // Support both string (data URL) and object ({ url, title }) formats
        const imgUrl = typeof img === 'string' ? img : img.url;
        const imgTitle = typeof img === 'string' ? 'Uploaded' : (img.title || 'Uploaded');
        if (!imgUrl) continue;
        toInsert.push({
          agency_id: agency.id,
          user_id: agencyUser.id,
          model_id,
          title: imgTitle,
          url: imgUrl,
          type: 'image',
          source: 'upload',
          tags: ['upload'],
        });
      }
    } else if (url) {
      toInsert.push({
        agency_id: agency.id,
        user_id: agencyUser.id,
        model_id,
        title: title || 'Uploaded',
        url,
        type: 'image',
        source: 'upload',
        tags: ['upload'],
      });
    }

    if (toInsert.length === 0) {
      return res.status(400).json({ error: 'No valid images provided' });
    }

    const { data: items, error } = await supabaseAdmin
      .from('gallery_items')
      .insert(toInsert)
      .select();

    if (error) {
      logger.error('Error uploading to gallery:', error);
      return res.status(500).json({ error: 'Failed to upload images' });
    }

    logger.info('Gallery upload', {
      agencyId: agency.id,
      modelId: model_id,
      count: items.length,
    });

    res.status(201).json({ success: true, items: items || [] });
  } catch (error) {
    logger.error('Error in gallery upload:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

/**
 * DELETE /api/gallery/:id
 * Delete a gallery item
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const { agency, agencyUser } = req;
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('gallery_items')
      .delete()
      .eq('id', id)
      .eq('agency_id', agency.id)
      .eq('user_id', agencyUser.id);

    if (error) {
      logger.error('Error deleting gallery item:', error);
      return res.status(500).json({ error: 'Failed to delete item' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting gallery item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

/**
 * PUT /api/gallery/:id/favorite
 * Toggle favorite status
 */
router.put('/:id/favorite', requireAuth, async (req, res) => {
  const { agency, agencyUser } = req;
  const { id } = req.params;

  try {
    // Get current status
    const { data: item } = await supabaseAdmin
      .from('gallery_items')
      .select('is_favorited')
      .eq('id', id)
      .eq('agency_id', agency.id)
      .eq('user_id', agencyUser.id)
      .single();

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Toggle (defensive: add agency_id and user_id filters for extra safety)
    const { data: updated, error } = await supabaseAdmin
      .from('gallery_items')
      .update({ is_favorited: !item.is_favorited })
      .eq('id', id)
      .eq('agency_id', agency.id)
      .eq('user_id', agencyUser.id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating favorite:', error);
      return res.status(500).json({ error: 'Failed to update favorite' });
    }

    res.json({ success: true, item: updated });
  } catch (error) {
    logger.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

/**
 * DELETE /api/gallery
 * Clear all gallery items for the user
 */
router.delete('/', requireAuth, async (req, res) => {
  const { agency, agencyUser } = req;

  try {
    const { error } = await supabaseAdmin
      .from('gallery_items')
      .delete()
      .eq('agency_id', agency.id)
      .eq('user_id', agencyUser.id);

    if (error) {
      logger.error('Error clearing gallery:', error);
      return res.status(500).json({ error: 'Failed to clear gallery' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error clearing gallery:', error);
    res.status(500).json({ error: 'Failed to clear gallery' });
  }
});

module.exports = router;
