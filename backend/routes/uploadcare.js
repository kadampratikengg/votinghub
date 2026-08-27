// routes/uploadcare.js (Unified file & image deletion route for Cloudinary and S3)
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { deleteFile } = require('../utils/storage');

// Delete an uploaded object from Cloudinary or S3. Accepts key, public_id, or full URL.
router.delete('/delete/:keyOrUrl(*)', authenticateToken, async (req, res) => {
  const { keyOrUrl } = req.params;

  if (!keyOrUrl) {
    return res.status(400).json({ message: 'Missing key or URL parameter' });
  }

  const decodedKeyOrUrl = decodeURIComponent(keyOrUrl);

  try {
    const result = await deleteFile(decodedKeyOrUrl);
    console.log(`🗑️ Deletion result for "${decodedKeyOrUrl}":`, result);
    return res.status(200).json({
      message: 'Image/file deletion processed successfully',
      result,
    });
  } catch (error) {
    console.error('❌ Error deleting file/image:', error?.message || error);
    return res.status(500).json({
      message: 'Failed to delete file/image',
      error: error?.message || String(error),
    });
  }
});

module.exports = router;
