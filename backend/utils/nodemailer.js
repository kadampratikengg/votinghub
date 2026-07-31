const axios = require('axios');
const nodemailer = require('nodemailer');

const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure =
  String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' ||
  smtpPort === 465;
const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || '';
const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || '';
const smtpFrom =
  process.env.SMTP_FROM || process.env.EMAIL_FROM || smtpUser || '';
const isSmtpConfigured = Boolean(smtpUser && smtpPass && smtpFrom);
const mailProvider = String(process.env.MAIL_PROVIDER || '').trim().toLowerCase();
const resendApiKey = String(process.env.RESEND_API_KEY || '').trim();
const resendFrom = String(process.env.RESEND_FROM || '').trim();
const resendBaseUrl = String(process.env.RESEND_BASE_URL || 'https://api.resend.com')
  .trim()
  .replace(/\/$/, '');
const shouldPreferResend =
  mailProvider === 'resend' ||
  (mailProvider !== 'smtp' && Boolean(resendApiKey && resendFrom));

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  family: Number(process.env.SMTP_FAMILY || 4),
  requireTLS: !smtpSecure,
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 30000),
  greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 30000),
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 60000),
  tls: {
    minVersion: 'TLSv1.2',
    servername: smtpHost,
  },
});

const sendViaResend = async (message) => {
  if (!resendApiKey || !resendFrom) {
    throw new Error(
      'Resend is not configured. Set RESEND_API_KEY and RESEND_FROM to use HTTPS email delivery.',
    );
  }

  const payload = {
    from: message.from || resendFrom,
    to: Array.isArray(message.to) ? message.to : [message.to],
    subject: message.subject,
    text: message.text,
    html: message.html,
  };

  await axios.post(`${resendBaseUrl}/emails`, payload, {
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: Number(process.env.RESEND_TIMEOUT || 15000),
  });
};

const sendMail = async (message) => {
  if (shouldPreferResend) {
    return sendViaResend(message);
  }

  return transporter.sendMail(message);
};

module.exports = {
  transporter,
  smtpFrom,
  isSmtpConfigured,
  sendMail,
  shouldPreferResend,
  resendFrom,
};
