/**
 * Content Requests Routes
 * Manager-side CRUD for content requests and upload review
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { requireAuth } = require('../middleware/auth');
const { logger } = require('../services/logger');

// All routes require authentication
router.use(requireAuth);

// Allowed enum values (must match DB CHECK constraints)
const VALID_STATUSES = ['pending', 'in_progress', 'delivered', 'approved', 'cancelled'];
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

/**
 * GET /api/content-requests
 * List content requests, optionally filtered by model_id or status
 */
router.get('/', async (req, res) => {
  const { agency } = req;
  const { model_id, status } = req.query;

  try {
    let query = supabaseAdmin
      .from('content_requests')
      .select(`
        *,
        agency_models!inner(id, name, avatar_url),
        agency_users(id, name),
        content_request_uploads(id, status)
      `)
      .eq('agency_id', agency.id)
      .order('created_at', { ascending: false });

    if (model_id) query = query.eq('model_id', model_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      logger.error('Error listing content requests:', error);
      return res.status(500).json({ error: 'Failed to list content requests' });
    }

    // Enrich with upload counts
    const requests = (data || []).map((r) => ({
      ...r,
      model_name: r.agency_models?.name,
      model_avatar: r.agency_models?.avatar_url,
      created_by_name: r.agency_users?.name,
      upload_count: r.content_request_uploads?.length || 0,
      pending_review_count: r.content_request_uploads?.filter((u) => u.status === 'pending_review').length || 0,
      approved_count: r.content_request_uploads?.filter((u) => u.status === 'approved').length || 0,
      // Clean up nested data
      agency_models: undefined,
      agency_users: undefined,
      content_request_uploads: undefined,
    }));

    res.json(requests);
  } catch (error) {
    logger.error('Error listing content requests:', error);
    res.status(500).json({ error: 'Failed to list content requests' });
  }
});

/**
 * GET /api/content-requests/uploads/pending
 * Get all pending uploads across all requests (for dashboard/notifications)
 * NOTE: Must be defined before /:id to avoid matching "uploads" as an ID
 */
router.get('/uploads/pending', async (req, res) => {
  const { agency } = req;

  try {
    const { data, error } = await supabaseAdmin
      .from('content_request_uploads')
      .select(`
        *,
        agency_models(id, name),
        content_requests(id, title)
      `)
      .eq('agency_id', agency.id)
      .eq('status', 'pending_review')
      .order('uploaded_at', { ascending: false });

    if (error) {
      logger.error('Error getting pending uploads:', error);
      return res.status(500).json({ error: 'Failed to get pending uploads' });
    }

    res.json(data || []);
  } catch (error) {
    logger.error('Error getting pending uploads:', error);
    res.status(500).json({ error: 'Failed to get pending uploads' });
  }
});

/**
 * POST /api/content-requests/uploads/bulk-review
 * Bulk approve or reject multiple uploads
 * NOTE: Must be defined before /:id to avoid matching "uploads" as an ID
 */
