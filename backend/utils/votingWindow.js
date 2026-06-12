const MINUTE = 60 * 1000;

const parseLocalDateTime = (date, time) => {
  if (!date || !time) return null;
  const normalizedTime = String(time).trim();
  const value =
    normalizedTime.length === 5 ? `${normalizedTime}:00` : normalizedTime;
  const parsed = new Date(`${date}T${value}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

const getStartDateTime = (event = {}) =>
  event.startDateTime
    ? new Date(event.startDateTime)
    : parseLocalDateTime(event.date, event.startTime);

const getOriginalEndDateTime = (event = {}) =>
  event.originalEndDateTime
    ? new Date(event.originalEndDateTime)
    : parseLocalDateTime(event.date, event.stopTime);

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
