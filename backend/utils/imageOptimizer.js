const sharp = require('sharp');

// Target file size boundaries: 50 KB minimum, 100 KB maximum
const MIN_IMAGE_BYTES = 50 * 1024; // 51,200 bytes (50 KB)
const MAX_IMAGE_BYTES = 100 * 1024; // 102,400 bytes (100 KB)

/**
 * Check if the provided mimetype or filename is an image
 */
const isImageFile = (mimetype, filename) => {
  if (mimetype && typeof mimetype === 'string' && mimetype.toLowerCase().startsWith('image/')) {
    return true;
  }
  if (filename && typeof filename === 'string') {
    return /\.(jpg|jpeg|png|webp|gif|bmp|tiff|avif|heic|heif)$/i.test(filename);
  }
  return false;
};

/**
 * Automatically adjust image size to be between 50 KB (min) and 100 KB (max).
 * If the image is larger than 100KB, it compresses and resizes it to fit <= 100KB.
 * If the image is smaller than 50KB, it optimizes quality and dimensions to hit 50-100KB without distortion.
 *
 * @param {Buffer} buffer - Original image buffer
 * @param {Object} options - { originalname, mimetype }
 * @returns {Promise<{ buffer: Buffer, mimetype: string, size: number, adjusted: boolean }>}
 */
const autoAdjustImage = async (
  buffer,
  { originalname = '', mimetype = 'image/jpeg' } = {},
) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { buffer, mimetype, size: buffer ? buffer.length : 0, adjusted: false };
  }

  if (!isImageFile(mimetype, originalname)) {
    // Non-image file (e.g. PDF or spreadsheet), pass through untouched
    return { buffer, mimetype, size: buffer.length, adjusted: false };
  }

  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) {
      return { buffer, mimetype, size: buffer.length, adjusted: false };
    }

    const hasAlpha = Boolean(meta.hasAlpha && meta.format === 'png');
    // If PNG with transparency, use WebP to preserve alpha with high compression; otherwise mozjpeg
    const format = hasAlpha ? 'webp' : 'jpeg';
    const outputMime = hasAlpha ? 'image/webp' : 'image/jpeg';

    let maxDim = Math.min(1800, Math.max(meta.width, meta.height));
    let bestMatch = null;
    let closestUnder = null;

    // Dimension scaling factors from highest resolution to smaller bounds
    const dimFactors = [1.0, 0.85, 0.7, 0.55, 0.4, 0.3];

    for (const factor of dimFactors) {
      const currentDim = Math.max(250, Math.round(maxDim * factor));
      let minQ = 20;
      let maxQ = 96;

      // Binary search over quality levels for the current dimension
      for (let qStep = 0; qStep < 7; qStep++) {
        const quality = Math.round((minQ + maxQ) / 2);
        let pipeline = sharp(buffer)
          .rotate()
          .resize(currentDim, currentDim, {
            fit: 'inside',
            withoutEnlargement: true,
          });

        if (format === 'webp') {
          pipeline = pipeline.webp({ quality, effort: 4 });
        } else {
          pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        }

        const out = await pipeline.toBuffer();
        const size = out.length;

        // Exact target match: between 50KB and 100KB
        if (size >= MIN_IMAGE_BYTES && size <= MAX_IMAGE_BYTES) {
          bestMatch = {
            buffer: out,
            mimetype: outputMime,
            size,
            adjusted: true,
          };
          break;
        }

        // If under 100KB, record as closest candidate under upper bound
        if (size <= MAX_IMAGE_BYTES) {
          if (!closestUnder || size > closestUnder.size) {
            closestUnder = {
              buffer: out,
              mimetype: outputMime,
              size,
              adjusted: true,
            };
          }
          // Try higher quality to get closer to 50KB - 100KB
          minQ = quality + 1;
        } else {
          // Exceeds 100KB, try lower quality
          maxQ = quality - 1;
        }

        if (minQ > maxQ) break;
      }

      if (bestMatch) break;
    }

    const finalResult =
      bestMatch ||
      closestUnder || {
        buffer,
        mimetype: outputMime,
        size: buffer.length,
        adjusted: false,
      };

    console.log(
      `🖼️ Auto adjusted image (${originalname || 'image'}): ${(buffer.length / 1024).toFixed(1)} KB ➔ ${(finalResult.size / 1024).toFixed(1)} KB (${finalResult.mimetype})`,
    );

    return finalResult;
  } catch (err) {
    console.warn(
      '⚠️ Auto image adjustment warning (proceeding with original):',
      err?.message || err,
    );
    return { buffer, mimetype, size: buffer.length, adjusted: false };
  }
};

module.exports = {
  autoAdjustImage,
  isImageFile,
  MIN_IMAGE_BYTES,
  MAX_IMAGE_BYTES,
};
