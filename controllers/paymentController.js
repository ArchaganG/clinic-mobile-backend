const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');

const populateFields = [
  { path: 'patientId', select: 'name email phone' },
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

exports.createPayment = async (req, res, next) => {
  try {
    const { appointmentId, amount } = req.body;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: 'appointmentId is required',
      });
    }

    const appointment = await Appointment.findById(appointmentId).populate('doctorId');
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (!['Approved', 'Completed'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Invoice can only be generated for Approved or Completed appointments',
      });
    }

    const existing = await Payment.findOne({ appointmentId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Invoice already exists for this appointment',
      });
    }

    let doctor = appointment.doctorId;
    if (!doctor?.consultationFee && appointment.doctorId) {
      doctor = await Doctor.findById(appointment.doctorId);
    }

    const fee =
      amount !== undefined && amount !== null && amount !== ''
        ? Number(amount)
        : Number(doctor?.consultationFee);

    if (Number.isNaN(fee) || fee < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount / consultation fee',
      });
    }

    const payment = await Payment.create({
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      amount: fee,
      status: 'Pending',
      paidDate: null,
    });

    const populated = await Payment.findById(payment._id).populate(populateFields);

    return res.status(201).json({ success: true, data: { payment: populated } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Invoice already exists for this appointment',
      });
    }
    return next(error);
  }
};

exports.getMyPayments = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { patientId: req.user.userId };
    if (status) filter.status = status;

    const payments = await Payment.find(filter)
      .populate(populateFields)
      .sort({ createdAt: -1 });

    const outstanding = payments
      .filter((p) => p.status === 'Pending')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        outstanding,
        payments,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.listPayments = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const payments = await Payment.find(filter)
      .populate(populateFields)
      .sort({ createdAt: -1 });

    const outstanding = payments
      .filter((p) => p.status === 'Pending')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        outstanding,
        payments,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.markPaymentPaid = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (payment.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Payment is already marked as Paid',
      });
    }

    payment.status = 'Paid';
    payment.paidDate = new Date();
    await payment.save();

    const populated = await Payment.findById(payment._id).populate(populateFields);

    return res.status(200).json({ success: true, data: { payment: populated } });
  } catch (error) {
    return next(error);
  }
};

exports.getBillableAppointments = async (req, res, next) => {
  try {
    const invoiced = await Payment.find({}).select('appointmentId');
    const invoicedIds = invoiced.map((p) => p.appointmentId);

    const appointments = await Appointment.find({
      status: 'Completed',
      _id: { $nin: invoicedIds },
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
