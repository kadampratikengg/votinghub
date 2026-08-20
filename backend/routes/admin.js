const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const EventHistory = require('../models/EventHistory');
const { authenticateToken } = require('../middleware/auth');
const {
  activatePendingFreeCredits,
  createSubscriptionHistoryRecord,
  getActiveRemainingCredits,
  normalizeSubscriptionForExpiry,
  runPendingFreeCreditActivationSweep,
} = require('../utils/subscription');

const router = express.Router();

const sanitizeUser = (user) => ({
  id: user._id,
  email: user.email || '',
  username: user.username || '',
  name: user.name || '',
  organization: user.organization || '',
  contact: user.contact || '',
  phone: user.phone || '',
  address: user.address || '',
  state: user.state || '',
  district: user.district || '',
  pincode: user.pincode || '',
  gstNumber: user.gstNumber || '',
  role: user.role || 'admin',
  subscription: user.subscription || {},
  subscriptionHistory: user.subscriptionHistory || [],
});

const parseDateInput = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toPaise = (value) => Math.round(Number(value || 0) * 100);

const parseSubscriptionStatus = (value, fallback = 'active') => {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (!normalized) return fallback;

  const allowedStatuses = new Set([
    'active',
    'inactive',
    'pending',
    'expired',
    'failed',
    'paid',
    'success',
  ]);

  return allowedStatuses.has(normalized) ? normalized : normalized;
};

const isSubscriptionExpiredOnOrBeforeToday = (date) => {
  if (!date) return false;

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return false;

  const today = new Date();
  parsedDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return parsedDate <= today;
};

const normalizeUserForResponse = (user) => {
  normalizeSubscriptionForExpiry(user.subscription, new Date());
  return sanitizeUser(user);
};

const requireCompanyAdmin = (req, res, next) => {
  if (req.user?.role !== 'company_admin') {
    return res.status(403).json({ message: 'Company admin access required' });
  }
  next();
};

const getAdminId = () => process.env.ADMIN_ID || process.env.ADMIN_EMAIL;

router.post('/admin/login', async (req, res) => {
  try {
    const { adminId, password } = req.body;
    const configuredAdminId = getAdminId();
    const configuredPassword = process.env.ADMIN_PASSWORD;

    if (!configuredAdminId || !configuredPassword || !process.env.JWT_SECRET) {
      return res.status(500).json({
        message:
          'Admin login is not configured. Set ADMIN_ID, ADMIN_PASSWORD, and JWT_SECRET.',
      });
    }

    if (adminId !== configuredAdminId || password !== configuredPassword) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const token = jwt.sign(
      { role: 'company_admin', adminId: configuredAdminId },
      process.env.JWT_SECRET,
      { expiresIn: '4h' },
    );

    res.status(200).json({ message: 'Admin login successful', token });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Admin login failed' });
  }
});