router.post('/uploads/bulk-review', async (req, res) => {
  const { agency, agencyUser } = req;
  const { upload_ids, action, rejection_note } = req.body;

  if (!upload_ids || !Array.isArray(upload_ids) || upload_ids.length === 0) {
    return res.status(400).json({ error: 'upload_ids array required' });
  }

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be approve or reject' });
  }

  if (action === 'reject' && !rejection_note?.trim()) {
    return res.status(400).json({ error: 'rejection_note required for rejections' });
  }

  try {
    let approved = 0;
    let rejected = 0;
    let failed = 0;

    // Process each upload
    for (const upload_id of upload_ids) {
      try {
        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        // Update upload
        const { data: upload } = await supabaseAdmin
          .from('content_request_uploads')
          .update({
            status: newStatus,
            reviewed_by: agencyUser.id,
            reviewed_at: new Date().toISOString(),
            rejection_note: action === 'reject' ? rejection_note : null,
          })
          .eq('id', upload_id)
          .eq('agency_id', agency.id)
          .select()
          .single();

        if (!upload) {
          failed++;
          continue;
        }

        // If approved, create gallery item
        if (action === 'approve') {
          await supabaseAdmin.from('gallery_items').insert({
            agency_id: upload.agency_id,
            model_id: upload.model_id,
            type: upload.file_type === 'video' ? 'video' : 'image',
            url: upload.url,
            thumbnail_url: upload.thumbnail_url,
            title: upload.file_name || 'Model Upload',
            source: 'model_upload',
            tags: ['model-upload'],
          });
          approved++;
        } else {
          rejected++;
        }

        // Check if all uploads for the parent request are reviewed
        if (upload.request_id) {
          const { data: siblings } = await supabaseAdmin
            .from('content_request_uploads')
            .select('status')
            .eq('request_id', upload.request_id);

          const allReviewed = siblings?.every((s) => s.status !== 'pending_review');
          const anyApproved = siblings?.some((s) => s.status === 'approved');

          if (allReviewed && anyApproved) {
            await supabaseAdmin
              .from('content_requests')
              .update({ status: 'approved' })
              .eq('id', upload.request_id);
          }
        }
      } catch (err) {
        logger.error('Bulk review error for upload', upload_id, err);
        failed++;
      }
    }

    res.json({ approved, rejected, failed });
  } catch (error) {
    logger.error('Bulk review error:', error);
    res.status(500).json({ error: 'Failed to process bulk review' });
  }
});

/**
 * PUT /api/content-requests/uploads/:uploadId/review
 * Approve or reject an upload
 * NOTE: Must be defined before /:id to avoid matching "uploads" as an ID
 */
