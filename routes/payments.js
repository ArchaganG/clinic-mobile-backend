const express = require('express');
const {
  createPayment,
  getMyPayments,
  listPayments,
  markPaymentPaid,
  getBillableAppointments,
} = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const router = express.Router();

router.use(auth);

router.get('/mine', roleCheck('patient'), getMyPayments);
router.get('/billable-appointments', roleCheck('admin'), getBillableAppointments);
router.get('/', roleCheck('admin'), listPayments);
router.post('/', roleCheck('admin'), createPayment);
router.put('/:id', roleCheck('admin'), markPaymentPaid);

module.exports = router;
