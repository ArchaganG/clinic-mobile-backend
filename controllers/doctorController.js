const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const {
  ACTIVE_STATUSES,
  startOfDay,
  endOfDay,
  buildDaySlots,
} = require('../utils/slots');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const populateUser = {
  path: 'userId',
  select: 'name email phone role',
};

const sanitizeAvailability = (availability = []) => {
  if (!Array.isArray(availability)) {
    return [];
  }

  return availability
    .filter((slot) => slot && slot.day && slot.startTime && slot.endTime)
    .map((slot) => ({
      day: slot.day,
      startTime: String(slot.startTime).trim(),
      endTime: String(slot.endTime).trim(),
    }))
    .filter((slot) => DAYS.includes(slot.day));
};

exports.listDoctors = async (req, res, next) => {
  try {
    const { specialization, search } = req.query;
    const filter = {};

    if (specialization) {
      filter.specialization = new RegExp(specialization, 'i');
    }

    let doctors = await Doctor.find(filter).populate(populateUser).sort({ createdAt: -1 });

    if (search) {
      const q = String(search).toLowerCase();
      doctors = doctors.filter((doc) => {
        const name = doc.userId?.name?.toLowerCase() || '';
        const email = doc.userId?.email?.toLowerCase() || '';
        const spec = doc.specialization?.toLowerCase() || '';
        return name.includes(q) || email.includes(q) || spec.includes(q);
      });
    }

    return res.status(200).json({ success: true, data: { doctors } });
  } catch (error) {
    return next(error);
  }
};

exports.listSpecializations = async (req, res, next) => {
  try {
    const values = await Doctor.distinct('specialization');
    const specializations = values
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return res.status(200).json({ success: true, data: { specializations } });
  } catch (error) {
    return next(error);
  }
};

exports.getDoctorDaySlots = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'date query is required (YYYY-MM-DD)',
      });
    }

    const day = startOfDay(date);
    if (!day) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    const doctor = await Doctor.findById(req.params.id).populate(populateUser);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const booked = await Appointment.find({
      doctorId: doctor._id,
      status: { $in: ACTIVE_STATUSES },
      date: { $gte: day, $lte: endOfDay(day) },
    }).select('timeSlot status patientId');

    const excludeId = req.query.excludeAppointmentId || null;
    const { dayName, windows, slots } = buildDaySlots(doctor, day, booked, excludeId);

    return res.status(200).json({
      success: true,
      data: {
        doctorId: doctor._id,
        date: date.trim().slice(0, 10),
        dayName,
        windows,
        slots,
        bookedCount: booked.length,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id).populate(populateUser);

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    return res.status(200).json({ success: true, data: { doctor } });
  } catch (error) {
    return next(error);
  }
};

exports.getMyDoctorProfile = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user.userId }).populate(populateUser);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found. Ask an admin to create your profile.',
      });
    }

    return res.status(200).json({ success: true, data: { doctor } });
  } catch (error) {
    return next(error);
  }
};

exports.createDoctor = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      specialization,
      consultationFee,
      availability,
      about,
      userId,
    } = req.body;

    let user;

    if (userId) {
      user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      if (user.role !== 'doctor') {
        user.role = 'doctor';
        await user.save();
      }
    } else {
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required to create a doctor',
        });
      }

      const existing = await User.findOne({ email: email.toLowerCase().trim() });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Email is already registered',
        });
      }

      user = await User.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        phone: phone ? String(phone).trim() : '',
        role: 'doctor',
      });
    }

    const existingDoctor = await Doctor.findOne({ userId: user._id });
    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        message: 'Doctor profile already exists for this user',
      });
    }

    if (!specialization || consultationFee === undefined || consultationFee === null) {
      return res.status(400).json({
        success: false,
        message: 'Specialization and consultationFee are required',
      });
    }

    const fee = Number(consultationFee);
    if (Number.isNaN(fee) || fee < 0) {
      return res.status(400).json({
        success: false,
        message: 'consultationFee must be a valid non-negative number',
      });
    }

    const doctor = await Doctor.create({
      userId: user._id,
      specialization: specialization.trim(),
      consultationFee: fee,
      availability: sanitizeAvailability(availability),
      about: about ? String(about).trim() : '',
    });

    const populated = await Doctor.findById(doctor._id).populate(populateUser);

    return res.status(201).json({ success: true, data: { doctor: populated } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Doctor profile already exists for this user',
      });
    }
    return next(error);
  }
};

exports.updateDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = doctor.userId.toString() === req.user.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: you can only update your own doctor profile',
      });
    }

    const { specialization, consultationFee, availability, about, name, phone } = req.body;

    if (isAdmin) {
      if (specialization !== undefined) doctor.specialization = String(specialization).trim();
      if (consultationFee !== undefined) {
        const fee = Number(consultationFee);
        if (Number.isNaN(fee) || fee < 0) {
          return res.status(400).json({
            success: false,
            message: 'consultationFee must be a valid non-negative number',
          });
        }
        doctor.consultationFee = fee;
      }
      if (about !== undefined) doctor.about = String(about).trim();
    }

    if (availability !== undefined) {
      doctor.availability = sanitizeAvailability(availability);
    }

    if (!isAdmin && about !== undefined) {
      doctor.about = String(about).trim();
    }

    await doctor.save();

    if ((name !== undefined || phone !== undefined) && (isAdmin || isOwner)) {
      const user = await User.findById(doctor.userId);
      if (user) {
        if (name !== undefined) user.name = String(name).trim();
        if (phone !== undefined) user.phone = String(phone).trim();
        await user.save();
      }
    }

    const populated = await Doctor.findById(doctor._id).populate(populateUser);

    return res.status(200).json({ success: true, data: { doctor: populated } });
  } catch (error) {
    return next(error);
  }
};

exports.deleteDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    await doctor.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Doctor profile removed',
      data: { id: req.params.id },
    });
  } catch (error) {
    return next(error);
  }
};
