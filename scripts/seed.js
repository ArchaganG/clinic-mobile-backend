/**
 * Wipe DB and seed demo users + doctors.
 * Usage: node scripts/seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const Prescription = require('../models/Prescription');
const PatientRecord = require('../models/PatientRecord');
const Feedback = require('../models/Feedback');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chagan';

const weekdayWindows = (startTime, endTime, days) =>
  days.map((day) => ({ day, startTime, endTime }));

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const MON_WED_FRI = ['Monday', 'Wednesday', 'Friday'];
const TUE_THU = ['Tuesday', 'Thursday'];
const SAT = ['Saturday'];

const doctorsSeed = [
  {
    name: 'Dr. Santhosh Sirithar',
    email: 'santhoshsirithar@gmail.com',
    password: 'San@2003',
    phone: '+91 98765 43210',
    specialization: 'General',
    consultationFee: 500,
    about:
      'Family physician with 8+ years at Chagan Clinic. Focuses on preventive care, chronic disease follow-up, and same-day consultations for common illnesses.',
    availability: [
      ...weekdayWindows('09:00', '13:00', WEEKDAYS),
      ...weekdayWindows('16:00', '18:00', MON_WED_FRI),
    ],
  },
  {
    name: 'Dr. Ananya Krishnan',
    email: 'ananya.krishnan@chagan.clinic',
    password: 'Doctor@123',
    phone: '+91 98400 11223',
    specialization: 'Cardiology',
    consultationFee: 900,
    about:
      'Interventional cardiologist managing hypertension, chest pain, and post-procedure follow-ups. Known for clear explanations and structured heart-health plans.',
    availability: [
      ...weekdayWindows('10:00', '13:00', MON_WED_FRI),
      ...weekdayWindows('15:00', '17:00', TUE_THU),
    ],
  },
  {
    name: 'Dr. Rohan Mehta',
    email: 'rohan.mehta@chagan.clinic',
    password: 'Doctor@123',
    phone: '+91 98200 44556',
    specialization: 'Dentistry',
    consultationFee: 650,
    about:
      'Cosmetic and restorative dentist. Offers cleanings, fillings, root canal consults, and smile makeovers with gentle chair-side care.',
    availability: [
      ...weekdayWindows('09:30', '13:30', WEEKDAYS),
      ...weekdayWindows('10:00', '13:00', SAT),
    ],
  },
  {
    name: 'Dr. Priya Nair',
    email: 'priya.nair@chagan.clinic',
    password: 'Doctor@123',
    phone: '+91 98111 77889',
    specialization: 'Dermatology',
    consultationFee: 750,
    about:
      'Board-certified dermatologist for acne, eczema, pigmentation, and skin allergies. Combines medical treatment with practical skincare routines.',
    availability: [
      ...weekdayWindows('11:00', '14:00', WEEKDAYS),
      ...weekdayWindows('16:00', '18:00', ['Tuesday', 'Thursday', 'Saturday']),
    ],
  },
  {
    name: 'Dr. Vikram Rao',
    email: 'vikram.rao@chagan.clinic',
    password: 'Doctor@123',
    phone: '+91 99001 22334',
    specialization: 'Neurology',
    consultationFee: 1000,
    about:
      'Neurologist specializing in migraine, neuropathy, and seizure disorders. Thorough history-taking with evidence-based medication plans.',
    availability: [
      ...weekdayWindows('09:00', '12:00', TUE_THU),
      ...weekdayWindows('14:00', '17:00', ['Monday', 'Wednesday', 'Friday']),
    ],
  },
  {
    name: 'Dr. Meera Iyer',
    email: 'meera.iyer@chagan.clinic',
    password: 'Doctor@123',
    phone: '+91 98887 66554',
    specialization: 'Pediatrics',
    consultationFee: 600,
    about:
      'Pediatrician for newborns to teens — vaccines, growth checks, fever, and developmental concerns. Warm, parent-friendly consultations.',
    availability: [
      ...weekdayWindows('09:00', '12:30', WEEKDAYS),
      ...weekdayWindows('17:00', '19:00', MON_WED_FRI),
    ],
  },
  {
    name: 'Dr. Arjun Patel',
    email: 'arjun.patel@chagan.clinic',
    password: 'Doctor@123',
    phone: '+91 98770 33445',
    specialization: 'Orthopedics',
    consultationFee: 850,
    about:
      'Orthopedic surgeon for sports injuries, back pain, and joint care. Favors physiotherapy-first approaches before surgical referral.',
    availability: [
      ...weekdayWindows('10:00', '13:00', WEEKDAYS),
      ...weekdayWindows('08:00', '11:00', SAT),
    ],
  },
  {
    name: 'Dr. Kavitha Selvam',
    email: 'kavitha.selvam@chagan.clinic',
    password: 'Doctor@123',
    phone: '+91 97909 55667',
    specialization: 'Gynecology',
    consultationFee: 800,
    about:
      'OB-GYN covering antenatal visits, PCOS, menstrual disorders, and women’s wellness screening with private, respectful care.',
    availability: [
      ...weekdayWindows('09:00', '13:00', MON_WED_FRI),
      ...weekdayWindows('15:00', '18:00', TUE_THU),
    ],
  },
];

async function clearAll() {
  await Promise.all([
    Appointment.deleteMany({}),
    Payment.deleteMany({}),
    Prescription.deleteMany({}),
    PatientRecord.deleteMany({}),
    Feedback.deleteMany({}),
    Doctor.deleteMany({}),
    User.deleteMany({}),
  ]);
  console.log('Cleared users, doctors, appointments, payments, prescriptions, records, feedback');
}

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

  await clearAll();

  const admin = await User.create({
    name: 'Clinic Admin',
    email: 'admin@gmail.com',
    password: 'admin@123',
    phone: '+91 90000 00001',
    role: 'admin',
  });

  const patient = await User.create({
    name: 'Santhosh Sirithar',
    email: 'siritharsanthosh@gmail.com',
    password: 'San@2003',
    phone: '+91 90000 00002',
    role: 'patient',
  });

  const createdDoctors = [];
  for (const d of doctorsSeed) {
    const user = await User.create({
      name: d.name,
      email: d.email,
      password: d.password,
      phone: d.phone,
      role: 'doctor',
    });
    const doctor = await Doctor.create({
      userId: user._id,
      specialization: d.specialization,
      consultationFee: d.consultationFee,
      about: d.about,
      availability: d.availability,
    });
    createdDoctors.push({ user, doctor });
  }

  console.log('\nSeed complete\n');
  console.log('Accounts:');
  console.log(`  Admin   ${admin.email} / admin@123`);
  console.log(`  Patient ${patient.email} / San@2003`);
  createdDoctors.forEach(({ user, doctor }) => {
    const pass =
      user.email === 'santhoshsirithar@gmail.com' ? 'San@2003' : 'Doctor@123';
    console.log(
      `  Doctor  ${user.email} / ${pass}  — ${doctor.specialization} (Rs.${doctor.consultationFee})`
    );
  });

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
