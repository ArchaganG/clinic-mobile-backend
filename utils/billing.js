const Payment = require('../models/Payment');
const Doctor = require('../models/Doctor');

/**
 * Ensure a Pending invoice exists for a completed visit.
 * Idempotent — safe to call multiple times.
 */
async function ensureInvoiceForAppointment(appointment) {
  if (!appointment || appointment.status !== 'Completed') {
    return null;
  }

  const existing = await Payment.findOne({ appointmentId: appointment._id });
  if (existing) return existing;

  let doctor = appointment.doctorId;
  if (!doctor?.consultationFee) {
    doctor = await Doctor.findById(appointment.doctorId);
  }

  const fee = Number(doctor?.consultationFee);
  if (Number.isNaN(fee) || fee < 0) {
    return null;
  }

  try {
    return await Payment.create({
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      amount: fee,
      status: 'Pending',
      paidDate: null,
    });
  } catch (error) {
    // Race: another request created the invoice
    if (error.code === 11000) {
      return Payment.findOne({ appointmentId: appointment._id });
    }
    throw error;
  }
}

module.exports = { ensureInvoiceForAppointment };
