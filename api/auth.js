// LORA Mattress — Centralized Server-Side Authorization & Integration Status Helper
// Single source of truth for credentials and server environment protection

const crypto = require('crypto');

const fs = require('fs');
const path = require('path');
const DEFAULT_ADMIN_PASSWORD = 'LoraLuxury2026!';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const ADMIN_AUTH_FILE = path.join(__dirname, '..', 'config', 'admin_auth.json');

// Password changed from the admin panel is stored hashed (scrypt) — never in plain text
function readStoredPassword() {
  try {
    if (fs.existsSync(ADMIN_AUTH_FILE)) {
      const d = JSON.parse(fs.readFileSync(ADMIN_AUTH_FILE, 'utf8'));
      if (d && d.salt && d.hash) return d;
    }
  } catch (e) {}
  return null;
}

function setAdminPassword(newPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(newPassword), salt, 64).toString('hex');
  fs.writeFileSync(ADMIN_AUTH_FILE, JSON.stringify({ salt, hash, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
}

function getAdminSecret() {
  return (process.env.ADMIN_PASSWORD || process.env.ADMIN_AUTH_TOKEN || DEFAULT_ADMIN_PASSWORD).trim();
}

function getAdminUsername() {
  return (process.env.ADMIN_USERNAME || 'admin@loramattress.com').trim().toLowerCase();
}

function usingDefaultPassword() {
  return !readStoredPassword() && !process.env.ADMIN_PASSWORD && !process.env.ADMIN_AUTH_TOKEN;
}

// Signing key: explicit secret, else derived from the current password (changing the password logs everyone out)
function signingKey() {
  const stored = readStoredPassword();
  const base = process.env.ADMIN_SESSION_SECRET || (stored ? stored.hash : getAdminSecret());
  return crypto.createHash('sha256').update('lora-admin-session|' + base).digest();
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function checkPassword(password) {
  const stored = readStoredPassword();
  if (stored) {
    const h = crypto.scryptSync(String(password || ''), stored.salt, 64).toString('hex');
    return safeEqual(h, stored.hash);
  }
  return safeEqual(password || '', getAdminSecret());
}

function checkAdminCredentials(username, password) {
  const u = String(username || '').trim().toLowerCase();
  const okUser = u === getAdminUsername() || u === 'admin';
  return okUser && checkPassword(password);
}

function createAdminToken() {
  const body = Buffer.from(JSON.stringify({ r: 'admin', exp: Date.now() + SESSION_TTL_MS, n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
  const sig = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
  return `lora1.${body}.${sig}`;
}

function verifyAdminToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'lora1') return false;
  const expected = crypto.createHmac('sha256', signingKey()).update(parts[1]).digest('base64url');
  if (!safeEqual(parts[2], expected)) return false;
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return p.r === 'admin' && Number(p.exp) > Date.now();
  } catch (e) { return false; }
}

function verifyAdminAuth(req) {
  if (!req || !req.headers) return false;
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || req.headers['x-admin-token'] || '';
  const token = String(authHeader).replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  if (verifyAdminToken(token)) return true;
  // Optional long-lived token for server scripts / integrations (only if explicitly configured, min 24 chars)
  const apiToken = (process.env.ADMIN_AUTH_TOKEN || '').trim();
  return apiToken.length >= 24 && safeEqual(token, apiToken);
}

function getIntegrationStatus() {
  const rzpKeyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const rzpSecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  const rzpConfigured = Boolean(rzpKeyId && rzpSecret);
  const rzpMode = process.env.RAZORPAY_MODE || (rzpKeyId.startsWith('rzp_live_') ? 'live' : 'test');

  const otpLib = require('./otp/_lib.js');
  const otpSettings = otpLib.readOtpSettings();
  const smsStatus = otpLib.smsProviderStatus(otpSettings.sms.provider, otpSettings);
  const smsProvider = smsStatus.provider;
  const smsSenderId = otpSettings.sms.senderId;
  const smsConfigured = smsStatus.configured;

  const waProvider = (process.env.WHATSAPP_PROVIDER || 'META_CLOUD').trim();
  const isFast2SmsWa = waProvider.toUpperCase() === 'FAST2SMS' || waProvider.toUpperCase().includes('FAST2SMS');
  const waToken = (process.env.WHATSAPP_API_TOKEN || '').trim();
  const waPhoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const fastKey = (process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY || '').trim();
  const waConfigured = isFast2SmsWa ? Boolean(waToken || fastKey) : Boolean(waToken && waPhoneId);

  const smtpHost = (process.env.SMTP_HOST || '').trim();
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const emailConfigured = Boolean(smtpHost && smtpUser && smtpPass);

  return {
    razorpay: {
      configured: rzpConfigured,
      mode: rzpMode,
      key_id_preview: rzpKeyId ? (rzpKeyId.slice(0, 8) + '••••' + rzpKeyId.slice(-4)) : null,
      secret_configured: Boolean(rzpSecret),
      theme_color: process.env.RAZORPAY_THEME_COLOR || '#00B4D8'
    },
    sms: {
      configured: smsConfigured,
      provider: smsProvider,
      sender_id: smsSenderId,
      vars: smsStatus.vars,
      message: smsStatus.message
    },
    whatsapp: {
      configured: waConfigured,
      provider: waProvider,
      phone_id: waPhoneId ? (waPhoneId.slice(0, 4) + '••••') : (isFast2SmsWa && waConfigured ? 'Fast2SMS WABA' : null)
    },
    email: {
      configured: emailConfigured,
      host: smtpHost || null,
      user_preview: smtpUser ? (smtpUser.includes('@') ? smtpUser.replace(/^(.)(.*)(@.*)$/, '$1•••$3') : 'configured') : null
    },
    database: {
      configured: Boolean(process.env.DATABASE_URL),
      storage_type: process.env.DATABASE_URL ? 'external_sql' : 'persistent_disk_json'
    }
  };
}

module.exports = {
  verifyAdminAuth,
  getIntegrationStatus,
  getAdminSecret,
  checkAdminCredentials,
  createAdminToken,
  verifyAdminToken,
  usingDefaultPassword,
  checkPassword,
  setAdminPassword
};
