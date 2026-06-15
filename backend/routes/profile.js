const express = require('express');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const {
  activatePendingFreeCredits,
  normalizeUserSubscriptionForExpiry,
} = require('../utils/subscription');
const {
  getIpRestrictionSettings,
  upsertIpRestrictionSettings,
} = require('../utils/ipRestrictionStore');
const router = express.Router();

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

const extractS3Key = (val) => {
  if (!val) return val;
  if (val.startsWith('http')) {
    const parts = val.split('/');
    return parts.slice(3).join('/');
  }
  return val;
};

const normalizeIp = (value) =>
  String(value || '')
    .trim()
    .replace(/^::ffff:/, '')
    .replace(/^\[|\]$/g, '')
    .replace(/^::1$/, '127.0.0.1')
    .replace(/^0:0:0:0:0:0:0:1$/, '127.0.0.1');

const normalizeAllowedIpList = (value) =>
  Array.isArray(value)
    ? value
        .map((v) => normalizeIp(v))
        .filter(Boolean)
        .join(',')
    : String(value || '')
        .split(',')
        .map((v) => normalizeIp(v))
        .filter(Boolean)
        .join(',');

const parseBoolean = (value) =>
  value === true ||
  value === 'true' ||
  value === 1 ||
  value === '1' ||
  value === 'on';

const serializeUserProfile = (user) => ({
  username: user.username || '',
  name: user.name || '',
  organization: user.organization || '',
  logo: user.logo || '',
  contact: user.contact || '',
  email: user.email || '',
  phone: user.phone || '',
  address: user.address || '',
  state: user.state || '',
  district: user.district || '',
  pincode: user.pincode || '',
  gstNumber: user.gstNumber || '',
  ipRestrictionEnabled: !!user.ipRestrictionEnabled,
  allowedIp: user.allowedIp || '',
  subscription: user.subscription || {},
  subscriptionHistory: user.subscriptionHistory || [],
});

const applyIpRestrictionSettings = (user, settings) => {
  if (!user || !settings) return user;

  user.ipRestrictionEnabled = !!settings.ipRestrictionEnabled;
  user.allowedIp = settings.allowedIp || '';
  return user;
};

// Get user profile
router.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET is not defined in environment variables');
      return res
        .status(500)
        .json({ message: 'Server configuration error: JWT_SECRET is not set' });
    }

    const userId = req.user.userId;
    if (!userId) {
      console.error('❌ User ID not found in token');
      return res.status(401).json({ message: 'Invalid authentication token' });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found for ID:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    await activatePendingFreeCredits(user);
    await normalizeUserSubscriptionForExpiry(user);

    const persistedIpSettings = await getIpRestrictionSettings(userId);
    applyIpRestrictionSettings(user, persistedIpSettings);

    if (!user.username) {
      console.log(
        'ℹ️ No username found for user, creating default username:',
        userId,
      );
      const baseUsername = user.email?.split('@')[0] || `user_${userId}`;
      const username = await generateUniqueUsername(baseUsername);
      await User.findByIdAndUpdate(userId, { username }, { new: true });
      user.username = username;
    }

    res.status(200).json(serializeUserProfile(user));
  } catch (error) {
    console.error('❌ Error fetching profile:', error.message, error.stack);
    res
      .status(500)
      .json({ message: 'Error fetching user profile', error: error.message });
  }
});

// Update user profile
router.put('/api/users', authenticateToken, async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET is not defined in environment variables');
      return res
        .status(500)
        .json({ message: 'Server configuration error: JWT_SECRET is not set' });
    }

    const userId = req.user.userId;
    if (!userId) {
      console.error('❌ User ID not found in token');
      return res.status(401).json({ message: 'Invalid authentication token' });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found for ID:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    const {
      name,
      organization,
      logo,
      contact,
      email,
      phone,
      address,
      state,
      district,
      pincode,
      gstNumber,
      ipRestrictionEnabled,
      allowedIp,
    } = req.body;

    // Validate email if provided
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    // Update only provided fields
    const previousLogo = user.logo || '';
    user.name = name !== undefined ? name : user.name;
    user.organization =
      organization !== undefined ? organization : user.organization;
    user.logo = logo !== undefined ? logo : user.logo;
    user.contact = contact !== undefined ? contact : user.contact;
    user.email = email !== undefined ? email : user.email;
    user.phone = phone !== undefined ? phone : user.phone;
    user.address = address !== undefined ? address : user.address;
    user.state = state !== undefined ? state : user.state;
    user.district = district !== undefined ? district : user.district;
    user.pincode = pincode !== undefined ? pincode : user.pincode;
    user.gstNumber = gstNumber !== undefined ? gstNumber : user.gstNumber;

    const nextIpRestrictionEnabled =
      ipRestrictionEnabled !== undefined
        ? parseBoolean(ipRestrictionEnabled)
        : !!user.ipRestrictionEnabled;
    const nextAllowedIp =
      allowedIp !== undefined
        ? normalizeAllowedIpList(allowedIp)
        : normalizeAllowedIpList(user.allowedIp);

    if (nextIpRestrictionEnabled && !nextAllowedIp) {
      return res.status(400).json({
        message:
          'Please provide the allowed IP address before enabling IP restriction',
      });
    }

    user.ipRestrictionEnabled = nextIpRestrictionEnabled;
    user.allowedIp = nextAllowedIp;

    if (
      logo !== undefined &&
      previousLogo &&
      previousLogo !== user.logo &&
      process.env.AWS_BUCKET_NAME
    ) {
      const s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      try {
        const key = extractS3Key(previousLogo);
        await s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
          }),
        );
        console.log(`Deleted previous organization logo from S3: ${key}`);
      } catch (err) {
        console.error(
          'Error deleting previous organization logo from S3:',
          err.message || err,
        );
      }
    }

    await user.save();
    await upsertIpRestrictionSettings(userId, {
      ipRestrictionEnabled: user.ipRestrictionEnabled,
      allowedIp: user.allowedIp,
    });

    res.status(200).json(serializeUserProfile(user));
  } catch (error) {
    console.error('❌ Error updating profile:', error.message, error.stack);
    res
      .status(500)
      .json({ message: 'Error updating profile', error: error.message });
  }
});

module.exports = router;
