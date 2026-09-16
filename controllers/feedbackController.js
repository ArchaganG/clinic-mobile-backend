const Feedback = require('../models/Feedback');
const Appointment = require('../models/Appointment');

const populateFields = [
  { path: 'patientId', select: 'name email phone' },
  {
    path: 'appointmentId',
    populate: [
      {
        path: 'doctorId',
        populate: { path: 'userId', select: 'name email' },
      },
    ],
  },
];

exports.createFeedback = async (req, res, next) => {
  try {
    const { appointmentId, type, message } = req.body;

    if (!appointmentId || !type || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'appointmentId, type, and message are required',
      });
    }

    if (!['Feedback', 'Complaint'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type must be Feedback or Complaint',
      });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (appointment.patientId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only submit feedback for your own appointments',
      });
    }

    if (!['Approved', 'Completed', 'Cancelled'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Feedback can be submitted for Approved, Completed, or Cancelled appointments',
      });
    }

    const feedback = await Feedback.create({
      patientId: req.user.userId,
      appointmentId: appointment._id,
      type,
      message: message.trim(),
      status: 'Open',
    });

    const populated = await Feedback.findById(feedback._id).populate(populateFields);

    return res.status(201).json({ success: true, data: { feedback: populated } });
  } catch (error) {
    return next(error);
  }
};

exports.getMyFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.find({ patientId: req.user.userId })
      .populate(populateFields)
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: { feedback } });
  } catch (error) {
    return next(error);
  }
};

exports.listFeedback = async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const feedback = await Feedback.find(filter)
      .populate(populateFields)
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: { feedback } });
  } catch (error) {
    return next(error);
  }
};

exports.resolveFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }

    const nextStatus = req.body.status || 'Resolved';
    if (!['Open', 'Resolved'].includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: 'status must be Open or Resolved',
      });
    }

    feedback.status = nextStatus;
    if (req.body.adminNotes !== undefined) {
      feedback.adminNotes = String(req.body.adminNotes).trim();
    }

    await feedback.save();

    const populated = await Feedback.findById(feedback._id).populate(populateFields);

    return res.status(200).json({ success: true, data: { feedback: populated } });
  } catch (error) {
    return next(error);
  }
};
