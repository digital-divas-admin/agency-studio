/**
 * Model Portal Routes
 * Public routes for models to view requests and upload content.
 * Authenticated via portal_token on agency_models (no user login needed).
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../services/supabase');
const { logger } = require('../services/logger');
const { config } = require('../config');
const { upload } = require('../services/upload');
const { compressImageBuffer, generateThumbnail } = require('../services/imageCompression');

/**
 * Middleware: resolve model from portal token
 * Attaches req.portalModel and req.portalAgency
 */
async function resolvePortalToken(req, res, next) {
  const { token } = req.params;

  if (!token) {
    logger.warn('Portal access attempt without token');
    return res.status(400).json({ error: 'Portal token is required' });
  }

  try {
    logger.info(`Portal token validation attempt: ${token.substring(0, 8)}...`);

    const { data: model, error } = await supabaseAdmin
      .from('agency_models')
      .select('*, agencies!inner(id, name, slug, settings)')
      .eq('portal_token', token)
      .eq('status', 'active')
      .single();

    // Handle "not found" vs actual database errors
    // Supabase returns error code 'PGRST116' when no rows found with .single()
    if (error && error.code !== 'PGRST116') {
      logger.error('Portal token query error:', error);
      return res.status(500).json({ error: 'Database error validating portal link' });
    }

    if (!model || error?.code === 'PGRST116') {
      logger.warn(`Invalid portal token attempt: ${token.substring(0, 8)}... - No matching active model found`);

      // Check if token exists but model is not active
      const { data: inactiveModel, error: inactiveError } = await supabaseAdmin
        .from('agency_models')
        .select('id, name, status')
        .eq('portal_token', token)
        .single();

      if (inactiveModel && !inactiveError) {
        logger.warn(`Portal token found but model status is: ${inactiveModel.status}`);
        return res.status(403).json({
          error: 'This portal link is not currently active. Please contact your agency.'
        });
      }

      return res.status(404).json({
        error: 'Invalid or expired portal link. Please request a new link from your agency.'
      });
    }

    logger.info(`Portal access granted for model: ${model.name} (${model.id})`);
    req.portalModel = model;
    req.portalAgency = model.agencies;
    next();
  } catch (error) {
    logger.error('Portal token resolution error:', error);
    res.status(500).json({ error: 'Server error validating portal link' });
  }
}

/**
 * GET /api/portal/:token
 * Get model info and pending content requests
 */
router.get('/:token', resolvePortalToken, async (req, res) => {
  const model = req.portalModel;
  const agency = req.portalAgency;

  try {
    // Get pending/in_progress requests for this model
    const { data: requests } = await supabaseAdmin
      .from('content_requests')
      .select('id, title, description, reference_urls, quantity_photo, quantity_video, priority, due_date, status, created_at')
      .eq('model_id', model.id)
      .in('status', ['pending', 'in_progress'])
      .order('priority', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false });

    // Get recent uploads by this model (last 20)
    const { data: recentUploads } = await supabaseAdmin
      .from('content_request_uploads')
      .select('id, url, thumbnail_url, file_name, file_type, status, request_id, uploaded_at')
      .eq('model_id', model.id)
      .order('uploaded_at', { ascending: false })
      .limit(20);

    res.json({
      model: {
        name: model.name,
        avatar_url: model.avatar_url,
      },
      agency: {
        name: agency.name,
      },
      requests: requests || [],
      recent_uploads: recentUploads || [],
    });
  } catch (error) {
    logger.error('Portal data error:', error);
    res.status(500).json({ error: 'Failed to load portal data' });
  }
});

/**
 * POST /api/portal/:token/upload-multipart
 * Upload content via multipart FormData (recommended)
 * Supports up to 20 files, 100MB each
 */
