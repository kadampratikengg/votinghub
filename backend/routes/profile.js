const express = require('express');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const {
  activatePendingFreeCredits,
  normalizeUserSubscriptionForExpiry,
} = require('../utils/subscription');
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

    res.status(200).json({
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
      subscription: user.subscription || {},
      subscriptionHistory: user.subscriptionHistory || [],
    });
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

    res.status(200).json({
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
      subscription: user.subscription || {},
      subscriptionHistory: user.subscriptionHistory || [],
    });
  } catch (error) {
    console.error('❌ Error updating profile:', error.message, error.stack);
    res
      .status(500)
      .json({ message: 'Error updating profile', error: error.message });
  }
});

module.exports = router;
