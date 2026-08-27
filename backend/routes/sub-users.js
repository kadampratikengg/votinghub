const express = require('express');
const bcrypt = require('bcryptjs');
const { deleteFile } = require('../utils/storage');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const SubUser = require('../models/SubUser');
const router = express.Router();

const extractKey = (val) => {
  if (val && val.startsWith('http')) {
    try {
      const parsed = new URL(val);
      const proxyPrefix = '/api/upload/s3/object/';
      if (parsed.pathname.startsWith(proxyPrefix)) {
        return decodeURIComponent(parsed.pathname.slice(proxyPrefix.length));
      }
      return parsed.pathname.replace(/^\/+/, '');
    } catch (error) {
      return val;
    }
  }
  return val;
};

// Get all sub-users for the authenticated user
router.get('/api/sub-users', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).populate('subUsers');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user.subUsers);
  } catch (error) {
    console.error('❌ Error fetching sub-users:', error.message, error.stack);
    res
      .status(500)
      .json({ message: 'Error fetching sub-users', error: error.message });
  }
});

// Create a sub-user
const { roleMiddleware } = require('../middleware/role');

// Create a sub-user (only admin)
router.post(
  '/api/sub-users',
  authenticateToken,
  roleMiddleware('admin'),
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { fullName, email, password, role, profilePic, permissions } =
        req.body;

      if (!fullName || !email || !password) {
        return res
          .status(400)
          .json({ message: 'Full Name, Email, and Password are required' });
      }

      const existingSubUser = await SubUser.findOne({ email });
      if (existingSubUser) {
        return res
          .status(400)
          .json({ message: 'Sub-user email already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const subUser = new SubUser({
        user: userId,
        fullName,
        email,
        password: hashedPassword,
        role,
        profilePic,
        permissions,
      });

      await subUser.save();

      const user = await User.findById(userId);
      user.subUsers.push(subUser._id);
      await user.save();

      res
        .status(201)
        .json({ message: 'Sub-user created successfully', subUser });
    } catch (error) {
      console.error('❌ Error creating sub-user:', error.message, error.stack);
      res
        .status(500)
        .json({ message: 'Error creating sub-user', error: error.message });
    }
  },
);

// Update a sub-user
// Update a sub-user (only admin)
router.put(
  '/api/sub-users/:id',
  authenticateToken,
  roleMiddleware('admin'),
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const subUserId = req.params.id;
      const { fullName, email, role, profilePic, permissions } = req.body;

      const subUser = await SubUser.findOne({ _id: subUserId, user: userId });
      if (!subUser) {
        return res
          .status(404)
          .json({ message: 'Sub-user not found or not authorized' });
      }

      const previousProfilePic = subUser.profilePic || '';
      if (fullName) subUser.fullName = fullName;
      if (email) subUser.email = email;
      if (role) subUser.role = role;
      if (profilePic !== undefined) subUser.profilePic = profilePic;
      if (permissions) subUser.permissions = permissions;

      if (
        profilePic !== undefined &&
        previousProfilePic &&
        previousProfilePic !== subUser.profilePic
      ) {
        try {
          await deleteFile(previousProfilePic);
          console.log(`Deleted previous sub-user image: ${previousProfilePic}`);
        } catch (err) {
          console.error('Error deleting previous sub-user image:', err.message || err);
        }
      }

      await subUser.save();

      res
        .status(200)
        .json({ message: 'Sub-user updated successfully', subUser });
    } catch (error) {
      console.error('❌ Error updating sub-user:', error.message, error.stack);
      res
        .status(500)
        .json({ message: 'Error updating sub-user', error: error.message });
    }
  },
);

// Delete a sub-user
// Delete a sub-user (only admin)
router.delete(
  '/api/sub-users/:id',
  authenticateToken,
  roleMiddleware('admin'),
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const subUserId = req.params.id;

      const subUser = await SubUser.findOne({ _id: subUserId, user: userId });
      if (!subUser) {
        return res
          .status(404)
          .json({ message: 'Sub-user not found or not authorized' });
      }

      if (subUser.profilePic) {
        try {
          await deleteFile(subUser.profilePic);
          console.log(`Deleted sub-user image: ${subUser.profilePic}`);
        } catch (err) {
          console.error('Error deleting sub-user image:', err.message || err);
        }
      }

      await SubUser.deleteOne({ _id: subUserId });

      await User.findByIdAndUpdate(userId, {
        $pull: { subUsers: subUserId },
      });

      res.status(200).json({ message: 'Sub-user deleted successfully' });
    } catch (error) {
      console.error('❌ Error deleting sub-user:', error.message, error.stack);
      res
        .status(500)
        .json({ message: 'Error deleting sub-user', error: error.message });
    }
  },
);

module.exports = router;