router.post('/:token/upload-multipart', resolvePortalToken, upload.array('files', 20), async (req, res) => {
  const model = req.portalModel;
  const agency = req.portalAgency;
  const { request_id, metadata: metadataStr } = req.body;
  const files = req.files;

  // Parse metadata if provided
  let metadata = {};
  if (metadataStr) {
    try {
      metadata = JSON.parse(metadataStr);
    } catch (err) {
      logger.warn('Failed to parse metadata:', err.message);
    }
  }

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  try {
    // If request_id provided, verify it belongs to this model and is active
    if (request_id) {
      const { data: request } = await supabaseAdmin
        .from('content_requests')
        .select('id, status')
        .eq('id', request_id)
        .eq('model_id', model.id)
        .single();

      if (!request) {
        return res.status(404).json({ error: 'Content request not found' });
      }

      // Auto-update request status to in_progress if still pending
      if (request.status === 'pending') {
        await supabaseAdmin
          .from('content_requests')
          .update({ status: 'in_progress' })
          .eq('id', request_id);
      }
    }

    const uploadRecords = [];

    for (const file of files) {
      const fileType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      const ext = path.extname(file.originalname);
      const fileName = `${Date.now()}_${uuidv4()}${ext}`;
      const filePath = `${agency.id}/${model.id}/${fileName}`;

      let fileBuffer = file.buffer;
      let thumbnailUrl = null;

      // Compress images
      if (fileType === 'image') {
        try {
          fileBuffer = await compressImageBuffer(file.buffer);

          // Generate thumbnail
          const thumbnailBuffer = await generateThumbnail(file.buffer);
          if (thumbnailBuffer) {
            const thumbPath = `${agency.id}/${model.id}/thumbnails/${fileName}`;
            const { data: thumbData, error: thumbError } = await supabaseAdmin.storage
              .from('model-uploads')
              .upload(thumbPath, thumbnailBuffer, {
                contentType: 'image/jpeg',
                upsert: false,
              });

            if (!thumbError && thumbData) {
              const { data: thumbPublicUrl } = supabaseAdmin.storage
                .from('model-uploads')
                .getPublicUrl(thumbPath);
              thumbnailUrl = thumbPublicUrl.publicUrl;
            }
          }
        } catch (err) {
          logger.warn('Image compression/thumbnail failed:', err.message);
          // Continue with original buffer
          fileBuffer = file.buffer;
        }
      }

      // Upload to Supabase Storage
      const { data, error } = await supabaseAdmin.storage
        .from('model-uploads')
        .upload(filePath, fileBuffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        logger.error('Storage upload error:', error);
        return res.status(500).json({ error: 'File upload failed' });
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from('model-uploads')
        .getPublicUrl(filePath);

      // Insert upload record with metadata
      const { data: uploadData } = await supabaseAdmin
        .from('content_request_uploads')
        .insert({
          agency_id: agency.id,
          model_id: model.id,
          request_id: request_id || null,
          url: publicUrlData.publicUrl,
          thumbnail_url: thumbnailUrl,
          file_name: file.originalname,
          file_type: fileType,
          file_size: file.size,
          status: 'pending_review',
          metadata: metadata || {},
        })
        .select()
        .single();

      uploadRecords.push(uploadData);
    }

    // If tied to a request, update status to delivered
    if (request_id) {
      await supabaseAdmin
        .from('content_requests')
        .update({ status: 'delivered' })
        .eq('id', request_id);
    }

    res.status(201).json({
      success: true,
      uploads: uploadRecords,
    });
  } catch (error) {
    logger.error('Multipart upload error:', error);
    res.status(500).json({ error: 'Failed to upload content' });
  }
});

/**
 * POST /api/portal/:token/upload
 * Upload content (to a specific request or as bulk/unsolicited)
 * Accepts: { request_id?, files: [{ url, file_name, file_type, file_size }] }
 *
 * Files should be data URLs (base64) or external URLs.
 * LEGACY: For backward compatibility. Use /upload-multipart for new implementations.
 */
router.post('/:token/upload', resolvePortalToken, async (req, res) => {
  const model = req.portalModel;
  const agency = req.portalAgency;
  const { request_id, files } = req.body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'files array is required' });
  }

  if (files.length > 20) {
    return res.status(400).json({ error: 'Maximum 20 files per upload' });
  }

  try {
    // If request_id provided, verify it belongs to this model and is active
    if (request_id) {
      const { data: request } = await supabaseAdmin
        .from('content_requests')
        .select('id, status')
        .eq('id', request_id)
        .eq('model_id', model.id)
        .single();

      if (!request) {
        return res.status(404).json({ error: 'Content request not found' });
      }

      // Auto-update request status to in_progress if still pending
      if (request.status === 'pending') {
        await supabaseAdmin
          .from('content_requests')
          .update({ status: 'in_progress' })
          .eq('id', request_id);
      }
    }

    // Upload files to Supabase Storage if available, otherwise store URLs directly
    const uploads = [];
    for (const file of files) {
      let storedUrl = file.url;
      let thumbnailUrl = null;

      // If the URL is a data URL (base64), try to upload to Supabase Storage
      if (file.url && file.url.startsWith('data:')) {
        try {
          const base64Data = file.url.split(',')[1];
          const mimeType = file.url.split(';')[0].split(':')[1];
          const ext = mimeType.split('/')[1] || 'jpg';
          const buffer = Buffer.from(base64Data, 'base64');
          const filePath = `${agency.id}/${model.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

          const { data: storageData, error: storageError } = await supabaseAdmin.storage
            .from('model-uploads')
            .upload(filePath, buffer, {
              contentType: mimeType,
              upsert: false,
            });

          if (!storageError && storageData) {
            const { data: publicUrl } = supabaseAdmin.storage
              .from('model-uploads')
              .getPublicUrl(filePath);
            storedUrl = publicUrl.publicUrl;
          } else if (config.isProd) {
            logger.error('Storage upload failed in production:', storageError?.message);
            return res.status(500).json({ error: 'File storage is not configured. Contact your administrator.' });
          } else {
            logger.warn('Storage upload failed, storing data URL directly (dev only):', storageError?.message);
          }
        } catch (storageErr) {
          if (config.isProd) {
            logger.error('Storage not available in production:', storageErr.message);
            return res.status(500).json({ error: 'File storage is not configured. Contact your administrator.' });
          }
          logger.warn('Storage not available, storing data URL directly (dev only):', storageErr.message);
        }
      }

      uploads.push({
        agency_id: agency.id,
        model_id: model.id,
        request_id: request_id || null,
        url: storedUrl,
        thumbnail_url: thumbnailUrl,
        file_name: file.file_name || null,
        file_type: file.file_type || 'image',
        file_size: file.file_size || null,
        status: 'pending_review',
      });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('content_request_uploads')
      .insert(uploads)
      .select();

    if (error) {
      logger.error('Error inserting uploads:', error);
      return res.status(500).json({ error: 'Failed to save uploads' });
    }

    // If tied to a request, update status to delivered
    if (request_id) {
      await supabaseAdmin
        .from('content_requests')
        .update({ status: 'delivered' })
        .eq('id', request_id);
    }

    res.status(201).json({
      success: true,
      uploads: inserted || [],
    });
  } catch (error) {
    logger.error('Portal upload error:', error);
    res.status(500).json({ error: 'Failed to upload content' });
  }
});

/**
 * POST /api/portal/:token/requests/:requestId/note
 * Model can add a note to a request (e.g., "couldn't do outdoor, it rained")
 */
router.post('/:token/requests/:requestId/note', resolvePortalToken, async (req, res) => {
  const model = req.portalModel;
  const { note } = req.body;

  if (!note) {
    return res.status(400).json({ error: 'note is required' });
  }

  try {
    const { data: request, error } = await supabaseAdmin
      .from('content_requests')
      .select('id, description')
      .eq('id', req.params.requestId)
      .eq('model_id', model.id)
      .single();

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Append model note to description
    const updatedDesc = request.description
      ? `${request.description}\n\n--- Model note ---\n${note}`
      : `--- Model note ---\n${note}`;

    await supabaseAdmin
      .from('content_requests')
      .update({ description: updatedDesc })
      .eq('id', request.id);

    res.json({ success: true });
  } catch (error) {
    logger.error('Portal note error:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

module.exports = router;
