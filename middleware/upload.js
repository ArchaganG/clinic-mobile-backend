const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.mimetype);
    if (!allowed) {
      const err = new Error('Only image files are allowed (jpeg, png, webp, heic)');
      err.statusCode = 400;
      return cb(err);
    }
    return cb(null, true);
  },
});

const uploadAvatar = (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (!err) return next();
    err.statusCode = err.statusCode || 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      err.message = 'Image must be 5MB or smaller';
    }
    return next(err);
  });
};

module.exports = { uploadAvatar };
