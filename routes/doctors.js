const express = require('express');
const {
  listDoctors,
  listSpecializations,
  getDoctor,
  getDoctorDaySlots,
  getMyDoctorProfile,
  createDoctor,
  updateDoctor,
  deleteDoctor,
} = require('../controllers/doctorController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const router = express.Router();

router.use(auth);

router.get('/', listDoctors);
router.get('/specializations', listSpecializations);
router.get('/me', roleCheck('doctor'), getMyDoctorProfile);
router.get('/:id/slots', getDoctorDaySlots);
router.get('/:id', getDoctor);
router.post('/', roleCheck('admin'), createDoctor);
router.put('/:id', roleCheck('admin', 'doctor'), updateDoctor);
router.delete('/:id', roleCheck('admin'), deleteDoctor);

module.exports = router;
