const express = require('express');
const {
  createAppointment,
  getMyAppointments,
  listAppointments,
  getAppointment,
  updateAppointmentStatus,
  rescheduleAppointment,
} = require('../controllers/appointmentController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const router = express.Router();

router.use(auth);

router.post('/', roleCheck('patient'), createAppointment);
router.get('/mine', roleCheck('patient', 'doctor', 'admin'), getMyAppointments);
router.get('/', roleCheck('admin'), listAppointments);
router.get('/:id', getAppointment);
router.put('/:id/status', roleCheck('patient', 'doctor', 'admin'), updateAppointmentStatus);
router.put('/:id/reschedule', roleCheck('patient', 'admin'), rescheduleAppointment);

module.exports = router;