router.get(
  '/api/admin/users',
  authenticateToken,
  requireCompanyAdmin,
  async (req, res) => {
    try {
      await runPendingFreeCreditActivationSweep().catch((err) => {
        console.error('Error running pending free credit sweep in admin:', err);
      });

      const users = await User.find({})
        .select('-password')
        .sort({ email: 1 })
        .lean();

      res.status(200).json({ users: users.map(normalizeUserForResponse) });
    } catch (error) {
      console.error('Admin users fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  },
);

router.get(
  '/api/admin/users/:userId/history',
  authenticateToken,
  requireCompanyAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      const history = await EventHistory.find({ userId })
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({ history });
    } catch (error) {
      console.error('Admin fetch user history error:', error);
      res.status(500).json({ message: 'Failed to fetch user history' });
    }
  },
);

router.patch(
  '/api/admin/users/:userId/password',
  authenticateToken,
  requireCompanyAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { password } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      if (!password || password.length < 8) {
        return res
          .status(400)
          .json({ message: 'Password must be at least 8 characters' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      user.password = await bcrypt.hash(password, 10);
      await user.save();

      res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Admin password reset error:', error);
      res.status(500).json({ message: 'Failed to reset password' });
    }
  },
);

router.post(
  '/api/admin/users/:userId/free-credits',
  authenticateToken,
  requireCompanyAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const credits = Number(req.body.credits);
      const validityDays = Number(req.body.validityDays || 365);

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      if (!Number.isFinite(credits) || credits <= 0) {
        return res
          .status(400)
          .json({ message: 'Credits must be a positive number' });
      }

      if (!Number.isFinite(validityDays) || validityDays <= 0) {
        return res
          .status(400)
          .json({ message: 'Validity days must be a positive number' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const now = new Date();
      const remainingCredits = getActiveRemainingCredits(
        user.subscription,
        now,
      );

      if (user.subscription?.orderId || user.subscription?.planDuration) {
        user.subscriptionHistory = user.subscriptionHistory || [];
        user.subscriptionHistory.push(
          createSubscriptionHistoryRecord(user.subscription, now),
        );
      }

      const startDate = now;
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + validityDays);
      const orderId = `ADMIN_FREE_${Date.now()}_${String(user._id).slice(-6)}`;

      user.subscription = {
        planDuration: `${credits} Free Voting Credits`,
        startDate,
        endDate,
        isValid: true,
        votingCredits: remainingCredits + credits,
        usedVotingCredits:
          remainingCredits > 0 ? user.subscription?.usedVotingCredits || 0 : 0,
        mrp: 0,
        discount: 0,
        gst: 0,
        amount: 0,
        paymentId: 'ADMIN_FREE_CREDITS',
        orderId,
      };

      await user.save();

      res.status(200).json({
        message: 'Free credits added successfully',
        user: sanitizeUser(user.toObject()),
      });
    } catch (error) {
      console.error('Admin free credits error:', error);
      res.status(500).json({ message: 'Failed to add free credits' });
    }
  },
);

router.post(
  '/api/admin/users/:userId/paid-credits',
  authenticateToken,
  requireCompanyAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const credits = Number(req.body.credits);
      const usedVotingCredits = Number(req.body.usedVotingCredits || 0);
      const amountRupees = Number(req.body.amount);
      const applyTax = req.body.applyTax === true || req.body.applyTax === 'true';
      const validityDays = Number(req.body.validityDays || 365);
      const paymentStatus = String(req.body.status || 'active')
        .trim()
        .toLowerCase();

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      if (!Number.isFinite(credits) || credits <= 0) {
        return res
          .status(400)
          .json({ message: 'Credits must be a positive number' });
      }

      if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
        return res
          .status(400)
          .json({ message: 'Amount must be a positive number' });
      }

      if (!Number.isFinite(validityDays) || validityDays <= 0) {
        return res
          .status(400)
          .json({ message: 'Validity days must be a positive number' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const now = new Date();
      const remainingCredits = getActiveRemainingCredits(
        user.subscription,
        now,
      );

      if (user.subscription?.orderId || user.subscription?.planDuration) {
        user.subscriptionHistory = user.subscriptionHistory || [];
        user.subscriptionHistory.push(
          createSubscriptionHistoryRecord(user.subscription, now),
        );
      }

      const startDate = parseDateInput(req.body.startDate) || now;
      const endDateInput = parseDateInput(req.body.endDate);
      const endDate = endDateInput || new Date(startDate);
      if (!endDateInput) {
        endDate.setDate(endDate.getDate() + validityDays);
      }

      const orderId =
        req.body.orderId ||
        `ADMIN_PAID_${Date.now()}_${String(user._id).slice(-6)}`;
      const paymentId =
        req.body.paymentId ||
        req.body.transactionId ||
        `TXN_${Date.now()}_${String(user._id).slice(-6)}`;
      const paymentProvider =
        req.body.paymentProvider || 'admin_manual';
      const baseAmountRupees = Number(
        (Number(req.body.mrp ?? amountRupees) || 0).toFixed(2),
      );
      const invoiceBaseAmount = Number(
        (Number(req.body.invoiceBaseAmount ?? baseAmountRupees) || 0).toFixed(2),
      );
      const gstRupees = applyTax
        ? Number(
            (Number(req.body.gst ?? (amountRupees - baseAmountRupees)) || 0).toFixed(2),
          )
        : 0;
      const invoiceTaxAmount = Number(
        (Number(req.body.invoiceTaxAmount ?? gstRupees) || 0).toFixed(2),
      );
      const invoiceTotalAmount = Number(
        (Number(req.body.invoiceTotalAmount ?? amountRupees) || 0).toFixed(2),
      );
      const paymentAmount = toPaise(amountRupees);
      const discountRupees = Number(req.body.discount || 0);
      const mrpRupees = Number(req.body.mrp || baseAmountRupees);
      const normalizedStatus =
        paymentStatus === 'active' ||
        paymentStatus === 'paid' ||
        paymentStatus === 'success'
          ? 'active'
          : paymentStatus;

      user.subscription = {
        planDuration:
          req.body.planDuration || `${credits} Paid Voting Credits`,
        startDate,
        endDate,
        activationDate: startDate,
        isValid: normalizedStatus === 'active',
        votingCredits: remainingCredits + credits,
        usedVotingCredits:
          Number.isFinite(usedVotingCredits) && usedVotingCredits >= 0
            ? usedVotingCredits
            : 0,
        mrp: mrpRupees,
        discount: discountRupees,
        gst: gstRupees,
        amount: paymentAmount,
        invoiceBaseAmount,
        invoiceTaxAmount,
        invoiceTotalAmount,
        paymentId,
        orderId,
        paymentStatus: normalizedStatus,
        paymentProvider,
        taxApplied: applyTax,
        verifiedAt: new Date(),
      };

      await user.save();

      res.status(200).json({
        message: 'Paid credits added successfully',
        user: sanitizeUser(user.toObject()),
      });
    } catch (error) {
      console.error('Admin paid credits error:', error);
      res.status(500).json({ message: 'Failed to add paid credits' });
    }
  },
);

router.patch(
  '/api/admin/users/:userId/validity',
  authenticateToken,
  requireCompanyAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { endDate } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      const parsedEndDate = new Date(endDate);
      if (!endDate || Number.isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ message: 'Valid end date is required' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!user.subscription) {
        return res
          .status(400)
          .json({ message: 'User does not have a subscription to update' });
      }

      user.subscription.endDate = parsedEndDate;
      if (!normalizeSubscriptionForExpiry(user.subscription, new Date())) {
        user.subscription.isValid = true;
      }
      if (!user.subscription.startDate) {
        user.subscription.startDate = new Date();
      }

      await user.save();

      res.status(200).json({
        message: 'Validity updated successfully',
        user: sanitizeUser(user.toObject()),
      });
    } catch (error) {
      console.error('Admin validity update error:', error);
      res.status(500).json({ message: 'Failed to update validity' });
    }
  },
);

