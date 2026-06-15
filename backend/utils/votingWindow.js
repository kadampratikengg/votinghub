const MINUTE = 60 * 1000;

const parseLocalDateTime = (date, time) => {
  if (!date || !time) return null;
  // Expect date in YYYY-MM-DD and time in HH:mm or HH:mm:ss (local values)
  try {
    const dateParts = String(date)
      .split('-')
      .map((p) => parseInt(p, 10));
    if (dateParts.length !== 3 || dateParts.some((n) => Number.isNaN(n))) {
      return null;
    }

    const normalizedTime = String(time).trim();
    const timeParts = normalizedTime.split(':').map((p) => parseInt(p, 10));
    if (
      timeParts.length < 2 ||
      timeParts.slice(0, 2).some((n) => Number.isNaN(n))
    ) {
      return null;
    }

    const year = dateParts[0];
    const month = dateParts[1];
    const day = dateParts[2];
    const hour = Number.isFinite(timeParts[0]) ? timeParts[0] : 0;
    const minute = Number.isFinite(timeParts[1]) ? timeParts[1] : 0;
    const second = Number.isFinite(timeParts[2]) ? timeParts[2] : 0;

    // Construct Date using numeric components so it's interpreted as local time
    const parsed = new Date(year, month - 1, day, hour, minute, second);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch (e) {
    return null;
  }
};

const toDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const isSameCalendarDay = (left, right) => {
  const leftKey = toDateKey(left);
  const rightKey = toDateKey(right);
  return !!leftKey && leftKey === rightKey;
};

const getStartDateTime = (event = {}) => {
  // Prefer the explicit date+startTime values (interpreted as local)
  // — this mitigates older events that may have stored a mis-parsed Date.
  const fromComponents = parseLocalDateTime(event.date, event.startTime);
  if (fromComponents) return fromComponents;

  if (event.startDateTime) {
    const parsed = new Date(event.startDateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const getOriginalEndDateTime = (event = {}) => {
  const fromComponents = parseLocalDateTime(event.date, event.stopTime);
  if (fromComponents) return fromComponents;

  if (event.originalEndDateTime) {
    const parsed = new Date(event.originalEndDateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const getEffectiveEndDateTime = (event = {}) => {
  if (event.endDateTime) {
    const parsed = new Date(event.endDateTime);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const originalEnd = getOriginalEndDateTime(event);
  if (!originalEnd) return null;

  const bufferMinutes = Number(event.bufferMinutes || 0);
  if (!Number.isFinite(bufferMinutes) || bufferMinutes <= 0) {
    return originalEnd;
  }

  return new Date(originalEnd.getTime() + bufferMinutes * MINUTE);
};

const getVotingWindow = (event = {}, now = new Date()) => {
  const startDateTime = getStartDateTime(event);
  const originalEndDateTime = getOriginalEndDateTime(event);
  const effectiveEndDateTime = getEffectiveEndDateTime(event);
  const current = now instanceof Date ? now : new Date(now);

  if (
    !startDateTime ||
    !originalEndDateTime ||
    !effectiveEndDateTime ||
    Number.isNaN(current.getTime())
  ) {
    return {
      startDateTime: startDateTime || null,
      originalEndDateTime: originalEndDateTime || null,
      effectiveEndDateTime: effectiveEndDateTime || null,
      bufferMinutes: Number(event.bufferMinutes || 0) || 0,
      phase: 'invalid',
      isOpen: false,
      message: 'Voting time is over.',
    };
  }

  let phase = 'active';
  let message = null;

  if (current < startDateTime) {
    phase = 'before-start';
    message = 'Voting has not started yet.';
  } else if (current >= effectiveEndDateTime) {
    phase = 'closed';
    message = 'Voting time is over.';
  } else if (current >= originalEndDateTime) {
    phase = 'buffer';
  }

  return {
    startDateTime,
    originalEndDateTime,
    effectiveEndDateTime,
    bufferMinutes: Number(event.bufferMinutes || 0) || 0,
    phase,
    isOpen: phase === 'active' || phase === 'buffer',
    message,
  };
};

const canAddBufferTime = (event = {}, now = new Date()) => {
  const current = now instanceof Date ? now : new Date(now);
  const votingWindow = getVotingWindow(event, current);
  const originalEndDateTime = votingWindow.originalEndDateTime;

  if (!originalEndDateTime || Number.isNaN(current.getTime())) {
    return {
      allowed: false,
      message: 'Voting time is over.',
    };
  }

  if (votingWindow.phase === 'before-start') {
    return {
      allowed: false,
      message: 'Voting has not started yet.',
    };
  }

  if (!isSameCalendarDay(current, originalEndDateTime)) {
    return {
      allowed: false,
      message:
        'Buffer time can only be added on the same calendar day as the original voting end date.',
    };
  }
  // Allow adding buffer only within the 1 hour window before the original end time
  // and not after the original end time. Frontend displays the Add button in the
  // same 1-hour window; keep backend validation consistent.
  try {
    const oneHourBefore = new Date(originalEndDateTime.getTime() - 60 * MINUTE);
    if (current < oneHourBefore || current >= originalEndDateTime) {
      return {
        allowed: false,
        message:
          'Buffer time may only be added within the 1 hour before the original end time (on the same day).',
      };
    }
  } catch (e) {
    return {
      allowed: false,
      message: 'Invalid event timing.',
    };
  }

  return {
    allowed: true,
    message: '',
  };
};

module.exports = {
  MINUTE,
  canAddBufferTime,
  getEffectiveEndDateTime,
  getOriginalEndDateTime,
  getStartDateTime,
  getVotingWindow,
  isSameCalendarDay,
  parseLocalDateTime,
  toDateKey,
};
