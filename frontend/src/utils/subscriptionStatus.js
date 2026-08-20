const isSameDayOrBeforeToday = (date) => {
  if (!date) return false;

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return false;

  const today = new Date();
  parsedDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return parsedDate <= today;
};

export const getSubscriptionStatusInfo = (
  subscription = {},
  { current = false } = {},
) => {
  const status = String(subscription.paymentStatus || '')
    .trim()
    .toLowerCase();
  const hasEndDate = Boolean(subscription.endDate);
  const expired = isSameDayOrBeforeToday(subscription.endDate);

  if (!subscription.isValid && subscription.activationDate) {
    const actDate = new Date(subscription.activationDate);
    if (!Number.isNaN(actDate.getTime()) && new Date() < actDate) {
      return { label: 'Pending Trial', tone: 'pending' };
    }
  }

  if (subscription.isValid) {
    if (current && hasEndDate) {
      return { label: 'Active until', tone: 'active' };
    }
    return { label: 'Active', tone: 'active' };
  }

  const isPending = status === 'pending';
  if (isPending) {
    return { label: 'Pending', tone: 'pending' };
  }

  if (expired || status === 'expired') {
    return { label: 'Expired', tone: 'expired' };
  }

  const isInactive =
    status === 'inactive' ||
    status === 'failed' ||
    subscription.isValid === false;

  if (isInactive) {
    return { label: 'Inactive', tone: 'inactive' };
  }

  return { label: 'Inactive', tone: 'inactive' };
};

