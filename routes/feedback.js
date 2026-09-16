const express = require('express');
const {
  createFeedback,
  getMyFeedback,
  listFeedback,
  resolveFeedback,
} = require('../controllers/feedbackController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const router = express.Router();

router.use(auth);

router.post('/', roleCheck('patient'), createFeedback);
router.get('/mine', roleCheck('patient'), getMyFeedback);
router.get('/', roleCheck('admin'), listFeedback);
router.put('/:id', roleCheck('admin'), resolveFeedback);

module.exports = router;
