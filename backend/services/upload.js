/**
 * Upload Service
 * Handles multipart file uploads with multer
 */

const multer = require('multer');
const path = require('path');

// Use memory storage for processing
const storage = multer.memoryStorage();

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|webm|quicktime/;
  const mimeType = allowedTypes.test(file.mimetype);
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (mimeType && extname) {
    return cb(null, true);
  }
  cb(new Error('Invalid file type. Allowed: JPG, PNG, GIF, WebP, MP4, MOV, WebM'));
};

// Configure multer
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 20, // Max 20 files per upload
  },
  fileFilter,
});

module.exports = { upload };
