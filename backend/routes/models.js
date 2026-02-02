/**
 * Agency Models Routes
 * CRUD for managing creator/talent profiles (LoRA config, gallery scoping)
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { supabaseAdmin } = require('../services/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logger } = require('../services/logger');
const { upload } = require('../services/upload');
const { compressImageBuffer, generateThumbnail } = require('../services/imageCompression');

/**
 * Generate URL-safe slug from a name
 */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate phone format (flexible - allows various formats)
 */
function isValidPhone(phone) {
  // Allow various formats: +1-555-555-5555, (555) 555-5555, 555-555-5555, etc.
  return /^[\d\s\-\(\)\+]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

/**
 * Filter model fields based on user role and visibility settings
 */
function filterModelFields(model, isAdmin) {
  if (isAdmin) {
    // Admins see everything
    return model;
  }

  // For regular users, filter based on field_visibility
  const visibility = model.field_visibility || {};
  const filtered = { ...model };

  // Remove fields that are not visible to regular users
  if (!visibility.email) delete filtered.email;
  if (!visibility.phone) delete filtered.phone;
  if (!visibility.bio) delete filtered.bio;
  if (!visibility.social_media) delete filtered.social_media;
  if (!visibility.onlyfans_handle) delete filtered.onlyfans_handle;
  if (!visibility.joined_date) delete filtered.joined_date;
  if (!visibility.contract_split) delete filtered.contract_split;
  if (!visibility.content_preferences) delete filtered.content_preferences;

  // Always remove sensitive internal fields
  delete filtered.field_visibility;
  delete filtered.notes;
  delete filtered.contract_notes;

  return filtered;
}

/**
 * POST /api/models/upload-avatar
 * Upload a model avatar image
 */
router.post('/upload-avatar', requireAuth, requireAdmin, upload.single('avatar'), async (req, res) => {
  const { agency } = req;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  if (!file.mimetype.startsWith('image/')) {
    return res.status(400).json({ error: 'File must be an image' });
  }

  try {
    const ext = path.extname(file.originalname);
    const fileName = `avatar_${Date.now()}_${uuidv4()}${ext}`;
    const filePath = `${agency.id}/avatars/${fileName}`;

    // Compress image
    let fileBuffer = file.buffer;
    try {
      fileBuffer = await compressImageBuffer(file.buffer);
    } catch (err) {
      logger.warn('Avatar compression failed, using original:', err.message);
      fileBuffer = file.buffer;
    }

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('model-uploads')
      .upload(filePath, fileBuffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      logger.error('Avatar upload error:', error);
      return res.status(500).json({
        error: 'Avatar upload failed',
        details: error.message || error
      });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('model-uploads')
      .getPublicUrl(filePath);

    res.json({
      success: true,
      url: publicUrlData.publicUrl,
    });
  } catch (error) {
    logger.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

/**
 * GET /api/models
 * List all models for the agency (active by default, ?status=all for all)
 */
router.get('/', requireAuth, async (req, res) => {
  const { agency, agencyUser } = req;
  const { status = 'active' } = req.query;
  const isAdmin = agencyUser.role === 'admin' || agencyUser.role === 'owner';

  try {
    let query = supabaseAdmin
      .from('agency_models')
      .select('*')
      .eq('agency_id', agency.id)
      .order('name', { ascending: true });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: models, error } = await query;

    if (error) {
      logger.error('Error fetching models:', error);
      return res.status(500).json({ error: 'Failed to fetch models' });
    }

    // Filter fields based on user role and visibility settings
    const filteredModels = (models || []).map(m => filterModelFields(m, isAdmin));

    res.json({ models: filteredModels });
  } catch (error) {
    logger.error('Error in models route:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

/**
 * GET /api/models/:id
 * Get a single model with generation stats
 */
router.get('/:id', requireAuth, async (req, res) => {
  const { agency, agencyUser } = req;
  const { id } = req.params;
  const isAdmin = agencyUser.role === 'admin' || agencyUser.role === 'owner';

  try {
    const { data: model, error } = await supabaseAdmin
      .from('agency_models')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agency.id)
      .single();

    if (error || !model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // Get gallery count for this model
    const { count: galleryCount } = await supabaseAdmin
      .from('gallery_items')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agency.id)
      .eq('model_id', id);

    // Get generation count for this model
    const { count: generationCount } = await supabaseAdmin
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agency.id)
      .eq('model_id', id);

    const modelWithStats = {
      ...model,
      stats: {
        galleryItems: galleryCount || 0,
        generations: generationCount || 0,
      },
    };

    // Filter fields based on user role
    const filteredModel = filterModelFields(modelWithStats, isAdmin);

    res.json(filteredModel);
  } catch (error) {
    logger.error('Error fetching model:', error);
    res.status(500).json({ error: 'Failed to fetch model' });
  }
});

/**
 * POST /api/models
 * Create a new model (admin only)
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { agency } = req;

  try {
    const {
      name,
      avatar_url,
      lora_config,
      onlyfans_handle,
      notes,
      // NEW PROFILE FIELDS:
      email,
      phone,
      bio,
      joined_date,
      social_media,
      contract_split,
      contract_notes,
      content_preferences,
      field_visibility
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Validate email if provided
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate phone if provided
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone format' });
    }

    // Generate slug, ensure uniqueness
    let slug = slugify(name.trim());
    const { data: existing } = await supabaseAdmin
      .from('agency_models')
      .select('slug')
      .eq('agency_id', agency.id)
      .eq('slug', slug)
      .single();

    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const { data: model, error } = await supabaseAdmin
      .from('agency_models')
      .insert({
        agency_id: agency.id,
        name: name.trim(),
        slug,
        avatar_url: avatar_url || null,
        lora_config: lora_config || {},
        onlyfans_handle: onlyfans_handle || null,
        notes: notes || null,
        // NEW PROFILE FIELDS:
        email: email || null,
        phone: phone || null,
        bio: bio || null,
        joined_date: joined_date || new Date().toISOString().split('T')[0],
        social_media: social_media || {},
        contract_split: contract_split || null,
        contract_notes: contract_notes || null,
        content_preferences: content_preferences || {},
        field_visibility: field_visibility || {
          email: false,
          phone: false,
          bio: true,
          social_media: true,
          onlyfans_handle: true,
          joined_date: false,
          contract_split: false,
          contract_notes: false,
          content_preferences: false
        },
        portal_token: uuidv4(),
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating model:', error);
      return res.status(500).json({ error: 'Failed to create model' });
    }

    logger.info('Model created', {
      agencyId: agency.id,
      modelId: model.id,
      name: model.name,
      portalToken: model.portal_token?.substring(0, 8) + '...'
    });

    res.status(201).json(model);
  } catch (error) {
    logger.error('Error creating model:', error);
    res.status(500).json({ error: 'Failed to create model' });
  }
});

/**
 * PUT /api/models/:id
 * Update a model (admin only)
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { agency } = req;
  const { id } = req.params;

  try {
    // Verify model belongs to agency
    const { data: existing } = await supabaseAdmin
      .from('agency_models')
      .select('id')
      .eq('id', id)
      .eq('agency_id', agency.id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const {
      name,
      avatar_url,
      lora_config,
      onlyfans_handle,
      notes,
      status,
      // NEW PROFILE FIELDS:
      email,
      phone,
      bio,
      joined_date,
      social_media,
      contract_split,
      contract_notes,
      content_preferences,
      field_visibility
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (lora_config !== undefined) updates.lora_config = lora_config;
    if (onlyfans_handle !== undefined) updates.onlyfans_handle = onlyfans_handle;
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined && ['active', 'archived'].includes(status)) updates.status = status;

    // NEW PROFILE FIELDS:
    if (email !== undefined) {
      if (email && !isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      updates.email = email;
    }
    if (phone !== undefined) {
      if (phone && !isValidPhone(phone)) {
        return res.status(400).json({ error: 'Invalid phone format' });
      }
      updates.phone = phone;
    }
    if (bio !== undefined) updates.bio = bio;
    if (joined_date !== undefined) updates.joined_date = joined_date;
    if (social_media !== undefined) updates.social_media = social_media;
    if (contract_split !== undefined) updates.contract_split = contract_split;
    if (contract_notes !== undefined) updates.contract_notes = contract_notes;
    if (content_preferences !== undefined) updates.content_preferences = content_preferences;
    if (field_visibility !== undefined) updates.field_visibility = field_visibility;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data: model, error } = await supabaseAdmin
      .from('agency_models')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating model:', error);
      return res.status(500).json({ error: 'Failed to update model' });
    }

    res.json(model);
  } catch (error) {
    logger.error('Error updating model:', error);
    res.status(500).json({ error: 'Failed to update model' });
  }
});

/**
 * DELETE /api/models/:id
 * Archive a model (admin only) — soft delete
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { agency } = req;
  const { id } = req.params;

  try {
    const { data: model, error } = await supabaseAdmin
      .from('agency_models')
      .update({ status: 'archived' })
      .eq('id', id)
      .eq('agency_id', agency.id)
      .select()
      .single();

    if (error || !model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    logger.info('Model archived', { agencyId: agency.id, modelId: id });

    res.json({ success: true, model });
  } catch (error) {
    logger.error('Error archiving model:', error);
    res.status(500).json({ error: 'Failed to archive model' });
  }
});

module.exports = router;
