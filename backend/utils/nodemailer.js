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

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  family: Number(process.env.SMTP_FAMILY || 4),
  requireTLS: !smtpSecure,
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 10000),
  greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 10000),
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 15000),
  tls: {
    minVersion: 'TLSv1.2',
    servername: smtpHost,
  },
});

module.exports = { transporter, smtpFrom, isSmtpConfigured };
