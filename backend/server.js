// server.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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
const {
  sendMail,
  smtpFrom,
  isSmtpConfigured,
  shouldPreferResend,
} = require('./utils/nodemailer');
const {
  activatePendingFreeCredits,
} = require('./utils/subscription');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;
const PASSWORD_RESET_TTL_MS = 10 * 60 * 1000;

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
  ? process.env.DEFAULT_ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  : ['http://localhost:3000', 'https://votinghub-sigma.vercel.app'];

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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-client-public-ip'],
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

const runPendingFreeCreditActivationSweep = async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  const now = new Date();
  const pendingUsers = await User.find({
    'subscription.activationDate': { $exists: true, $lte: now },
    'subscription.isValid': false,
  }).select('_id subscription');

  let activatedCount = 0;
  for (const user of pendingUsers) {
    if (await activatePendingFreeCredits(user)) {
      activatedCount += 1;
    }
  }

  if (activatedCount > 0) {
    console.log(`✅ Activated ${activatedCount} pending free credit account(s)`);
  }
};

let pendingFreeCreditSweepStarted = false;
const startPendingFreeCreditSweep = () => {
  if (pendingFreeCreditSweepStarted) return;
  pendingFreeCreditSweepStarted = true;

  const sweep = () => {
    runPendingFreeCreditActivationSweep().catch((error) => {
      console.error('Failed to sweep pending free credits:', error);
    });
  };

  sweep();
  setInterval(sweep, 60 * 60 * 1000);
};

mongoose.connection.once('connected', startPendingFreeCreditSweep);

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

const getFrontendBaseUrl = () => {
  const rawValue = String(
    process.env.PASSWORD_RESET_URL || process.env.FRONTEND_URL || '',
  ).trim();

  if (!rawValue) {
    return 'http://localhost:3000';
  }

  const candidates = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const validOrigins = candidates
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);

  if (validOrigins.length === 1 && candidates.length === 1) {
    return validOrigins[0];
  }

  if (validOrigins.length > 1) {
    throw new Error(
      'PASSWORD_RESET_URL or FRONTEND_URL must contain exactly one valid URL for password reset emails. Put multiple domains in ALLOWED_ORIGINS instead.',
    );
  }

  if (candidates.length === 1) {
    throw new Error(
      `Invalid password reset URL: ${rawValue}. Set PASSWORD_RESET_URL to a single valid URL such as https://www.privatevoting.in`,
    );
  }

  throw new Error(
    'Password reset URL is misconfigured. Set PASSWORD_RESET_URL to one valid URL only.',
  );
};

const escapeRegex = (value) =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findUserByEmailCaseInsensitive = async (email) => {
  const normalizedEmail = String(email || '').trim();
  if (!normalizedEmail) return null;

  return User.findOne({
    email: { $regex: `^${escapeRegex(normalizedEmail)}$`, $options: 'i' },
  });
};

const buildPasswordResetEmail = (resetUrl) => ({
  subject: 'Reset Your Private Voting Account Password',
  text: [
    'A password reset was requested for your Private Voting account.',
    '',
    `Use this link within 10 minutes: ${resetUrl}`,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n'),
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin: 0 0 12px;">Reset Your Private Voting Account Password</h2>
      <p>A password reset was requested for your Private Voting account.</p>
      <p>
        Click this link within 10 minutes:
        <a href="${resetUrl}" target="_blank" rel="noreferrer">${resetUrl}</a>
      </p>
      <p>If you did not request this reset, you can ignore this email.</p>
    </div>
  `,
});

const sendPasswordResetEmail = async (user, rawToken) => {
  if (!isSmtpConfigured) {
    if (!shouldPreferResend) {
      throw new Error(
        'Email delivery is not configured. Set SMTP_USER, SMTP_PASS, and SMTP_FROM for SMTP or RESEND_API_KEY and RESEND_FROM for HTTPS email delivery.',
      );
    }
  }

  const resetUrl = `${getFrontendBaseUrl()}/reset-password/${rawToken}`;
  const mail = buildPasswordResetEmail(resetUrl);
  const payload = {
    from:
      smtpFrom ||
      process.env.SMTP_USER ||
      process.env.EMAIL_USER ||
      process.env.RESEND_FROM,
    to: user.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  };

  const attempts = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await sendMail(payload);
      return;
    } catch (error) {
      lastError = error;
      if (!isSmtpTimeoutError(error) || attempt === attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  throw lastError;
};

const isSmtpTimeoutError = (error) => {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    code === 'ETIMEDOUT' ||
    code === 'ESOCKET' ||
    code === 'ECONNECTION' ||
    code === 'ECONNREFUSED' ||
    code === 'ENETUNREACH' ||
    code === 'EHOSTUNREACH' ||
    code === 'ECONNRESET' ||
    code === 'EAI_AGAIN' ||
    message.includes('timeout') ||
    message.includes('timed out')
  );
};

app.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};

  try {
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await findUserByEmailCaseInsensitive(email);
    if (!user) {
      return res.status(404).json({ message: 'Email is not registered' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = tokenHash;
    user.resetPasswordExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await user.save();

    try {
      await sendPasswordResetEmail(user, rawToken);
    } catch (mailError) {
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      throw mailError;
    }

    return res.status(200).json({
      message: 'Password reset link sent. It will expire in 10 minutes.',
    });
  } catch (error) {
    console.error('Error sending password reset email:', error);
    if (isSmtpTimeoutError(error)) {
      return res.status(503).json({
        message:
          'Mail server timeout. If this runs on Render, SMTP egress may be blocked. Use RESEND_API_KEY/RESEND_FROM for HTTPS email delivery, or confirm SMTP_PORT=587, SMTP_SECURE=false, Gmail app password, and outbound SMTP access on the live server.',
      });
    }
    const message =
      error?.message ||
      'Failed to send reset email';
    return res.status(500).json({
      message,
    });
  }
});

app.get('/api/reset-password/verify/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ resetPasswordToken: tokenHash });

    if (!user) {
      return res.status(400).json({ message: 'Invalid reset link' });
    }

    if (!user.resetPasswordExpires || user.resetPasswordExpires <= new Date()) {
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      return res.status(410).json({ message: 'Link expired. Please try again.' });
    }

    return res.status(200).json({ message: 'Reset link is valid' });
  } catch (error) {
    console.error('Error verifying reset token:', error);
    return res.status(500).json({ message: 'Failed to verify reset link' });
  }
});

app.post('/api/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { newPassword, confirmPassword } = req.body || {};

  try {
    if (!newPassword || newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 8 characters' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ resetPasswordToken: tokenHash });

    if (!user) {
      return res.status(400).json({ message: 'Invalid reset link' });
    }

    if (!user.resetPasswordExpires || user.resetPasswordExpires <= new Date()) {
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      return res.status(410).json({ message: 'Link expired. Please try again.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({ message: 'Failed to reset password' });
  }
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
app.use(
  '/Uploads',
  express.static('Uploads', {
    maxAge: '7d',
    etag: true,
    immutable: false,
  }),
);

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
    RAZORPAY_KEY_ID: !!process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: !!process.env.RAZORPAY_KEY_SECRET,
    CASHFREE_APP_ID: !!process.env.CASHFREE_APP_ID,
    CASHFREE_SECRET_KEY: !!process.env.CASHFREE_SECRET_KEY,
    CASHFREE_ENV: !!process.env.CASHFREE_ENV,
  });
});
