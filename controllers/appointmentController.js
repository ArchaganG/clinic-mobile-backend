const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const {
  DAY_NAMES,
  ACTIVE_STATUSES,
  startOfDay,
  endOfDay,
  normalizeSlotString,
  parseSlotRange,
  rangesOverlap,
  slotWithinAvailability,
} = require('../utils/slots');
const { ensureInvoiceForAppointment } = require('../utils/billing');

const populateFields = [
  { path: 'patientId', select: 'name email phone role' },
  {
    path: 'doctorId',
    populate: { path: 'userId', select: 'name email phone' },
  },
];

const hasConflict = async (doctorId, date, timeSlot, excludeId = null) => {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const incoming = parseSlotRange(timeSlot);
  if (!incoming) return true;

  const filter = {
    doctorId,
    status: { $in: ACTIVE_STATUSES },
    date: { $gte: dayStart, $lte: dayEnd },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const existing = await Appointment.find(filter).select('timeSlot');
  return existing.some((appt) => {
    const range = parseSlotRange(appt.timeSlot);
    if (!range) return appt.timeSlot === timeSlot;
    return rangesOverlap(incoming, range);
  });
};

exports.createAppointment = async (req, res, next) => {
  try {
    const { doctorId, date, timeSlot, notes } = req.body;

    if (!doctorId || !date || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: 'doctorId, date, and timeSlot are required',
      });
    }

    const appointmentDate = startOfDay(date);
    if (!appointmentDate) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const normalizedSlot = normalizeSlotString(timeSlot);

    if (!slotWithinAvailability(doctor, appointmentDate, normalizedSlot)) {
      return res.status(400).json({
        success: false,
        message: `Selected slot is outside the doctor availability (${DAY_NAMES[appointmentDate.getDay()]} ${normalizedSlot})`,
      });
    }

    if (await hasConflict(doctorId, appointmentDate, normalizedSlot)) {
      return res.status(400).json({
        success: false,
        message:
          'This slot is already booked (Pending or Approved). Cancel it from Appointments, or pick another date/slot.',
      });
    }

    const appointment = await Appointment.create({
      patientId: req.user.userId,
      doctorId,
      date: appointmentDate,
      timeSlot: normalizedSlot,
      notes: notes ? String(notes).trim() : '',
      status: 'Pending',
    });

    const populated = await Appointment.findById(appointment._id).populate(populateFields);

    return res.status(201).json({ success: true, data: { appointment: populated } });
  } catch (error) {
    return next(error);
  }
};

exports.getMyAppointments = async (req, res, next) => {
  try {
    const { status } = req.query;
    let filter = {};

    if (req.user.role === 'patient') {
      filter.patientId = req.user.userId;
    } else if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ userId: req.user.userId });
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor profile not found',
        });
      }
      filter.doctorId = doctor._id;
    } else if (req.user.role === 'admin') {
      filter = {};
    } else {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (status) filter.status = status;

    const appointments = await Appointment.find(filter)
      .populate(populateFields)
      .sort({ date: 1, timeSlot: 1 });

    return res.status(200).json({ success: true, data: { appointments } });
  } catch (error) {
    return next(error);
  }
};

exports.listAppointments = async (req, res, next) => {
  try {
    const { status, date } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (date) {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      if (!dayStart) {
        return res.status(400).json({ success: false, message: 'Invalid date' });
      }
      filter.date = { $gte: dayStart, $lte: dayEnd };
    }

    const appointments = await Appointment.find(filter)
      .populate(populateFields)
      .sort({ date: 1, timeSlot: 1 });

    return res.status(200).json({ success: true, data: { appointments } });
  } catch (error) {
    return next(error);
  }
};

exports.getAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id).populate(populateFields);

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    return res.status(200).json({ success: true, data: { appointment } });
  } catch (error) {
    return next(error);
  }
};

exports.updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled'];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${allowed.join(', ')}`,
      });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const role = req.user.role;
    const isPatientOwner = appointment.patientId.toString() === req.user.userId;

    if (role === 'patient') {
      if (!isPatientOwner) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      if (status !== 'Cancelled') {
        return res.status(403).json({
          success: false,
          message: 'Patients can only cancel appointments',
        });
      }
      if (!['Pending', 'Approved'].includes(appointment.status)) {
        return res.status(400).json({
          success: false,
          message: 'Only pending or approved appointments can be cancelled',
        });
      }
    } else if (role === 'admin') {
      if (!['Approved', 'Rejected', 'Cancelled', 'Completed'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Admin can set Approved, Rejected, Cancelled, or Completed',
        });
      }
    } else if (role === 'doctor') {
      const doctor = await Doctor.findOne({ userId: req.user.userId });
      if (!doctor || doctor._id.toString() !== appointment.doctorId.toString()) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      if (status !== 'Completed') {
        return res.status(403).json({
          success: false,
          message: 'Doctors can only mark appointments as Completed',
        });
      }
      if (appointment.status !== 'Approved') {
        return res.status(400).json({
          success: false,
          message: 'Only approved appointments can be completed',
        });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    appointment.status = status;
    await appointment.save();

    let payment = null;
    if (status === 'Completed') {
      payment = await ensureInvoiceForAppointment(appointment);
    }

    const populated = await Appointment.findById(appointment._id).populate(populateFields);

    return res.status(200).json({
      success: true,
      data: {
        appointment: populated,
        payment: payment || undefined,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.rescheduleAppointment = async (req, res, next) => {
  try {
    const { date, timeSlot } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const isPatientOwner = appointment.patientId.toString() === req.user.userId;
    const isAdmin = req.user.role === 'admin';

    if (!isPatientOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (!['Pending', 'Approved'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only pending or approved appointments can be rescheduled',
      });
    }

    if (!date || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: 'date and timeSlot are required',
      });
    }

    const appointmentDate = startOfDay(date);
    if (!appointmentDate) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    const doctor = await Doctor.findById(appointment.doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const normalizedSlot = normalizeSlotString(timeSlot);

    if (!slotWithinAvailability(doctor, appointmentDate, normalizedSlot)) {
      return res.status(400).json({
        success: false,
        message: 'Selected slot is outside the doctor availability',
      });
    }

    if (
      await hasConflict(appointment.doctorId, appointmentDate, normalizedSlot, appointment._id)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Appointment slot no longer available',
      });
    }

    appointment.date = appointmentDate;
    appointment.timeSlot = normalizedSlot;
    appointment.status = 'Pending';
    await appointment.save();

    const populated = await Appointment.findById(appointment._id).populate(populateFields);

    return res.status(200).json({ success: true, data: { appointment: populated } });
  } catch (error) {
    return next(error);
  }
};
