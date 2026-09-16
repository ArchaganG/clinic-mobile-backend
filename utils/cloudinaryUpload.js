const { cloudinary, isCloudinaryConfigured, ensureCloudinaryConfigured } = require('../config/cloudinary');

const uploadImageBuffer = (buffer, folder = 'chagan/avatars') =>
  new Promise((resolve, reject) => {
    if (!ensureCloudinaryConfigured()) {
      const err = new Error('Image upload is not configured on the server');
      err.statusCode = 500;
      return reject(err);
    }

    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', overwrite: true },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );

    stream.end(buffer);
  });

const deleteImage = async (publicId) => {
  if (!publicId || !isCloudinaryConfigured()) return;
  try {
    ensureCloudinaryConfigured();
    await cloudinary.uploader.destroy(publicId);
  } catch {
    // Ignore cleanup failures so profile updates still succeed.
  }
};

const applyAvatarUpload = async (user, file) => {
  if (!file?.buffer) return user;

  const result = await uploadImageBuffer(file.buffer);
  if (user.avatarPublicId) {
    await deleteImage(user.avatarPublicId);
  }

  user.avatarUrl = result.secure_url;
  user.avatarPublicId = result.public_id;
  return user;
};

module.exports = {
  uploadImageBuffer,
  deleteImage,
  applyAvatarUpload,
};