router.patch(
  '/api/admin/users/:userId/subscriptions/:orderId',
  authenticateToken,
  requireCompanyAdmin,
  async (req, res) => {
    try {
      const { userId, orderId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      let subscription = null;
      if (orderId === 'current' || user.subscription?.orderId === orderId) {
        subscription = user.subscription;
      } else {
        subscription = (user.subscriptionHistory || []).find(
          (item) => item.orderId === orderId,
        );
      }

      if (!subscription) {
        return res.status(404).json({ message: 'Subscription not found' });
      }

      const nextStartDate = parseDateInput(req.body.startDate);
      if (req.body.startDate && !nextStartDate) {
        return res.status(400).json({ message: 'Valid start date is required' });
      }

      const nextEndDate = parseDateInput(req.body.endDate);
      if (req.body.endDate && !nextEndDate) {
        return res.status(400).json({ message: 'Valid end date is required' });
      }

      const nextCredits =
        req.body.votingCredits !== undefined
          ? Number(req.body.votingCredits)
          : Number(subscription.votingCredits || 0);
      if (!Number.isFinite(nextCredits) || nextCredits < 0) {
        return res
          .status(400)
          .json({ message: 'Credits must be a non-negative number' });
      }

      const nextUsedVotingCredits =
        req.body.usedVotingCredits !== undefined
          ? Number(req.body.usedVotingCredits)
          : Number(subscription.usedVotingCredits || 0);
      if (
        !Number.isFinite(nextUsedVotingCredits) ||
        nextUsedVotingCredits < 0
      ) {
        return res
          .status(400)
          .json({ message: 'Used credits must be a non-negative number' });
      }

      const nextAmountRupees =
        req.body.amount !== undefined
          ? Number(req.body.amount)
          : Number(subscription.amount || 0) / 100;
      if (!Number.isFinite(nextAmountRupees) || nextAmountRupees < 0) {
        return res
          .status(400)
          .json({ message: 'Amount must be a non-negative number' });
      }

      const nextPlanDuration =
        req.body.planDuration !== undefined
          ? String(req.body.planDuration).trim()
          : subscription.planDuration;
      const nextPaymentStatus = parseSubscriptionStatus(
        req.body.status ?? req.body.paymentStatus ?? subscription.paymentStatus,
        subscription.isValid ? 'active' : 'inactive',
      );
      const nextIsValid =
        ['active', 'paid', 'success'].includes(nextPaymentStatus) &&
        !isSubscriptionExpiredOnOrBeforeToday(
          nextEndDate || subscription.endDate,
        );
      const nextHasCredits = nextCredits > 0;

      subscription.planDuration = nextPlanDuration;
      if (nextStartDate) subscription.startDate = nextStartDate;
      if (nextEndDate) subscription.endDate = nextEndDate;
      subscription.amount = toPaise(nextAmountRupees);
      subscription.votingCredits = nextCredits;
      subscription.usedVotingCredits = nextUsedVotingCredits;
      subscription.paymentStatus = nextPaymentStatus;
      subscription.isValid = nextIsValid && nextHasCredits;

      if (!subscription.paymentProvider) {
        subscription.paymentProvider = 'admin_manual';
      }
      if (!subscription.verifiedAt) {
        subscription.verifiedAt = new Date();
      }

      await user.save();

      res.status(200).json({
        message: 'Subscription updated successfully',
        user: sanitizeUser(user.toObject()),
      });
    } catch (error) {
      console.error('Admin subscription update error:', error);
      res.status(500).json({ message: 'Failed to update subscription' });
    }
  },
);

router.patch(
  '/api/admin/users/:userId/subscriptions/:orderId/validity',
  authenticateToken,
  requireCompanyAdmin,
  async (req, res) => {
    try {
      const { userId, orderId } = req.params;
      const { endDate } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      const parsedEndDate = new Date(endDate);
      if (!endDate || Number.isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ message: 'Valid end date is required' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      let subscription = null;
      if (user.subscription?.orderId === orderId) {
        subscription = user.subscription;
      } else {
        subscription = (user.subscriptionHistory || []).find(
          (item) => item.orderId === orderId,
        );
      }

      if (!subscription) {
        return res.status(404).json({ message: 'Subscription not found' });
      }

      subscription.endDate = parsedEndDate;
      if (!normalizeSubscriptionForExpiry(subscription, new Date())) {
        subscription.isValid = true;
      }
      if (!subscription.startDate) {
        subscription.startDate = new Date();
      }

      await user.save();

      res.status(200).json({
        message: 'Subscription validity updated successfully',
        user: sanitizeUser(user.toObject()),
      });
    } catch (error) {
      console.error('Admin subscription validity update error:', error);
      res
        .status(500)
        .json({ message: 'Failed to update subscription validity' });
    }
  },
);

module.exports = router;
