const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const ACTIVE_STATUSES = ['Pending', 'Approved'];

const startOfDay = (value) => {
  if (typeof value === 'string') {
    const dateOnly = value.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      const [year, month, day] = dateOnly.split('-').map(Number);
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

const endOfDay = (value) => {
  const d = startOfDay(value);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
};

const parseTimeToMinutes = (time) => {
  const cleaned = String(time || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');

  const match12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (match12) {
    let hours = Number(match12[1]);
    const minutes = Number(match12[2]);
    const meridiem = match12[3];
    if (hours < 1 || hours > 12 || minutes > 59) return null;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    return hours * 60 + minutes;
  }

  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (!match24) return null;
  const hours = Number(match24[1]);
  const minutes = Number(match24[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const minutesToTime = (mins) => {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const normalizeTime = (time) => {
  const mins = parseTimeToMinutes(time);
  if (mins === null) return String(time || '').trim();
  return minutesToTime(mins);
};

const parseSlotRange = (timeSlot) => {
  const parts = String(timeSlot || '')
    .split(/-|–|—/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;

  const start = parseTimeToMinutes(parts[0]);
  if (start === null) return null;

  let end = parseTimeToMinutes(parts[1] || '');
  if (end === null || end === start) {
    end = start + 30;
  }
  if (end <= start) return null;

  return { start, end };
};

const normalizeSlotString = (timeSlot) => {
  const range = parseSlotRange(timeSlot);
  if (!range) return String(timeSlot || '').trim();
  return `${minutesToTime(range.start)}-${minutesToTime(range.end)}`;
};

const rangesOverlap = (a, b) => a.start < b.end && b.start < a.end;

/** Accept full availability windows OR any sub-slot fully inside a window. */
const slotWithinAvailability = (doctor, date, timeSlot) => {
  const dayName = DAY_NAMES[date.getDay()];
  const range = parseSlotRange(timeSlot);
  if (!range) return false;

  return (doctor.availability || []).some((slot) => {
    if (slot.day !== dayName) return false;
    const availStart = parseTimeToMinutes(slot.startTime);
    const availEnd = parseTimeToMinutes(slot.endTime);
    if (availStart === null || availEnd === null) return false;
    return range.start >= availStart && range.end <= availEnd;
  });
};

const buildDaySlots = (doctor, date, bookedAppointments = [], excludeId = null) => {
  const dayName = DAY_NAMES[date.getDay()];
  const windows = (doctor.availability || []).filter((s) => s.day === dayName);
  const bookedRanges = bookedAppointments
    .filter((a) => !excludeId || a._id.toString() !== excludeId.toString())
    .map((a) => parseSlotRange(a.timeSlot))
    .filter(Boolean);

  const slots = [];
  windows.forEach((window) => {
    const start = parseTimeToMinutes(window.startTime);
    const end = parseTimeToMinutes(window.endTime);
    if (start === null || end === null || end <= start) return;

    for (let t = start; t + 30 <= end; t += 30) {
      const range = { start: t, end: t + 30 };
      const timeSlot = `${minutesToTime(range.start)}-${minutesToTime(range.end)}`;
      const taken = bookedRanges.some((b) => rangesOverlap(range, b));
      slots.push({
        timeSlot,
        start: minutesToTime(range.start),
        end: minutesToTime(range.end),
        available: !taken,
      });
    }
  });

  return { dayName, windows, slots };
};

module.exports = {
  DAY_NAMES,
  ACTIVE_STATUSES,
  startOfDay,
  endOfDay,
  parseTimeToMinutes,
  normalizeTime,
  parseSlotRange,
  normalizeSlotString,
  rangesOverlap,
  slotWithinAvailability,
  buildDaySlots,
};
