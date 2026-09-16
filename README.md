# Chagan Backend

Node.js + Express API for the Smart Clinic Appointment Management System.

## Setup

```bash
npm install
cp .env.example .env
# Local MongoDB:
#   MONGO_URI=mongodb://127.0.0.1:27017/chagan
# Or paste your MongoDB Atlas connection string.
npm run dev
```

Health check: `GET http://localhost:5050/api/health`  
(Port `5000` is often used by macOS AirPlay — this project defaults to `5050`.)

## Auth endpoints

| Method | Path | Access |
|--------|------|--------|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | JWT |
| PUT | `/api/auth/profile` | JWT — `{ name?, email?, phone? }` |
| PUT | `/api/auth/password` | JWT — `{ currentPassword, newPassword }` |

Register body: `{ name, email, password, phone?, role? }`  
Roles: `patient` | `doctor` | `admin`

## Doctor endpoints

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/doctors` | Authenticated (`?search=&specialization=`) |
| GET | `/api/doctors/specializations` | Authenticated — distinct specialty labels |
| GET | `/api/doctors/me` | Doctor |
| GET | `/api/doctors/:id/slots` | Authenticated — `?date=YYYY-MM-DD&excludeAppointmentId=` → 30‑min free/taken slots |
| GET | `/api/doctors/:id` | Authenticated |
| POST | `/api/doctors` | Admin |
| PUT | `/api/doctors/:id` | Admin or owning doctor |
| DELETE | `/api/doctors/:id` | Admin |

Create body (admin): `{ name, email, password, phone?, specialization, consultationFee, availability?, about? }`

## Appointment endpoints

| Method | Path | Access |
|--------|------|--------|
| POST | `/api/appointments` | Patient |
| GET | `/api/appointments/mine` | Patient / Doctor / Admin |
| GET | `/api/appointments` | Admin (`?status=&date=`) |
| GET | `/api/appointments/:id` | Authenticated |
| PUT | `/api/appointments/:id/status` | Patient (Cancelled) / Admin / Doctor (Completed) |
| PUT | `/api/appointments/:id/reschedule` | Patient / Admin |

Book / reschedule body: `{ doctorId?, date, timeSlot, notes? }`  
`timeSlot` format: `09:00-09:30` (any 30‑min range fully inside a doctor availability window). Conflicts use time overlap, not exact string match.

## Payment endpoints

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/payments/mine` | Patient |
| GET | `/api/payments` | Admin (`?status=Pending\|Paid`) |
| GET | `/api/payments/billable-appointments` | Admin |
| POST | `/api/payments` | Admin — `{ appointmentId, amount? }` (amount defaults to consultation fee) |
| PUT | `/api/payments/:id` | Admin — mark as Paid (manual, no gateway) |

## Prescription endpoints

| Method | Path | Access |
|--------|------|--------|
| POST | `/api/prescriptions` | Doctor — `{ appointmentId, medications[{name,dosage,duration}], notes? }` |
| GET | `/api/prescriptions/mine` | Patient |
| GET | `/api/prescriptions` | Doctor (own) / Admin (all) |
| GET | `/api/prescriptions/eligible-appointments` | Doctor |
| GET | `/api/prescriptions/:id` | Patient / Doctor / Admin |
| PUT | `/api/prescriptions/:id` | Issuing doctor only |

## Patient Record endpoints

| Method | Path | Access |
|--------|------|--------|
| POST | `/api/records` | Doctor — `{ appointmentId, diagnosisNotes }` |
| GET | `/api/records/mine` | Patient |
| GET | `/api/records/patients` | Doctor — patients with visits |
| GET | `/api/records/eligible-appointments` | Doctor |
| GET | `/api/records/:patientId` | Doctor / Admin / owning patient |
| PUT | `/api/records/:id` | Creating doctor |

## Feedback endpoints

| Method | Path | Access |
|--------|------|--------|
| POST | `/api/feedback` | Patient — `{ appointmentId, type, message }` |
| GET | `/api/feedback/mine` | Patient |
| GET | `/api/feedback` | Admin (`?status=&type=`) |
| PUT | `/api/feedback/:id` | Admin — `{ status, adminNotes? }` |

## Scripts

- `npm run dev` — start with nodemon
- `npm start` — start with node

## Structure

```
config/        DB connection
models/        Mongoose models
controllers/   Route handlers
routes/        Express routers
middleware/    auth, roleCheck, errorHandler
server.js
```
