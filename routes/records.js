const express = require('express');
const {
  createRecord,
  getMyRecords,
  getPatientRecords,
  updateRecord,
  getDoctorPatients,
  getEligibleAppointments,
} = require('../controllers/recordController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const router = express.Router();

router.use(auth);

router.get('/mine', roleCheck('patient'), getMyRecords);
router.get('/patients', roleCheck('doctor'), getDoctorPatients);
router.get('/eligible-appointments', roleCheck('doctor'), getEligibleAppointments);
router.post('/', roleCheck('doctor'), createRecord);
router.get('/:patientId', roleCheck('doctor', 'admin', 'patient'), getPatientRecords);
router.put('/:id', roleCheck('doctor'), updateRecord);

module.exports = router;
