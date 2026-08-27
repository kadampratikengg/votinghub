const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const cloudinary = require('cloudinary').v2;
const { autoAdjustImage } = require('./imageOptimizer');

/**
 * Configure Cloudinary with environment variables
 */
const configureCloudinary = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudinaryUrl = process.env.CLOUDINARY_URL;

  if (cloudinaryUrl) {
    cloudinary.config({ url: cloudinaryUrl });
  } else if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }
};

// Initialize Cloudinary config
configureCloudinary();

/**
 * Check if Cloudinary is configured
 */
const isCloudinaryConfigured = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  return Boolean(cloudinaryUrl || (cloudName && apiKey && apiSecret));
};

/**
 * Check if AWS S3 is configured
 */
const isS3Configured = () => {
  const {
    AWS_REGION,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_BUCKET_NAME,
  } = process.env;
  return Boolean(
    AWS_REGION && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_BUCKET_NAME,
  );
};

/**
 * Get S3 Client instance
 */
const getS3Client = () => {
  const {
    AWS_REGION,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
  } = process.env;

  return new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });
};

/**
 * Get ordered list of storage providers based on configuration and preference.
 * Default preference: ['cloudinary', 's3']
 */
const getProviderOrder = () => {
  const preferenceEnv = (
    process.env.STORAGE_PROVIDER_PREFERENCE || 'cloudinary,s3'
  )
    .toLowerCase()
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p === 'cloudinary' || p === 's3');

  const defaults = ['cloudinary', 's3'];
  const order = [...new Set([...preferenceEnv, ...defaults])];
  return order;
};

/**
 * Upload buffer to Cloudinary
 */
const uploadToCloudinary = (fileBuffer, { folder, originalname, mimetype } = {}) => {
  return new Promise((resolve, reject) => {
    configureCloudinary();

    if (!isCloudinaryConfigured()) {
      return reject(
        new Error(
          'Cloudinary is not configured. Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET.',
        ),
      );
    }

    const safeBaseName = (originalname || 'file')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const publicId = `${Date.now()}_${safeBaseName}`;

    const uploadOptions = {
      folder: folder || 'misc',
      public_id: publicId,
      resource_type: 'auto',
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          return reject(error);
        }
        if (!result) {
          return reject(new Error('Cloudinary upload returned empty result'));
        }

        resolve({
          url: result.secure_url || result.url,
          secure_url: result.secure_url,
          key: result.public_id,
          public_id: result.public_id,
          format: result.format,
          provider: 'cloudinary',
          proxyUrl: result.secure_url || result.url,
          result,
        });
      },
    );

    stream.end(fileBuffer);
  });
};

/**
 * Upload buffer to AWS S3
 */
