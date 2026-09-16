const express = require('express');
const {
  register,
  login,
  me,
  updateProfile,
  updatePassword,
} = require('../controllers/authController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, me);
router.put('/profile', auth, updateProfile);
router.put('/password', auth, updatePassword);

module.exports = router;
