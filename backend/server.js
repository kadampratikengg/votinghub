// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contact');
const orderRoutes = require('./routes/order');
const eventRoutes = require('./routes/event');
const invoiceRoutes = require('./routes/invoice');
const s3UploadRoutes = require('./routes/s3-upload');
const healthRoutes = require('./routes/health');
const profileRoutes = require('./routes/profile');
const subUserRoutes = require('./routes/sub-users');
const adminRoutes = require('./routes/admin');
const uploadcareRoutes = require('./routes/uploadcare'); // now handles S3 deletions
const { errorHandler, multerErrorHandler } = require('./middleware/error');
const { authenticateToken } = require('./middleware/auth');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;

// prometheus instrumentation
const client = require('prom-client');
const mongoose = require('mongoose');

// collect default metrics
try {
  client.collectDefaultMetrics({ timeout: 5000 });
} catch (err) {
  console.warn('Prom-client metrics collection failed to start', err);
}

// Ensure req.protocol resolves correctly behind Render / other proxies.
app.set('trust proxy', 1);

// Ensure Uploads Directory Exists
const uploadPath = './Uploads';
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

// Middleware
// Use DEFAULT_ALLOWED_ORIGINS from .env if configured, otherwise fall back to the local/production app origins.
const defaultAllowedOrigins = process.env.DEFAULT_ALLOWED_ORIGINS
  ? process.env.DEFAULT_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [
      'http://localhost:3000',
      'https://votinghub-sigma.vercel.app',
    ];

const configuredAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  : [];

const allowedOrigins = [...configuredAllowedOrigins, ...defaultAllowedOrigins]
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(multerErrorHandler);

// Connect to MongoDB
connectDB();

// Routes
app.get('/', (req, res) => {
  res.status(200).json({ message: '✅ Backend is running' });
});
// Expose Prometheus metrics
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// readiness probe: checks mongoose connection state
app.get('/ready', (req, res) => {
  const state = mongoose.connection && mongoose.connection.readyState;
  // 1 == connected
  if (state === 1) return res.status(200).json({ ready: true });
  return res.status(503).json({ ready: false });
});
app.post('/api/change-password', authenticateToken, async (req, res) => {
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
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

app.use('/', authRoutes);
app.use('/', adminRoutes);
app.use('/', orderRoutes);
app.use('/', invoiceRoutes);
app.use('/', s3UploadRoutes);
app.use('/', healthRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api', eventRoutes);
app.use('/api/uploadcare', uploadcareRoutes); // keep route path for backward-compatibility (deletes S3 objects)
app.use('/', profileRoutes);
app.use('/', subUserRoutes);

// Serve uploaded files
app.use('/Uploads', express.static('Uploads'));

// Handle 404 errors with JSON response
app.use((req, res, next) => {
  console.error(`❌ Route not found: ${req.originalUrl}`);
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);

  // Log presence of important environment variables (do NOT print secret values)
  console.info('🔒 Env check:', {
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    JWT_SECRET: !!process.env.JWT_SECRET,
    FRONTEND_URL: !!process.env.FRONTEND_URL,
  });
});
