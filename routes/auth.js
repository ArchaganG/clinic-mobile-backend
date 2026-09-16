const express = require('express');
const {
  register,
  login,
  me,
  updateProfile,
  updatePassword,
} = require('../controllers/authController');
const auth = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');

const router = express.Router();

router.post('/register', uploadAvatar, register);
router.post('/login', login);
router.get('/me', auth, me);
router.put('/profile', auth, uploadAvatar, updateProfile);
router.put('/password', auth, updatePassword);

module.exports = router;
