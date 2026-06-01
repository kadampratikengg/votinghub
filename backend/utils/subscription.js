const FREE_CREDIT_DELAY_HOURS = Number(
  process.env.FREE_CREDIT_DELAY_HOURS || 24,
);
const FREE_CREDIT_AMOUNT = Number(process.env.FREE_CREDIT_AMOUNT || 2);
const FREE_CREDIT_VALIDITY_DAYS = Number(
  process.env.FREE_CREDIT_VALIDITY_DAYS || 365,
);

const startOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const isSubscriptionExpired = (subscription, now = new Date()) => {
  if (!subscription?.endDate) return false;

  const endDate = new Date(subscription.endDate);
  if (Number.isNaN(endDate.getTime())) return false;

  return startOfDay(endDate) <= startOfDay(now);
};

const getActiveRemainingCredits = (subscription, now = new Date()) => {
  if (!subscription || isSubscriptionExpired(subscription, now)) return 0;
  return Math.max(0, Number(subscription.votingCredits || 0));
};

const normalizeSubscriptionForExpiry = (subscription, now = new Date()) => {
  if (!subscription) return false;
  if (!isSubscriptionExpired(subscription, now)) return false;

  subscription.isValid = false;
  subscription.votingCredits = 0;
  return true;
};

const normalizeUserSubscriptionForExpiry = async (
  user,
  now = new Date(),
  shouldSave = true,
) => {
  const changed = normalizeSubscriptionForExpiry(user?.subscription, now);
  if (changed && shouldSave) {
    await user.save();
  }
  return changed;
};

const createSubscriptionHistoryRecord = (subscription, now = new Date()) => {
  const expired = isSubscriptionExpired(subscription, now);

  return {
    planDuration: subscription.planDuration,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    isValid: expired ? false : subscription.isValid,
    amount: subscription.amount,
    paymentId: subscription.paymentId,
    orderId: subscription.orderId,
    votingCredits: expired ? 0 : subscription.votingCredits || 0,
    usedVotingCredits: subscription.usedVotingCredits || 0,
    mrp: subscription.mrp,
    discount: subscription.discount,
    gst: subscription.gst,
  };
};

const activatePendingFreeCredits = async (user) => {
  if (
    !user?.subscription ||
    user.subscription.isValid ||
    !user.subscription.activationDate
  ) {
    return false;
  }

  const now = new Date();
  const activationDate = new Date(user.subscription.activationDate);
  if (now < activationDate) {
    return false;
  }

  const startDate = activationDate;
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + FREE_CREDIT_VALIDITY_DAYS);

  user.subscription = {
    ...user.subscription,
    startDate,
    endDate,
    isValid: true,
    votingCredits: FREE_CREDIT_AMOUNT,
    usedVotingCredits: 0,
  };

  await user.save();
  return true;
};

module.exports = {
  activatePendingFreeCredits,
  createSubscriptionHistoryRecord,
  FREE_CREDIT_DELAY_HOURS,
  FREE_CREDIT_AMOUNT,
  FREE_CREDIT_VALIDITY_DAYS,
  getActiveRemainingCredits,
  isSubscriptionExpired,
  normalizeSubscriptionForExpiry,
  normalizeUserSubscriptionForExpiry,
};
