const express = require('express');
const multer = require('multer');
const {
  uploadFile,
  deleteFile,
  getStorageStatus,
  extractS3Key,
  getS3Client,
  isS3Configured,
} = require('../utils/storage');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

const router = express.Router();
const upload = multer({
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

const allowedFolders = new Set([
  'organization-images',
  'sub-user-images',
  'voting-candidate-images',
]);

const handleUploadRequest = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const requestedFolder =
      typeof req.body.folder === 'string' ? req.body.folder.trim() : '';
    const folder = allowedFolders.has(requestedFolder)
      ? requestedFolder
      : 'misc';

    const result = await uploadFile({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      folder,
    });

    return res.status(200).json({
      url: result.url,
      secure_url: result.secure_url || result.url,
      key: result.key,
      public_id: result.public_id || result.key,
      proxyUrl: result.proxyUrl,
      provider: result.provider,
      size: result.size,
      adjusted: result.adjusted,
      result: result.result,
    });
  } catch (error) {
    console.error('❌ Upload failed on all storage providers:', error);
    const code = error?.name || error?.Code || null;
    return res.status(500).json({
      message: 'File upload failed across storage providers',
      error: error?.message || String(error),
      code,
      providerErrors: error?.providerErrors || [],
    });
  }
};

// Primary upload endpoints (supports both /api/upload/s3 and /api/upload)
router.post('/api/upload/s3', upload.single('file'), handleUploadRequest);
router.post('/api/upload', upload.single('file'), handleUploadRequest);

// Storage status probe endpoint
router.get('/api/upload/status', (req, res) => {
  res.status(200).json(getStorageStatus());
});

// Proxy endpoint to retrieve stored objects (S3 proxy or Cloudinary redirect)
const handleObjectFetch = async (req, res) => {
  try {
    const rawKey = decodeURIComponent(req.params.key || '');
    if (!rawKey) {
      return res.status(400).json({ message: 'Object key is required' });
    }

    // If Cloudinary URL was passed to the proxy, redirect directly to Cloudinary CDN
    if (rawKey.includes('cloudinary.com') || rawKey.includes('res.cloudinary')) {
      const targetUrl = /^https?:\/\//i.test(rawKey) ? rawKey : `https://${rawKey}`;
      return res.redirect(302, targetUrl);
    }

    if (!isS3Configured()) {
      return res.status(500).json({
        message: 'AWS S3 is not configured for object proxying',
      });
    }

    const key = extractS3Key(rawKey);
    const s3Client = getS3Client();

    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      }),
    );

    if (response.ContentType) {
      res.setHeader('Content-Type', response.ContentType);
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    response.Body.pipe(res);
  } catch (error) {
    console.error('Error fetching stored object:', error && error.stack ? error.stack : error);
    res.status(404).json({ message: 'Failed to fetch image or file' });
  }
};

router.get('/api/upload/s3/object/:key(*)', handleObjectFetch);
router.get('/api/upload/object/:key(*)', handleObjectFetch);

module.exports = router;
