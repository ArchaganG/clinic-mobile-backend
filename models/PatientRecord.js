const mongoose = require('mongoose');

const patientRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
    },
    diagnosisNotes: {
      type: String,
      required: [true, 'Diagnosis notes are required'],
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
  },
  { timestamps: true }
);

patientRecordSchema.index({ patientId: 1, createdAt: -1 });
patientRecordSchema.index({ appointmentId: 1 });

module.exports = mongoose.model('PatientRecord', patientRecordSchema);