router.put('/uploads/:uploadId/review', async (req, res) => {
  const { agency, agencyUser } = req;
  const { action, rejection_note } = req.body;

  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be "approve" or "reject"' });
  }

  try {
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { data: upload, error } = await supabaseAdmin
      .from('content_request_uploads')
      .update({
        status: newStatus,
        rejection_note: action === 'reject' ? (rejection_note || null) : null,
        reviewed_by: agencyUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.params.uploadId)
      .eq('agency_id', agency.id)
      .select()
      .single();

    if (error || !upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    // If approved, create a gallery_item for this upload
    if (action === 'approve') {
      const { data: galleryItem } = await supabaseAdmin
        .from('gallery_items')
        .insert({
          agency_id: upload.agency_id,
          model_id: upload.model_id,
          title: upload.file_name || 'Model Upload',
          url: upload.url,
          thumbnail_url: upload.thumbnail_url,
          type: upload.file_type === 'video' ? 'video' : 'image',
          source: 'model_upload',
          tags: ['model-upload'],
        })
        .select()
        .single();

      // Link gallery item to the upload record
      if (galleryItem) {
        await supabaseAdmin
          .from('content_request_uploads')
          .update({ gallery_item_id: galleryItem.id })
          .eq('id', upload.id);
      }
    }

    // Check if all uploads for the parent request are reviewed
    if (upload.request_id) {
      const { data: siblings } = await supabaseAdmin
        .from('content_request_uploads')
        .select('status')
        .eq('request_id', upload.request_id);

      const allReviewed = siblings?.every((s) => s.status !== 'pending_review');
      const anyApproved = siblings?.some((s) => s.status === 'approved');

      if (allReviewed && anyApproved) {
        await supabaseAdmin
          .from('content_requests')
          .update({ status: 'approved' })
          .eq('id', upload.request_id);
      }
    }

    res.json(upload);
  } catch (error) {
    logger.error('Error reviewing upload:', error);
    res.status(500).json({ error: 'Failed to review upload' });
  }
});

/**
 * GET /api/content-requests/:id
 * Get a single content request with all uploads
 */
router.get('/:id', async (req, res) => {
  const { agency } = req;

  try {
    const { data: request, error } = await supabaseAdmin
      .from('content_requests')
      .select(`
        *,
        agency_models(id, name, avatar_url, portal_token),
        agency_users(id, name)
      `)
      .eq('id', req.params.id)
      .eq('agency_id', agency.id)
      .single();

    if (error || !request) {
      return res.status(404).json({ error: 'Content request not found' });
    }

    // Get uploads for this request
    const { data: uploads } = await supabaseAdmin
      .from('content_request_uploads')
      .select('*')
      .eq('request_id', req.params.id)
      .order('uploaded_at', { ascending: false });

    // Only expose portal_token to owners and admins
    const isAdmin = ['owner', 'admin'].includes(req.agencyUser?.role);

    res.json({
      ...request,
      model_name: request.agency_models?.name,
      model_avatar: request.agency_models?.avatar_url,
      portal_token: isAdmin ? request.agency_models?.portal_token : undefined,
      created_by_name: request.agency_users?.name,
      uploads: uploads || [],
      agency_models: undefined,
      agency_users: undefined,
    });
  } catch (error) {
    logger.error('Error getting content request:', error);
    res.status(500).json({ error: 'Failed to get content request' });
  }
});

/**
 * POST /api/content-requests
 * Create a new content request
 */
router.post('/', async (req, res) => {
  const { agency, agencyUser } = req;
  const { model_id, title, description, reference_urls, quantity_photo, quantity_video, priority, due_date } = req.body;

  if (!model_id || !title) {
    return res.status(400).json({ error: 'model_id and title are required' });
  }

  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
  }

  if (reference_urls !== undefined && !Array.isArray(reference_urls)) {
    return res.status(400).json({ error: 'reference_urls must be an array' });
  }

  try {
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

    const { data: request, error } = await supabaseAdmin
      .from('content_requests')
      .insert({
        agency_id: agency.id,
        model_id,
        created_by: agencyUser.id,
        title,
        description: description || null,
        reference_urls: reference_urls || [],
        quantity_photo: quantity_photo || 0,
        quantity_video: quantity_video || 0,
        priority: priority || 'normal',
        due_date: due_date || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating content request:', error);
      return res.status(500).json({ error: 'Failed to create content request' });
    }

    res.status(201).json(request);
  } catch (error) {
    logger.error('Error creating content request:', error);
    res.status(500).json({ error: 'Failed to create content request' });
  }
});

/**
 * PUT /api/content-requests/:id
 * Update a content request
 */
router.put('/:id', async (req, res) => {
  const { agency } = req;
  const { title, description, reference_urls, quantity_photo, quantity_video, priority, due_date, status } = req.body;

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
  }

  if (reference_urls !== undefined && !Array.isArray(reference_urls)) {
    return res.status(400).json({ error: 'reference_urls must be an array' });
  }

  try {
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (reference_urls !== undefined) updates.reference_urls = reference_urls;
    if (quantity_photo !== undefined) updates.quantity_photo = quantity_photo;
    if (quantity_video !== undefined) updates.quantity_video = quantity_video;
    if (priority !== undefined) updates.priority = priority;
    if (due_date !== undefined) updates.due_date = due_date;
    if (status !== undefined) updates.status = status;

    const { data: request, error } = await supabaseAdmin
      .from('content_requests')
      .update(updates)
      .eq('id', req.params.id)
      .eq('agency_id', agency.id)
      .select()
      .single();

    if (error || !request) {
      return res.status(404).json({ error: 'Content request not found' });
    }

    res.json(request);
  } catch (error) {
    logger.error('Error updating content request:', error);
    res.status(500).json({ error: 'Failed to update content request' });
  }
});

/**
 * DELETE /api/content-requests/:id
 * Delete a content request
 */
router.delete('/:id', async (req, res) => {
  const { agency } = req;

  try {
    const { error } = await supabaseAdmin
      .from('content_requests')
      .delete()
      .eq('id', req.params.id)
      .eq('agency_id', agency.id);

    if (error) {
      logger.error('Error deleting content request:', error);
      return res.status(500).json({ error: 'Failed to delete content request' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting content request:', error);
    res.status(500).json({ error: 'Failed to delete content request' });
  }
});

module.exports = router;
