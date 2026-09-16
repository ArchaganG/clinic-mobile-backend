const path = require('path');
const cloudinary = require('cloudinary').v2;

const trim = (value) => (typeof value === 'string' ? value.trim() : '');

function getCloudinaryEnv() {
  return {
    cloudName: trim(process.env.CLOUDINARY_CLOUD_NAME),
    apiKey: trim(process.env.CLOUDINARY_API_KEY),
    apiSecret: trim(process.env.CLOUDINARY_API_SECRET),
    url: trim(process.env.CLOUDINARY_URL),
  };
}

function isCloudinaryConfigured() {
  const { cloudName, apiKey, apiSecret, url } = getCloudinaryEnv();
  return Boolean((cloudName && apiKey && apiSecret) || url);
}

function ensureCloudinaryConfigured() {
  const { cloudName, apiKey, apiSecret, url } = getCloudinaryEnv();

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    return true;
  }

  if (url) {
    if (!url.toLowerCase().startsWith('cloudinary://')) {
      const err = new Error('CLOUDINARY_URL must start with cloudinary://');
      err.statusCode = 500;
      throw err;
    }
    process.env.CLOUDINARY_URL = url;
    cloudinary.config(true);
    cloudinary.config({ secure: true });
    return true;
  }

  return false;
}

ensureCloudinaryConfigured();

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  ensureCloudinaryConfigured,
};
