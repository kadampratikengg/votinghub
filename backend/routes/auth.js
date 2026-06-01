const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const multer = require('multer');
const User = require('../models/User');
const SubUser = require('../models/SubUser');
const {
  activatePendingFreeCredits,
  createSubscriptionHistoryRecord,
  FREE_CREDIT_AMOUNT,
  FREE_CREDIT_DELAY_HOURS,
  getActiveRemainingCredits,
  normalizeUserSubscriptionForExpiry,
} = require('../utils/subscription');
const { transporter } = require('../utils/nodemailer');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Configure multer for FormData
const upload = multer();

let razorpay;
try {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} catch (error) {
  console.error('❌ Razorpay initialization failed:', error.message);
}

// Helper function to generate a unique username
const generateUniqueUsername = async (baseUsername) => {
  let username = baseUsername;
  let counter = 1;
  while (await User.findOne({ username })) {
    username = `${baseUsername}_${counter}`;
    counter++;
  }
  return username;
};

// Login (supports main User and SubUser)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('📥 Login attempt for email:', email);

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res
        .status(400)
        .json({ message: 'Email and password are required' });
    }

    // Try main user first
    const user = await User.findOne({ email });
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log('❌ Password mismatch for email:', email);
        return res.status(400).json({ message: 'Invalid email or password' });
      }

      if (!process.env.JWT_SECRET) {
        console.error('❌ JWT_SECRET is not defined in environment variables');
        return res.status(500).json({
          message: 'Server configuration error: JWT_SECRET is not set',
        });
      }

      const token = jwt.sign(
        { userId: user._id, role: user.role || 'admin' },
        process.env.JWT_SECRET,
        {
          expiresIn: '2h',
        },
      );

      await activatePendingFreeCredits(user);
      await normalizeUserSubscriptionForExpiry(user);

      const availableVotingCredits = user.subscription?.votingCredits || 0;
      const isValidSubscription =
        user.subscription?.isValid && availableVotingCredits > 0;

      console.log('✅ Login successful for email (User):', email);
      return res.status(200).json({
        message: 'Login successful',
        token,
        userId: user._id,
        role: user.role || 'admin',
        isValidSubscription,
        subscription: user.subscription
          ? {
              planDuration: user.subscription.planDuration,
              startDate: user.subscription.startDate,
              endDate: user.subscription.endDate,
              activationDate: user.subscription.activationDate,
              amount: user.subscription.amount,
              paymentId: user.subscription.paymentId,
              orderId: user.subscription.orderId,
              votingCredits: user.subscription.votingCredits || 0,
              usedVotingCredits: user.subscription.usedVotingCredits || 0,
            }
          : null,
      });
    }

    // If not main user, try SubUser
    const subUser = await SubUser.findOne({ email });
    if (!subUser) {
      console.log('❌ User not found for email:', email);
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isSubMatch = await bcrypt.compare(password, subUser.password);
    if (!isSubMatch) {
      console.log('❌ Password mismatch for subuser email:', email);
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const parentUser = await User.findById(subUser.user);
    if (!parentUser) {
      return res.status(404).json({ message: 'Parent user not found' });
    }
    await activatePendingFreeCredits(parentUser);
    await normalizeUserSubscriptionForExpiry(parentUser);

    const token = jwt.sign(
      {
        userId: parentUser._id,
        role: 'subuser',
        subUserId: subUser._id,
        subUserRole: subUser.role || 'user',
        permissions: subUser.permissions || [],
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' },
    );

    console.log('✅ Login successful for email (SubUser):', email);
    return res.status(200).json({
      message: 'Login successful',
      token,
      userId: parentUser._id,
      subUserId: subUser._id,
      role: 'subuser',
      subUserRole: subUser.role || 'user',
      permissions: subUser.permissions || [],
      subscription: parentUser.subscription || null,
      isValidSubscription:
        parentUser.subscription?.isValid &&
        (parentUser.subscription?.votingCredits || 0) > 0,
    });
  } catch (error) {
    console.error('❌ Login error:', error.message, error.stack);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// Check Email
router.post('/check-email', express.json(), async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const existingUser = await User.findOne({ email });
    res.status(200).json({ exists: !!existingUser });
  } catch (error) {
    res.status(500).json({ message: 'Failed to check email availability' });
  }
});

// Change Password
router.post(
  '/api/change-password',
  authenticateToken,
  express.json(),
  async (req, res) => {
    const { newPassword } = req.body;

    try {
      if (!newPassword || newPassword.length < 8) {
        return res
          .status(400)
          .json({ message: 'Password must be at least 8 characters' });
      }

      const user = await User.findById(req.user.userId);
      if (!user) return res.status(404).json({ message: 'User not found' });

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to change password' });
    }
  },
);

// Create Account
router.post('/create-account', upload.none(), async (req, res) => {
  const {
    email,
    password,
    confirmPassword,
    name,
    organization,
    logo,
    contact,
    phone,
    address,
    state,
    district,
    pincode,
    gstNumber,
  } = req.body;

  try {
    if (password !== confirmPassword)
      return res.status(400).json({ message: 'Passwords do not match' });
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const baseUsername = email.split('@')[0] || `user_${Date.now()}`;
    const username = await generateUniqueUsername(baseUsername);

    const newUser = new User({
      email,
      password: hashedPassword,
      username,
      name: name || email.split('@')[0] || 'Default User',
      organization,
      logo,
      contact,
      phone,
      address,
      state,
      district,
      pincode,
      gstNumber,
      subscription: {
        planDuration: `${FREE_CREDIT_AMOUNT} Free Voting Credits`,
        activationDate: new Date(
          Date.now() + FREE_CREDIT_DELAY_HOURS * 60 * 60 * 1000,
        ),
        isValid: false,
        votingCredits: 0,
        usedVotingCredits: 0,
        amount: 0,
        paymentId: 'FREE_TRIAL',
        orderId: 'FREE_TRIAL',
      },
    });

    const savedUser = await newUser.save();

    const token = jwt.sign(
      { userId: savedUser._id, role: savedUser.role || 'admin' },
      process.env.JWT_SECRET,
      {
        expiresIn: '2h',
      },
    );

    res.status(201).json({
      message: 'Account created successfully',
      token,
      userId: savedUser._id,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during account creation' });
  }
});

// Create Razorpay Order
router.post('/create-order', express.json(), async (req, res) => {
  const { amount, currency } = req.body;
  try {
    const options = {
      amount,
      currency: currency || 'INR',
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
    };
    const order = await razorpay.orders.create(options);
    res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create order' });
  }
});

// Verify Payment
router.post('/verify-payment', express.json(), async (req, res) => {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    userId,
    planDuration,
    amount,
    validityDays,
    votingCredits,
    mrp,
    discount,
    gst,
  } = req.body;

  try {
    // Ensure numeric parsing of credits/amounts
    const parsedVotingCredits = Number(votingCredits ?? 0);
    const parsedAmount = Number(amount ?? 0);

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.warn('Invalid payment signature', {
        razorpay_order_id,
        razorpay_payment_id,
        generatedSignature,
        razorpay_signature,
      });
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    console.log('🔔 verify-payment called with payload:', {
      razorpay_payment_id,
      razorpay_order_id,
      userId,
      planDuration,
      amount,
      validityDays,
      votingCredits,
    });

    const today = new Date();
    const remainingCredits = getActiveRemainingCredits(
      user.subscription,
      today,
    );

    // Move current subscription to history and drop expired remaining credits.
    if (user.subscription?.orderId || user.subscription?.planDuration) {
      user.subscriptionHistory = user.subscriptionHistory || [];
      user.subscriptionHistory.push(
        createSubscriptionHistoryRecord(user.subscription, today),
      );
    }

    const startDate = today;
    const subscriptionEndDate = new Date(startDate);
    subscriptionEndDate.setDate(
      subscriptionEndDate.getDate() + Number(validityDays ?? 0),
    );

    // Update subscription: carry forward only unexpired credits.
    user.subscription = {
      planDuration,
      startDate,
      endDate: subscriptionEndDate,
      isValid: true,
      votingCredits: remainingCredits + parsedVotingCredits,
      usedVotingCredits:
        remainingCredits > 0 ? user.subscription?.usedVotingCredits || 0 : 0,
      mrp,
      discount,
      gst,
      amount: parsedAmount,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    };

    console.log('ℹ️ New subscription to save:', user.subscription);
    await user.save();
    console.log('✅ Subscription saved for user:', user._id);

    const token = jwt.sign(
      { userId: user._id, role: user.role || 'admin' },
      process.env.JWT_SECRET,
      {
        expiresIn: '2h',
      },
    );

    // Return updated subscription so client can immediately reflect credits.
    res.status(200).json({
      message: 'Payment verified and subscription updated',
      token,
      userId: user._id,
      subscription: user.subscription || {},
      votingCredits: user.subscription?.votingCredits || 0,
      usedVotingCredits: user.subscription?.usedVotingCredits || 0,
    });
  } catch (error) {
    console.error('❌ verify-payment error:', error);
    res
      .status(500)
      .json({ message: 'Payment verification failed', error: error.message });
  }
});

module.exports = router;
