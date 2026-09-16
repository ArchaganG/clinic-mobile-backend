# Chagan Backend

Node.js + Express API for the Smart Clinic Appointment Management System.

Stack: Express 5, MongoDB/Mongoose, JWT auth, Multer + Cloudinary for profile photos.

## Setup

```bash
npm install
cp .env.example .env
# Fill MONGO_URI, JWT_SECRET, and Cloudinary keys
npm run dev
```

Health check: `GET http://localhost:5050/api/health`

Port `5000` is often used by macOS AirPlay, so this project defaults to **5050**.

### Environment

Copy `.env.example` and set:

| Variable | Required | Purpose |
|----------|----------|---------|
| `PORT` | No | Defaults to `5050` |
| `MONGO_URI` | Yes | Local MongoDB or Atlas connection string |
| `JWT_SECRET` | Yes | Signs access tokens (7-day expiry) |
| `CLOUDINARY_CLOUD_NAME` | For photos | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | For photos | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | For photos | Cloudinary API secret |
| `CLOUDINARY_URL` | Optional | Alternative to the three Cloudinary vars |

On startup the server logs whether Cloudinary is configured. Without Cloudinary keys, auth still works but photo upload returns `Image upload is not configured on the server`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon |
| `npm start` | Start with node |
| `npm run seed` | Wipe clinic data and insert demo users + doctors |
| `npm run backfill:invoices` | Create missing invoices for completed appointments |

`npm run seed` **deletes** users, doctors, appointments, payments, prescriptions, records, and feedback, then creates demo accounts.

### Demo accounts (after seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@gmail.com` | `admin@123` |
| Patient | `siritharsanthosh@gmail.com` | `San@2003` |
| Doctor (General) | `santhoshsirithar@gmail.com` | `San@2003` |
| Other doctors | `*.@chagan.clinic` | `Doctor@123` |

## Auth

Send `Authorization: Bearer <token>` on protected routes.

Register and profile update accept **JSON** or **multipart/form-data**. For a photo, send field name `avatar` (jpeg, png, webp, or heic, max 5MB). The file is uploaded to Cloudinary folder `chagan/avatars`. The public URL is stored on the user as `avatarUrl`.

| Method | Path | Access | Body |
|--------|------|--------|------|
| POST | `/api/auth/register` | Public | `name`, `email`, `password`, `phone?`, `role?`, `avatar?` |
| POST | `/api/auth/login` | Public | `email`, `password` |
| GET | `/api/auth/me` | JWT | — |
| PUT | `/api/auth/profile` | JWT | `name?`, `email?`, `phone?`, `avatar?` |
| PUT | `/api/auth/password` | JWT | `currentPassword`, `newPassword` |

Roles: `patient` | `doctor` | `admin`. Register defaults to `patient`.

User payload includes `id`, `name`, `email`, `role`, `phone`, `avatarUrl`.

## Doctors

Availability is a list of weekday windows, not one-off calendar dates:

```json
{ "day": "Monday", "startTime": "09:00", "endTime": "12:00" }
```

The mobile app uses a calendar to pick a date, then stores that date’s weekday plus start/end time. Booking expands each window into **30-minute** slots.

Admin create/update also accept multipart `avatar` (saved on the doctor’s user).

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/doctors` | JWT (`?search=` `&specialization=`) |
| GET | `/api/doctors/specializations` | JWT |
| GET | `/api/doctors/me` | Doctor |
| GET | `/api/doctors/:id/slots` | JWT — `?date=YYYY-MM-DD&excludeAppointmentId=` |
| GET | `/api/doctors/:id` | JWT |
| POST | `/api/doctors` | Admin |
| PUT | `/api/doctors/:id` | Admin or owning doctor |
| DELETE | `/api/doctors/:id` | Admin |

Create body (admin): `name`, `email`, `password`, `phone?`, `specialization`, `consultationFee`, `availability?`, `about?`, `avatar?`

Slots for a date mark times as unavailable if they are already booked **or already in the past**.

## Appointments

Book / reschedule body: `{ doctorId?, date, timeSlot, notes? }`

- `date` is `YYYY-MM-DD`
- `timeSlot` is `09:00-09:30` (any 30-minute range fully inside an availability window)
- Conflicts use time overlap, not exact string match
- **Past dates and already-started hours are rejected** on create and reschedule

| Method | Path | Access |
|--------|------|--------|
| POST | `/api/appointments` | Patient |
| GET | `/api/appointments/mine` | Patient / Doctor / Admin |
| GET | `/api/appointments` | Admin (`?status=` `&date=`) |
| GET | `/api/appointments/:id` | JWT |
| PUT | `/api/appointments/:id/status` | Patient: `Cancelled` · Doctor: `Completed` · Admin: `Approved`, `Rejected`, `Cancelled`, `Completed` |
| PUT | `/api/appointments/:id/reschedule` | Patient / Admin |

Statuses: `Pending` → `Approved` / `Rejected` / `Cancelled` → `Completed`. Completing an appointment creates a billing invoice if one does not exist. Reschedule is allowed only while status is `Pending` or `Approved`, and it returns the booking to `Pending`.

## Payments

Manual clinic billing (no payment gateway). Amount defaults to the doctor’s consultation fee.

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/payments/mine` | Patient |
| GET | `/api/payments` | Admin (`?status=Pending\|Paid`) |
| GET | `/api/payments/billable-appointments` | Admin |
| POST | `/api/payments` | Admin — `{ appointmentId, amount? }` |
| PUT | `/api/payments/:id` | Admin — mark as Paid |

## Prescriptions

| Method | Path | Access |
|--------|------|--------|
| POST | `/api/prescriptions` | Doctor — `{ appointmentId, medications[{name,dosage,duration}], notes? }` |
| GET | `/api/prescriptions/mine` | Patient |
| GET | `/api/prescriptions` | Doctor (own) / Admin (all) |
| GET | `/api/prescriptions/eligible-appointments` | Doctor |
| GET | `/api/prescriptions/:id` | Patient / Doctor / Admin |
| PUT | `/api/prescriptions/:id` | Issuing doctor |

## Patient records

| Method | Path | Access |
|--------|------|--------|
| POST | `/api/records` | Doctor — `{ appointmentId, diagnosisNotes }` |
| GET | `/api/records/mine` | Patient |
| GET | `/api/records/patients` | Doctor |
| GET | `/api/records/eligible-appointments` | Doctor |
| GET | `/api/records/:patientId` | Doctor / Admin / owning patient |
| PUT | `/api/records/:id` | Creating doctor |

## Feedback

| Method | Path | Access |
|--------|------|--------|
| POST | `/api/feedback` | Patient — `{ appointmentId, type, message }` (`type`: `Feedback` or `Complaint`) |
| GET | `/api/feedback/mine` | Patient |
| GET | `/api/feedback` | Admin (`?status=Open\|Resolved` `&type=`) |
| PUT | `/api/feedback/:id` | Admin — `{ status, adminNotes? }` |

## Structure

```
config/        db.js, cloudinary.js
models/        User, Doctor, Appointment, Payment, Prescription, PatientRecord, Feedback
controllers/   Route handlers
routes/        Express routers
middleware/    auth, roleCheck, upload (Multer), errorHandler
utils/         slots, billing, cloudinaryUpload, parseBody
scripts/       seed.js, backfillInvoices.js
server.js
```
