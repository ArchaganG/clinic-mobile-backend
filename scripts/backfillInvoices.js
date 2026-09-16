/**
 * Fix visit/billing gaps:
 * 1) Approved appointments that already have a prescription → mark Completed
 * 2) Completed appointments without an invoice → create Pending invoice
 *
 * Usage: node scripts/backfillInvoices.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const Payment = require('../models/Payment');
const { ensureInvoiceForAppointment } = require('../utils/billing');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chagan';

async function run() {
  await mongoose.connect(MONGO_URI);

  const rxLinks = await Prescription.find({}).select('appointmentId');
  const rxApptIds = rxLinks.map((p) => p.appointmentId);

  const stuck = await Appointment.find({
    _id: { $in: rxApptIds },
    status: 'Approved',
  });

  let closed = 0;
  for (const appt of stuck) {
    appt.status = 'Completed';
    await appt.save();
    closed += 1;
  }

  const completed = await Appointment.find({ status: 'Completed' });
  let invoices = 0;
  for (const appt of completed) {
    const before = await Payment.findOne({ appointmentId: appt._id });
    const payment = await ensureInvoiceForAppointment(appt);
    if (payment && !before) invoices += 1;
  }

  console.log(
    `Backfill done. Closed prescribed visits: ${closed}. New invoices: ${invoices}. Completed total: ${completed.length}.`
  );
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
