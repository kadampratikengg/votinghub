const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const EventHistory = require('../models/EventHistory');
const { authenticateToken } = require('../middleware/auth');
const {
  createSubscriptionHistoryRecord,
  getActiveRemainingCredits,
  normalizeSubscriptionForExpiry,
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
