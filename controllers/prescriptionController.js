const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { ensureInvoiceForAppointment } = require('../utils/billing');

const populateFields = [
  { path: 'patientId', select: 'name email phone' },
  {
    path: 'issuedBy',
    populate: { path: 'userId', select: 'name email' },
  },
  {
    path: 'appointmentId',
    populate: [
      { path: 'patientId', select: 'name email phone' },
      {
        path: 'doctorId',
        populate: { path: 'userId', select: 'name email' },
      },
    ],
  },
];

const sanitizeMedications = (medications = []) => {
  if (!Array.isArray(medications)) return [];
  return medications
    .map((med) => ({
      name: String(med?.name || '').trim(),
      dosage: String(med?.dosage || '').trim(),
      duration: String(med?.duration || '').trim(),
    }))
    .filter((med) => med.name && med.dosage && med.duration);
};

const getDoctorProfile = async (userId) => Doctor.findOne({ userId });

exports.createPrescription = async (req, res, next) => {
  try {
    const { appointmentId, medications, notes } = req.body;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: 'appointmentId is required',
      });
    }

    const meds = sanitizeMedications(medications);
    if (!meds.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one medication with name, dosage, and duration is required',
      });
    }

    const doctor = await getDoctorProfile(req.user.userId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (appointment.doctorId.toString() !== doctor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the doctor for this appointment can write the prescription',
      });
    }

    if (!['Approved', 'Completed'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Prescription can only be created for Approved or Completed appointments',
      });
    }

    const existing = await Prescription.findOne({ appointmentId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Prescription already exists for this appointment',
      });
    }

    const prescription = await Prescription.create({
      patientId: appointment.patientId,
      appointmentId: appointment._id,
      medications: meds,
      issuedBy: doctor._id,
      notes: notes ? String(notes).trim() : '',
    });

    // Writing a prescription closes the clinical visit and opens billing
    let payment = null;
    if (appointment.status === 'Approved') {
      appointment.status = 'Completed';
      await appointment.save();
    }
    if (appointment.status === 'Completed') {
      payment = await ensureInvoiceForAppointment(appointment);
    }

    const populated = await Prescription.findById(prescription._id).populate(populateFields);

    return res.status(201).json({
      success: true,
      data: {
        prescription: populated,
        appointmentStatus: appointment.status,
        payment: payment || undefined,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Prescription already exists for this appointment',
      });
    }
    return next(error);
  }
};

exports.getMyPrescriptions = async (req, res, next) => {
  try {
    const prescriptions = await Prescription.find({ patientId: req.user.userId })
      .populate(populateFields)
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: { prescriptions } });
  } catch (error) {
    return next(error);
  }
};

exports.listPrescriptions = async (req, res, next) => {
  try {
    let filter = {};

    if (req.user.role === 'doctor') {
      const doctor = await getDoctorProfile(req.user.userId);
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor profile not found',
        });
      }
      filter.issuedBy = doctor._id;
    }

    const prescriptions = await Prescription.find(filter)
      .populate(populateFields)
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: { prescriptions } });
  } catch (error) {
    return next(error);
  }
};

exports.getPrescription = async (req, res, next) => {
  try {
    const prescription = await Prescription.findById(req.params.id).populate(populateFields);

    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    if (req.user.role === 'patient') {
      if (prescription.patientId._id.toString() !== req.user.userId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    } else if (req.user.role === 'doctor') {
      const doctor = await getDoctorProfile(req.user.userId);
      if (!doctor || prescription.issuedBy._id.toString() !== doctor._id.toString()) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    }

    return res.status(200).json({ success: true, data: { prescription } });
  } catch (error) {
    return next(error);
  }
};

exports.updatePrescription = async (req, res, next) => {
  try {
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    const doctor = await getDoctorProfile(req.user.userId);
    if (!doctor || prescription.issuedBy.toString() !== doctor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the issuing doctor can update this prescription',
      });
    }

    if (req.body.medications !== undefined) {
      const meds = sanitizeMedications(req.body.medications);
      if (!meds.length) {
        return res.status(400).json({
          success: false,
          message: 'At least one medication with name, dosage, and duration is required',
        });
      }
      prescription.medications = meds;
    }

    if (req.body.notes !== undefined) {
      prescription.notes = String(req.body.notes).trim();
    }

    await prescription.save();

    const populated = await Prescription.findById(prescription._id).populate(populateFields);

    return res.status(200).json({ success: true, data: { prescription: populated } });
  } catch (error) {
    return next(error);
  }
};

exports.getEligibleAppointments = async (req, res, next) => {
  try {
    const doctor = await getDoctorProfile(req.user.userId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    const existing = await Prescription.find({ issuedBy: doctor._id }).select('appointmentId');
    const usedIds = existing.map((p) => p.appointmentId);

    const appointments = await Appointment.find({
      doctorId: doctor._id,
      status: { $in: ['Approved', 'Completed'] },
      _id: { $nin: usedIds },
    })
      .populate([
        { path: 'patientId', select: 'name email phone' },
        {
          path: 'doctorId',
          populate: { path: 'userId', select: 'name email' },
        },
      ])
      .sort({ date: -1 });

    return res.status(200).json({ success: true, data: { appointments } });
  } catch (error) {
    return next(error);
  }
};
