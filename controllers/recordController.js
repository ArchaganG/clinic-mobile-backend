const PatientRecord = require('../models/PatientRecord');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');

const populateFields = [
  { path: 'patientId', select: 'name email phone' },
  {
    path: 'createdBy',
    populate: { path: 'userId', select: 'name email' },
  },
  {
    path: 'appointmentId',
    select: 'date timeSlot status doctorId',
  },
];

const getDoctorProfile = async (userId) => Doctor.findOne({ userId });

exports.createRecord = async (req, res, next) => {
  try {
    const { appointmentId, diagnosisNotes, patientId } = req.body;

    if (!appointmentId || !diagnosisNotes?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'appointmentId and diagnosisNotes are required',
      });
    }

    const doctor = await getDoctorProfile(req.user.userId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (appointment.doctorId.toString() !== doctor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the doctor for this appointment can add records',
      });
    }

    if (!['Approved', 'Completed'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Records can only be added for Approved or Completed appointments',
      });
    }

    if (patientId && patientId !== appointment.patientId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'patientId does not match the appointment patient',
      });
    }

    const record = await PatientRecord.create({
      patientId: appointment.patientId,
      appointmentId: appointment._id,
      diagnosisNotes: diagnosisNotes.trim(),
      createdBy: doctor._id,
    });

    const populated = await PatientRecord.findById(record._id).populate(populateFields);

    return res.status(201).json({ success: true, data: { record: populated } });
  } catch (error) {
    return next(error);
  }
};

exports.getMyRecords = async (req, res, next) => {
  try {
    const records = await PatientRecord.find({ patientId: req.user.userId })
      .populate(populateFields)
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: { records } });
  } catch (error) {
    return next(error);
  }
};

exports.getPatientRecords = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    if (req.user.role === 'patient' && req.user.userId !== patientId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const records = await PatientRecord.find({ patientId })
      .populate(populateFields)
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: { records } });
  } catch (error) {
    return next(error);
  }
};

exports.updateRecord = async (req, res, next) => {
  try {
    const record = await PatientRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    const doctor = await getDoctorProfile(req.user.userId);
    if (!doctor || record.createdBy.toString() !== doctor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the creating doctor can update this record',
      });
    }

    if (!req.body.diagnosisNotes?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'diagnosisNotes is required',
      });
    }

    record.diagnosisNotes = req.body.diagnosisNotes.trim();
    await record.save();

    const populated = await PatientRecord.findById(record._id).populate(populateFields);

    return res.status(200).json({ success: true, data: { record: populated } });
  } catch (error) {
    return next(error);
  }
};

exports.getDoctorPatients = async (req, res, next) => {
  try {
    const doctor = await getDoctorProfile(req.user.userId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    const appointments = await Appointment.find({
      doctorId: doctor._id,
      status: { $in: ['Approved', 'Completed'] },
    })
      .populate({ path: 'patientId', select: 'name email phone' })
      .sort({ date: -1 });

    const byPatient = new Map();
    appointments.forEach((appt) => {
      const id = appt.patientId?._id?.toString();
      if (!id) return;
      if (!byPatient.has(id)) {
        byPatient.set(id, {
          patient: appt.patientId,
          latestAppointment: appt,
          visitCount: 1,
        });
      } else {
        byPatient.get(id).visitCount += 1;
      }
    });

    return res.status(200).json({
      success: true,
      data: { patients: Array.from(byPatient.values()) },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getEligibleAppointments = async (req, res, next) => {
  try {
    const doctor = await getDoctorProfile(req.user.userId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    const appointments = await Appointment.find({
      doctorId: doctor._id,
      status: { $in: ['Approved', 'Completed'] },
    })
      .populate({ path: 'patientId', select: 'name email phone' })
      .sort({ date: -1 });

    return res.status(200).json({ success: true, data: { appointments } });
  } catch (error) {
    return next(error);
  }
};
