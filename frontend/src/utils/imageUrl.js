const buildProxyUrl = (value, apiUrl) => {
  if (!value || !apiUrl) return null;
  return `${apiUrl.replace(/\/$/, '')}/api/upload/s3/object/${encodeURIComponent(value)}`;
};

export const resolveStoredImageUrl = (image, bucketUrl, apiUrl) => {
  if (!image) return null;

  // If image is a string instead of object
  if (typeof image === 'string') {
    return resolveStoredAssetUrl(image, bucketUrl, apiUrl);
  }

  // If a direct URL is available (e.g. Cloudinary, S3, or external)
  const directUrl = image.secure_url || image.url || image.cdnUrl;
  if (directUrl) {
    if (/cloudinary\.com/i.test(directUrl)) {
      return directUrl;
    }
    if (/amazonaws\.com/i.test(directUrl)) {
      return buildProxyUrl(directUrl, apiUrl) || directUrl;
    }
    if (/^https?:\/\//i.test(directUrl)) {
      return directUrl;
    }
    if (directUrl.startsWith('/')) {
      return apiUrl ? `${apiUrl.replace(/\/$/, '')}${directUrl}` : directUrl;
    }
  }

  const value = image.key || image.public_id || image.uuid || null;
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    if (/cloudinary\.com/i.test(value)) {
      return value;
    }
    if (/amazonaws\.com/i.test(value)) {
      return buildProxyUrl(value, apiUrl) || value;
    }
    return value;
  }

  if (apiUrl) return buildProxyUrl(value, apiUrl);
  if (bucketUrl) return `${bucketUrl.replace(/\/$/, '')}/${value}`;

  return `https://ucarecdn.com/${value}/`;
};

export const resolveStoredAssetUrl = (value, bucketUrl, apiUrl) => {
  if (!value) return null;

  if (typeof value === 'object') {
    return resolveStoredImageUrl(value, bucketUrl, apiUrl);
  }

  const str = String(value).trim();
  if (!str) return null;

  if (/cloudinary\.com/i.test(str)) {
    return str;
  }

  if (/^https?:\/\//i.test(str)) {
    if (/amazonaws\.com/i.test(str)) {
      return buildProxyUrl(str, apiUrl) || str;
    }
    return str;
  }

  if (str.startsWith('/')) {
    return apiUrl ? `${apiUrl.replace(/\/$/, '')}${str}` : str;
  }

  if (apiUrl) return buildProxyUrl(str, apiUrl);
  if (bucketUrl) return `${bucketUrl.replace(/\/$/, '')}/${str}`;

  return `https://ucarecdn.com/${str}/`;
};
