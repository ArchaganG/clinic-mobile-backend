const express = require('express');
const {
  createPrescription,
  getMyPrescriptions,
  listPrescriptions,
  getPrescription,
  updatePrescription,
  getEligibleAppointments,
} = require('../controllers/prescriptionController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const router = express.Router();

router.use(auth);

router.get('/mine', roleCheck('patient'), getMyPrescriptions);
router.get('/eligible-appointments', roleCheck('doctor'), getEligibleAppointments);
router.get('/', roleCheck('doctor', 'admin'), listPrescriptions);
router.post('/', roleCheck('doctor'), createPrescription);
router.get('/:id', roleCheck('patient', 'doctor', 'admin'), getPrescription);
router.put('/:id', roleCheck('doctor'), updatePrescription);

module.exports = router;