const uploadToS3 = async (fileBuffer, { folder, originalname, mimetype } = {}) => {
  if (!isS3Configured()) {
    throw new Error(
      'AWS S3 is not configured. Missing AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or AWS_BUCKET_NAME.',
    );
  }

  const s3Client = getS3Client();
  const safeName = (originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${folder || 'misc'}/${Date.now()}_${safeName}`;

  const putCommand = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype || 'application/octet-stream',
  });

  const result = await s3Client.send(putCommand);
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_BUCKET_NAME;
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  const proxyUrl = `/api/upload/s3/object/${encodeURIComponent(key)}`;

  return {
    url,
    key,
    public_id: key,
    proxyUrl,
    provider: 's3',
    result,
  };
};

/**
 * Upload file with automatic fallback between Cloudinary and S3,
 * and automatic image size adjustment (50KB min to 100KB max).
 */
const uploadFile = async ({
  buffer,
  originalname,
  mimetype,
  folder,
}) => {
  if (!buffer) {
    throw new Error('No file buffer provided for upload');
  }

  // Auto-adjust image size to 50KB min - 100KB max
  const optimized = await autoAdjustImage(buffer, { originalname, mimetype });
  const finalBuffer = optimized.buffer;
  const finalMimetype = optimized.mimetype || mimetype;

  const providers = getProviderOrder();
  const errors = [];

  for (const provider of providers) {
    try {
      if (provider === 'cloudinary') {
        if (!isCloudinaryConfigured()) {
          console.warn('⚠️ Cloudinary is not fully configured, skipping to next provider');
          errors.push({ provider: 'cloudinary', error: 'Cloudinary credentials missing' });
          continue;
        }
        console.log(`📤 Attempting upload via Cloudinary (folder: ${folder})...`);
        const result = await uploadToCloudinary(finalBuffer, {
          folder,
          originalname,
          mimetype: finalMimetype,
        });
        console.log(`✅ Upload succeeded via Cloudinary: ${result.url}`);
        return {
          ...result,
          size: finalBuffer.length,
          adjusted: optimized.adjusted,
        };
      }

      if (provider === 's3') {
        if (!isS3Configured()) {
          console.warn('⚠️ AWS S3 is not fully configured, skipping to next provider');
          errors.push({ provider: 's3', error: 'AWS S3 credentials missing' });
          continue;
        }
        console.log(`📤 Attempting upload via AWS S3 (folder: ${folder})...`);
        const result = await uploadToS3(finalBuffer, {
          folder,
          originalname,
          mimetype: finalMimetype,
        });
        console.log(`✅ Upload succeeded via AWS S3: ${result.url}`);
        return {
          ...result,
          size: finalBuffer.length,
          adjusted: optimized.adjusted,
        };
      }
    } catch (err) {
      console.error(`❌ Upload failed on provider [${provider}]:`, err?.message || err);
      errors.push({
        provider,
        error: err?.message || String(err),
        code: err?.name || err?.Code || null,
      });
    }
  }

  const combinedMessage = errors
    .map((e) => `${e.provider}: ${e.error}`)
    .join('; ');
  const finalError = new Error(`All storage providers failed. (${combinedMessage})`);
  finalError.providerErrors = errors;
  throw finalError;
};

/**
 * Extract Cloudinary public_id from URL or string (preserves full folder path)
 */
const extractCloudinaryPublicId = (val) => {
  if (!val || typeof val !== 'string') return null;
  let str = val.trim();

  // If it's a full Cloudinary URL
  if (str.includes('cloudinary.com')) {
    try {
      const parsed = new URL(str);
      const pathname = parsed.pathname;
      const uploadIdx = pathname.indexOf('/upload/');
      if (uploadIdx !== -1) {
        let afterUpload = pathname.substring(uploadIdx + '/upload/'.length);

        // Strip version tag (e.g. v1740649421/) or transformation followed by version tag
        const versionMatch = afterUpload.match(/(?:^|\/)v\d+\/(.+)$/);
        if (versionMatch && versionMatch[1]) {
          afterUpload = versionMatch[1];
        } else {
          // If no explicit version tag (v\d+/), check if first segment is a transformation
          const parts = afterUpload.split('/');
          if (
            parts.length > 1 &&
            (parts[0].includes(',') ||
              parts[0].startsWith('c_') ||
              parts[0].startsWith('w_') ||
              parts[0].startsWith('h_') ||
              parts[0].startsWith('q_') ||
              parts[0].startsWith('f_'))
          ) {
            parts.shift();
            afterUpload = parts.join('/');
          }
        }

        // Strip file extension (e.g. .png, .jpg, .webp, .jpeg)
        return decodeURIComponent(afterUpload.replace(/\.[a-zA-Z0-9]+$/, ''));
      }
    } catch (e) {
      console.warn('Error parsing Cloudinary URL in extractCloudinaryPublicId:', e?.message || e);
    }
  }

  // If it's already a relative path or key (e.g. "organization-images/1740649421_logo.png")
  str = str.replace(/^\/+/, '').split('?')[0];
  return decodeURIComponent(str.replace(/\.[a-zA-Z0-9]+$/, ''));
};

/**
 * Delete file from Cloudinary (tries image, raw, and video resource types)
 */
const deleteFromCloudinary = async (publicIdOrUrl) => {
  configureCloudinary();
  if (!isCloudinaryConfigured()) {
    console.warn('⚠️ Cloudinary is not configured, skipping Cloudinary deletion');
    return { success: false, reason: 'Cloudinary not configured' };
  }

  const publicId = extractCloudinaryPublicId(publicIdOrUrl);
  if (!publicId) {
    return { success: false, reason: 'Could not extract Cloudinary public_id' };
  }

  try {
    // 1. Try destroying as image first (most common)
    let result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: 'image',
    });
    console.log(`🗑️ Cloudinary destroy (image) result for "${publicId}":`, result);

    // 2. If not found, try as raw resource
    if (result && result.result === 'not found') {
      const rawResult = await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        resource_type: 'raw',
      });
      console.log(`🗑️ Cloudinary destroy (raw) result for "${publicId}":`, rawResult);
      if (rawResult && rawResult.result === 'ok') {
        result = rawResult;
      }
    }

    // 3. If still not found and publicId was stripped of extension, try raw with extension if present in original string
    if (result && result.result === 'not found' && typeof publicIdOrUrl === 'string') {
      const cleanOriginal = publicIdOrUrl.replace(/^https?:\/\/[^\/]+\/.*\/upload\/(?:v\d+\/)?/, '').replace(/^\/+/, '');
      if (cleanOriginal && cleanOriginal !== publicId) {
        const altResult = await cloudinary.uploader.destroy(cleanOriginal, {
          invalidate: true,
          resource_type: 'raw',
        });
        if (altResult && altResult.result === 'ok') {
          result = altResult;
        }
      }
    }

    const isOk = result?.result === 'ok';
    return {
      success: isOk,
      provider: 'cloudinary',
      publicId,
      result,
    };
  } catch (err) {
    console.error(`❌ Error deleting from Cloudinary [${publicId}]:`, err.message || err);
    return { success: false, provider: 'cloudinary', error: err.message || String(err) };
  }
};

/**
 * Extract S3 key from URL or string
 */
const extractS3Key = (val) => {
  if (!val || typeof val !== 'string') return null;
  const str = val.trim();
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const parsed = new URL(str);
      const proxyPrefix = '/api/upload/s3/object/';
      if (parsed.pathname.startsWith(proxyPrefix)) {
        return decodeURIComponent(parsed.pathname.slice(proxyPrefix.length));
      }
      return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    } catch (e) {
      return str;
    }
  }
  return str;
};

/**
 * Delete file from AWS S3
 */
const deleteFromS3 = async (keyOrUrl) => {
  if (!isS3Configured()) {
    return { success: false, reason: 'AWS S3 not configured' };
  }

  const key = extractS3Key(keyOrUrl);
  if (!key) {
    return { success: false, reason: 'Could not extract S3 key' };
  }

  try {
    const s3 = getS3Client();
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      }),
    );
    console.log(`🗑️ S3 delete succeeded for key: ${key}`);
    return { success: true, provider: 's3', key };
  } catch (err) {
    console.error(`❌ Error deleting from S3 [${key}]:`, err.message || err);
    return { success: false, provider: 's3', error: err.message || String(err) };
  }
};

/**
 * Delete file from whichever provider it resides in, or attempt both if ambiguous
 */
const deleteFile = async (keyOrUrl) => {
  if (!keyOrUrl) return { success: false, message: 'No key or URL provided' };

  const raw = String(keyOrUrl).trim();
  const isCloudinary = raw.includes('cloudinary.com') || raw.includes('res.cloudinary');
  const isS3 = raw.includes('amazonaws.com') || raw.includes('/api/upload/s3/object/');

  if (isCloudinary) {
    return await deleteFromCloudinary(raw);
  }

  if (isS3) {
    return await deleteFromS3(raw);
  }

  // Ambiguous identifier (could be a key or public_id stored without domain)
  // Attempt both configured services gracefully
  const results = [];

  if (isCloudinaryConfigured()) {
    const res = await deleteFromCloudinary(raw);
    results.push(res);
  }

  if (isS3Configured()) {
    const res = await deleteFromS3(raw);
    results.push(res);
  }

  return {
    success: results.some((r) => r.success),
    results,
  };
};

/**
 * Delete multiple files in parallel
 */
const deleteMultipleFiles = async (keysOrUrls) => {
  if (!Array.isArray(keysOrUrls) || keysOrUrls.length === 0) {
    return [];
  }

  const unique = [...new Set(keysOrUrls.filter(Boolean))];
  const promises = unique.map((item) => deleteFile(item));
  const results = await Promise.allSettled(promises);
  return results.map((r, i) => ({
    target: unique[i],
    status: r.status,
    value: r.status === 'fulfilled' ? r.value : null,
    error: r.status === 'rejected' ? r.reason : null,
  }));
};

/**
 * Get status of configured storage providers
 */
const getStorageStatus = () => {
  return {
    cloudinary: {
      configured: isCloudinaryConfigured(),
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
    },
    s3: {
      configured: isS3Configured(),
      bucket: process.env.AWS_BUCKET_NAME || null,
      region: process.env.AWS_REGION || null,
    },
    providerOrder: getProviderOrder(),
  };
};

module.exports = {
  uploadFile,
  uploadToCloudinary,
  uploadToS3,
  deleteFile,
  deleteMultipleFiles,
  deleteFromCloudinary,
  deleteFromS3,
  extractCloudinaryPublicId,
  extractS3Key,
  isCloudinaryConfigured,
  isS3Configured,
  getS3Client,
  getStorageStatus,
};
