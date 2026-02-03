const sharp = require('sharp');
const { supabaseAdmin } = require('./supabase');

// Asset upload limits by type
const ASSET_LIMITS = {
  logo: {
    maxSize: 2 * 1024 * 1024, // 2MB
    formats: ['png', 'jpg', 'jpeg', 'svg', 'webp'],
    maxWidth: 512,
    maxHeight: 512
  },
  favicon: {
    maxSize: 512 * 1024, // 512KB
    formats: ['png', 'ico'],
    sizes: [16, 32, 64] // Standard favicon sizes
  },
  login_background: {
    maxSize: 5 * 1024 * 1024, // 5MB
    formats: ['png', 'jpg', 'jpeg', 'webp'],
    maxWidth: 1920,
    maxHeight: 1080
  },
  email_header_logo: {
    maxSize: 1 * 1024 * 1024, // 1MB
    formats: ['png', 'jpg', 'jpeg', 'webp'],
    maxWidth: 600,
    maxHeight: 200
  }
};

/**
 * Validate file size and format
 * @param {Object} file - Multer file object
 * @param {string} assetType - Type of asset
 * @returns {Object} Validation result
 */
function validateFile(file, assetType) {
  const limits = ASSET_LIMITS[assetType];

  if (!limits) {
    return {
      valid: false,
      error: `Unknown asset type: ${assetType}`
    };
  }

  // Check file size
  if (file.size > limits.maxSize) {
    return {
      valid: false,
      error: `File exceeds ${limits.maxSize / 1024 / 1024}MB limit`
    };
  }

  // Check file format
  const ext = file.mimetype.split('/')[1];
  if (!limits.formats.includes(ext)) {
    return {
      valid: false,
      error: `Invalid format. Allowed: ${limits.formats.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Optimize image using Sharp
 * @param {Buffer} buffer - Image buffer
 * @param {string} assetType - Type of asset
 * @param {string} format - File format
 * @returns {Promise<Buffer>} Optimized image buffer
 */
async function optimizeImage(buffer, assetType, format) {
  // Skip optimization for SVG and ICO
  if (format === 'svg' || format === 'ico') {
    return buffer;
  }

  const limits = ASSET_LIMITS[assetType];
  let sharpInstance = sharp(buffer);

  // Resize if dimensions are specified
  if (limits.maxWidth || limits.maxHeight) {
    sharpInstance = sharpInstance.resize(limits.maxWidth, limits.maxHeight, {
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  // Convert to WebP for better compression (except favicon)
  if (assetType !== 'favicon') {
    return sharpInstance
      .webp({ quality: 85 })
      .toBuffer();
  }

  // For favicon, keep as PNG
  return sharpInstance
    .png({ quality: 90, compressionLevel: 9 })
    .toBuffer();
}

/**
 * Upload asset to Supabase Storage
 * @param {string} agencyId - Agency UUID
 * @param {Object} file - Multer file object
 * @param {string} assetType - Type of asset (logo, favicon, etc.)
 * @param {string} uploadedBy - User UUID who uploaded the asset
 * @returns {Promise<Object>} Upload result with URL and metadata
 */
async function uploadAsset(agencyId, file, assetType, uploadedBy = null) {
  // Validate file
  const validation = validateFile(file, assetType);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const ext = file.mimetype.split('/')[1];
  let buffer = file.buffer;
  let finalMimeType = file.mimetype;

  // Optimize image
  try {
    buffer = await optimizeImage(buffer, assetType, ext);

    // Update mime type if converted to WebP
    if (assetType !== 'favicon' && ext !== 'svg') {
      finalMimeType = 'image/webp';
    }
  } catch (error) {
    console.error('Image optimization failed:', error);
    throw new Error('Failed to process image. File may be corrupted.');
  }

  // Generate unique filename
  const timestamp = Date.now();
  const finalExt = assetType !== 'favicon' && ext !== 'svg' ? 'webp' : ext;
  const fileName = `${assetType}-${timestamp}.${finalExt}`;
  const storagePath = `${agencyId}/${assetType}s/${fileName}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabaseAdmin.storage
    .from('agency-assets')
    .upload(storagePath, buffer, {
      contentType: finalMimeType,
      cacheControl: '31536000', // 1 year cache
      upsert: false
    });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('agency-assets')
    .getPublicUrl(storagePath);

  // Record in database
  const { data: assetRecord, error: dbError } = await supabaseAdmin
    .from('asset_uploads')
    .insert({
      agency_id: agencyId,
      asset_type: assetType,
      file_name: file.originalname,
      file_size_bytes: buffer.length,
      mime_type: finalMimeType,
      url: publicUrl,
      storage_path: storagePath,
      uploaded_by: uploadedBy
    })
    .select()
    .single();

  if (dbError) {
    console.error('Database record error:', dbError);
    // Try to cleanup uploaded file
    await supabaseAdmin.storage
      .from('agency-assets')
      .remove([storagePath]);

    throw new Error('Failed to record upload in database');
  }

  return {
    id: assetRecord.id,
    url: publicUrl,
    path: storagePath,
    fileName: fileName,
    size: buffer.length,
    mimeType: finalMimeType
  };
}

/**
 * Delete asset from storage and database
 * @param {string} agencyId - Agency UUID
 * @param {string} assetType - Type of asset
 * @returns {Promise<boolean>} Success status
 */
async function deleteAsset(agencyId, assetType) {
  // Find existing asset
  const { data: asset, error: findError } = await supabaseAdmin
    .from('asset_uploads')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('asset_type', assetType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (findError || !asset) {
    return false; // No asset to delete
  }

  // Delete from storage
  const { error: storageError } = await supabaseAdmin.storage
    .from('agency-assets')
    .remove([asset.storage_path]);

  if (storageError) {
    console.error('Storage deletion error:', storageError);
  }

  // Delete from database
  const { error: dbError } = await supabaseAdmin
    .from('asset_uploads')
    .delete()
    .eq('id', asset.id);

  if (dbError) {
    console.error('Database deletion error:', dbError);
    return false;
  }

  return true;
}

/**
 * Get asset URL for agency
 * @param {string} agencyId - Agency UUID
 * @param {string} assetType - Type of asset
 * @returns {Promise<string|null>} Asset URL or null
 */
async function getAssetUrl(agencyId, assetType) {
  const { data: asset, error } = await supabaseAdmin
    .from('asset_uploads')
    .select('url')
    .eq('agency_id', agencyId)
    .eq('asset_type', assetType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !asset) {
    return null;
  }

  return asset.url;
}

module.exports = {
  uploadAsset,
  deleteAsset,
  getAssetUrl,
  ASSET_LIMITS
};
