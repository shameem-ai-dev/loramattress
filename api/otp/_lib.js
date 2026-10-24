// LORA Mattress — Shared OTP helpers (not a route: files prefixed with "_" are ignored by Vercel)
// - Provider settings persistence (non-secret values only)
// - Indian phone normalisation (+91)
// - Twilio Verify client (secrets read ONLY from process.env, never logged or returned)
// - Signed customer session tokens (used to enforce checkout verification server-side)
// - In-memory rate limiting, cooldowns and in-flight de-duplication

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', '..', 'config');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'otp_settings.json');
const SECRET_FILE = path.join(CONFIG_DIR, '.customer_session_secret');

const SMS_PROVIDERS = ['Twilio', 'MSG91', 'Fast2SMS', 'Firebase', 'Custom API'];

// Server-side limits (cannot be changed from the browser)
const LIMITS = {
  resendCooldownSec: 30,          // min gap between sends to the same number
  maxSendsPerPhonePerHour: 5,
  maxSendsPerIpPerHour: 15,
  maxVerifyAttemptsPer15Min: 5,
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000 // verified checkout session lifetime (7 days)
};

// ---------------------------------------------------------------------------
// Phone helpers
// ---------------------------------------------------------------------------
function normalizeIndianPhone(input) {
  if (!input) return null;
  let digits = String(input).replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return '+91' + digits;
}

function last10(phone) {
  return String(phone || '').replace(/[^0-9]/g, '').slice(-10);
}

function maskPhone(e164) {
  const d = last10(e164);
  return d ? `+91 ${d.slice(0, 2)}••••••${d.slice(-2)}` : '';
}

// ---------------------------------------------------------------------------
// Provider settings (non-secret)
// ---------------------------------------------------------------------------
function canonicalProvider(name) {
  const v = String(name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (v.startsWith('twilio')) return 'Twilio';
  if (v.startsWith('msg91')) return 'MSG91';
  if (v.startsWith('fast2sms')) return 'Fast2SMS';
  if (v.startsWith('firebase')) return 'Firebase';
  if (v.startsWith('custom')) return 'Custom API';
  return null;
}

const WA_PROVIDERS = ['Twilio', 'Fast2SMS', 'Meta WhatsApp Cloud API', 'Gupshup', 'Interakt', 'WATI', 'Custom WhatsApp API'];
function canonicalWaProvider(name) {
  const v = String(name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!v) return null;
  if (v.startsWith('twilio')) return 'Twilio';
  if (v.startsWith('fast2sms')) return 'Fast2SMS';
  if (v.startsWith('meta') || v === 'metacloud') return 'Meta WhatsApp Cloud API';
  if (v.startsWith('gupshup')) return 'Gupshup';
  if (v.startsWith('interakt')) return 'Interakt';
  if (v.startsWith('wati')) return 'WATI';
  if (v.startsWith('custom')) return 'Custom WhatsApp API';
  return null;
}

let memorySettings = null;

function readOtpSettings() {
  let saved = null;
  try {
    if (fs.existsSync(SETTINGS_FILE)) saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch (e) { saved = null; }
  if (!saved && memorySettings) saved = memorySettings;
  saved = saved || {};
  const sms = saved.sms || {};
  const wa = saved.whatsapp || {};
  return {
    sms: {
      provider: canonicalProvider(sms.provider) || canonicalProvider(process.env.SMS_PROVIDER) || 'Fast2SMS',
      senderId: String(sms.senderId || process.env.SMS_SENDER_ID || 'LORAMT').slice(0, 11),
      templateId: String(sms.templateId || process.env.MSG91_TEMPLATE_ID || process.env.SMS_TEMPLATE_ID || '').slice(0, 64),
      endpoint: String(sms.endpoint || 'https://control.msg91.com/api/v5/otp').slice(0, 200)
    },
    whatsapp: {
      provider: canonicalWaProvider(wa.provider) || canonicalWaProvider(process.env.WHATSAPP_PROVIDER) || ((process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY) ? 'Fast2SMS' : 'Meta WhatsApp Cloud API'),
      templateName: String(wa.templateName || process.env.WHATSAPP_TEMPLATE_NAME || 'lora_auth_otp').slice(0, 64),
      templateLang: String(wa.templateLang || 'en').slice(0, 10)
    },
    updatedAt: saved.updatedAt || null
  };
}

function saveOtpSettings(input) {
  const current = readOtpSettings();
  const next = { sms: { ...current.sms }, whatsapp: { ...current.whatsapp }, updatedAt: new Date().toISOString() };
  if (input && input.sms) {
    const sms = input.sms;
    const provider = canonicalProvider(sms.provider);
    if (!provider) throw new Error(`Unknown SMS provider. Allowed: ${SMS_PROVIDERS.join(', ')}.`);
    next.sms = {
      provider,
      senderId: typeof sms.senderId === 'string' ? sms.senderId.trim().slice(0, 11) : current.sms.senderId,
      templateId: typeof sms.templateId === 'string' ? sms.templateId.trim().slice(0, 64) : current.sms.templateId,
      endpoint: typeof sms.endpoint === 'string' ? sms.endpoint.trim().slice(0, 200) : current.sms.endpoint
    };
  }
  if (input && input.whatsapp) {
    const wa = input.whatsapp;
    const provider = canonicalWaProvider(wa.provider);
    if (!provider) throw new Error(`Unknown WhatsApp provider. Allowed: ${WA_PROVIDERS.join(', ')}.`);
    next.whatsapp = {
      provider,
      templateName: typeof wa.templateName === 'string' ? wa.templateName.trim().slice(0, 64) : current.whatsapp.templateName,
      templateLang: typeof wa.templateLang === 'string' ? wa.templateLang.trim().slice(0, 10) : current.whatsapp.templateLang
    };
  }
  memorySettings = next;
  let persisted = false;
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf8');
    persisted = true;
  } catch (e) { /* read-only FS (e.g. serverless) — kept in memory */ }
  return { settings: readOtpSettings(), persisted };
}

// ---------------------------------------------------------------------------
// Provider configuration status (booleans only — never values)
// ---------------------------------------------------------------------------
function env(name) { return String(process.env[name] || '').trim(); }

function twilioEnvStatus() {
  const sid = env('TWILIO_ACCOUNT_SID');
  const token = env('TWILIO_AUTH_TOKEN');
  const svc = env('TWILIO_VERIFY_SERVICE_SID');
  const problems = [];
  if (!sid) problems.push('TWILIO_ACCOUNT_SID is not set');
  else if (!/^AC[0-9a-fA-F]{32}$/.test(sid)) problems.push('TWILIO_ACCOUNT_SID looks malformed (should start with "AC" and be 34 characters)');
  if (!token) problems.push('TWILIO_AUTH_TOKEN is not set');
  if (!svc) problems.push('TWILIO_VERIFY_SERVICE_SID is not set');
  else if (!/^VA[0-9a-fA-F]{32}$/.test(svc)) problems.push('TWILIO_VERIFY_SERVICE_SID looks malformed (should start with "VA" and be 34 characters)');
  return {
    configured: problems.length === 0,
    vars: {
      TWILIO_ACCOUNT_SID: Boolean(sid),
      TWILIO_AUTH_TOKEN: Boolean(token),
      TWILIO_VERIFY_SERVICE_SID: Boolean(svc)
    },
    problems
  };
}

function smsProviderStatus(provider, settings) {
  settings = settings || readOtpSettings();
  provider = provider || settings.sms.provider;
  if (provider === 'Twilio') {
    const s = twilioEnvStatus();
    return { provider, ...s, message: s.configured ? 'Twilio Verify credentials found in server environment.' : s.problems.join('; ') + '.' };
  }
  if (provider === 'MSG91') {
    const hasKey = Boolean(env('SMS_API_KEY'));
    const hasTpl = Boolean(settings.sms.templateId);
    const problems = [];
    if (!hasKey) problems.push('SMS_API_KEY is not set');
    if (!hasTpl) problems.push('DLT / MSG91 template ID is empty');
    return { provider, configured: problems.length === 0, vars: { SMS_API_KEY: hasKey }, problems,
      message: problems.length ? problems.join('; ') + '.' : 'MSG91 key and template found.' };
  }
  if (provider === 'Fast2SMS') {
    const hasKey = Boolean(env('SMS_API_KEY') || env('FAST2SMS_API_KEY'));
    return { provider, configured: hasKey, vars: { SMS_API_KEY: hasKey }, problems: hasKey ? [] : ['SMS_API_KEY is not set'],
      message: hasKey ? 'Fast2SMS key found in server environment.' : 'SMS_API_KEY is not set.' };
  }
  return { provider, configured: false, vars: {}, problems: [`${provider} is not supported for server-side SMS OTP`],
    message: `${provider} is not supported for server-side SMS OTP. Please select Twilio, MSG91 or Fast2SMS.` };
}

function waProviderStatus(provider, settings) {
  settings = settings || readOtpSettings();
  provider = canonicalWaProvider(provider) || settings.whatsapp.provider;
  if (provider === 'Twilio') {
    const s = twilioEnvStatus();
    return { provider, ...s, message: s.configured
      ? 'Twilio Verify credentials found. WhatsApp must also be enabled on your Twilio Verify service (Verify → Services → WhatsApp).'
      : s.problems.join('; ') + '.' };
  }
  if (provider === 'Fast2SMS') {
    const hasKey = Boolean(env('FAST2SMS_API_KEY') || env('WHATSAPP_API_TOKEN') || env('SMS_API_KEY'));
    const hasId = Boolean(env('FAST2SMS_OTP_ID') || env('FAST2SMS_WHATSAPP_MESSAGE_ID') || env('WHATSAPP_TEMPLATE_NAME'));
    const problems = [];
    if (!hasKey) problems.push('FAST2SMS_API_KEY (or SMS_API_KEY) is not set');
    if (!hasId) problems.push('FAST2SMS_OTP_ID is not set (approved WhatsApp OTP template)');
    return { provider, configured: hasKey, vars: { FAST2SMS_API_KEY: hasKey, FAST2SMS_OTP_ID: hasId }, problems,
      message: problems.length ? problems.join('; ') + '.' : 'Fast2SMS WhatsApp key and template found.' };
  }
  if (provider === 'Meta WhatsApp Cloud API') {
    const t = Boolean(env('WHATSAPP_API_TOKEN')); const id = Boolean(env('WHATSAPP_PHONE_NUMBER_ID'));
    const problems = [];
    if (!t) problems.push('WHATSAPP_API_TOKEN is not set');
    if (!id) problems.push('WHATSAPP_PHONE_NUMBER_ID is not set');
    return { provider, configured: t && id, vars: { WHATSAPP_API_TOKEN: t, WHATSAPP_PHONE_NUMBER_ID: id }, problems,
      message: problems.length ? problems.join('; ') + '.' : 'Meta WhatsApp Cloud API credentials found.' };
  }
  return { provider, configured: false, vars: {}, problems: [`${provider} is not supported for server-side WhatsApp OTP`],
    message: `${provider} is not supported for server-side WhatsApp OTP. Please select Twilio, Fast2SMS or Meta WhatsApp Cloud API.` };
}

// ---------------------------------------------------------------------------
// Twilio Verify client
// ---------------------------------------------------------------------------
function sanitize(text) {
  return String(text || '')
    .replace(/AC[0-9a-fA-F]{32}/g, 'AC••••')
    .replace(/VA[0-9a-fA-F]{32}/g, 'VA••••')
    .slice(0, 300);
}

const TWILIO_ERRORS = {
  20003: 'Twilio rejected the credentials. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your hosting environment variables.',
  20404: 'Twilio Verify service or verification not found. Check TWILIO_VERIFY_SERVICE_SID, or the code has expired — request a new OTP.',
  20429: 'Twilio is rate limiting requests. Please wait a minute and try again.',
  21211: 'This phone number is not valid.',
  21408: 'SMS to India (+91) is not enabled in your Twilio Geo Permissions. Enable India under Messaging → Settings → Geo permissions.',
  21608: 'Twilio trial accounts can only send to verified numbers. Verify this number in Twilio or upgrade the account.',
  21614: 'This number cannot receive SMS.',
  60200: 'Invalid phone number or code format.',
  60202: 'Too many incorrect codes for this verification. Please request a new OTP.',
  60203: 'Maximum OTP sends reached for this number. Please wait about 10 minutes and try again.',
  60205: 'SMS is not supported for this number (it may be a landline).',
  60212: 'Too many concurrent requests for this number. Please wait and try again.',
  60223: 'WhatsApp is not enabled on your Twilio Verify service. Enable it in Twilio Console → Verify → Services → your service → WhatsApp, or use SMS.',
  60410: 'This number has been temporarily blocked by Twilio fraud protection.'
};

function twilioRequest(method, apiPath, form) {
  const sid = env('TWILIO_ACCOUNT_SID');
  const token = env('TWILIO_AUTH_TOKEN');
  const body = form ? new URLSearchParams(form).toString() : '';
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'verify.twilio.com',
      path: apiPath,
      method,
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Accept': 'application/json',
        ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } : {})
      },
      timeout: 10000
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let data = null;
        try { data = JSON.parse(raw); } catch (e) { data = null; }
        resolve({ statusCode: res.statusCode, data });
      });
    });
    req.on('error', (err) => resolve({ statusCode: 0, data: null, networkError: sanitize(err.message) }));
    req.on('timeout', () => { req.destroy(); resolve({ statusCode: 0, data: null, networkError: 'Twilio request timed out' }); });
    if (form) req.write(body);
    req.end();
  });
}

function twilioError(result) {
  if (result.networkError) return { message: `Could not reach Twilio: ${result.networkError}`, code: null };
  const code = result.data && result.data.code;
  const msg = TWILIO_ERRORS[code] || (result.data && result.data.message ? sanitize(result.data.message) : `Twilio returned HTTP ${result.statusCode}`);
  return { message: msg, code: code || null, httpStatus: result.statusCode };
}

async function twilioSendVerification(phoneE164, channel) {
  const st = twilioEnvStatus();
  if (!st.configured) return { ok: false, configured: false, message: 'Twilio Verify is not configured: ' + st.problems.join('; ') + '.' };
  const r = await twilioRequest('POST', `/v2/Services/${encodeURIComponent(env('TWILIO_VERIFY_SERVICE_SID'))}/Verifications`, { To: phoneE164, Channel: channel === 'whatsapp' ? 'whatsapp' : 'sms' });
  if (r.statusCode >= 200 && r.statusCode < 300 && r.data && r.data.status) {
    return { ok: true, status: r.data.status };
  }
  return { ok: false, configured: true, ...twilioError(r) };
}

async function twilioCheckVerification(phoneE164, code) {
  const st = twilioEnvStatus();
  if (!st.configured) return { ok: false, approved: false, configured: false, message: 'Twilio Verify is not configured: ' + st.problems.join('; ') + '.' };
  const r = await twilioRequest('POST', `/v2/Services/${encodeURIComponent(env('TWILIO_VERIFY_SERVICE_SID'))}/VerificationCheck`, { To: phoneE164, Code: code });
  if (r.statusCode >= 200 && r.statusCode < 300 && r.data) {
    // Authenticate ONLY when Twilio says "approved"
    return { ok: true, approved: r.data.status === 'approved', status: r.data.status };
  }
  return { ok: false, approved: false, configured: true, ...twilioError(r) };
}

async function twilioFetchService() {
  const st = twilioEnvStatus();
  if (!st.configured) return { ok: false, configured: false, message: 'Twilio Verify is not configured: ' + st.problems.join('; ') + '.' };
  const r = await twilioRequest('GET', `/v2/Services/${encodeURIComponent(env('TWILIO_VERIFY_SERVICE_SID'))}`);
  if (r.statusCode === 200 && r.data) {
    return { ok: true, friendlyName: sanitize(r.data.friendly_name || 'Verify Service'), codeLength: r.data.code_length || 6 };
  }
  return { ok: false, configured: true, ...twilioError(r) };
}

// ---------------------------------------------------------------------------
// Customer session tokens (HMAC-SHA256 signed, stateless)
// ---------------------------------------------------------------------------
let cachedSecret = null;
function getSessionSecret() {
  if (cachedSecret) return cachedSecret;
  const fromEnv = env('CUSTOMER_SESSION_SECRET');
  if (fromEnv) return (cachedSecret = fromEnv);
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const s = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (s.length >= 32) return (cachedSecret = s);
    }
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_FILE, generated, { encoding: 'utf8', mode: 0o600 });
    return (cachedSecret = generated);
  } catch (e) {
    return (cachedSecret = crypto.randomBytes(48).toString('hex'));
  }
}

function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }

function issueCustomerToken(phoneE164) {
  const payload = { p: phoneE164, iat: Date.now(), exp: Date.now() + LIMITS.sessionTtlMs, n: crypto.randomBytes(6).toString('hex') };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', getSessionSecret()).update(body).digest());
  return { token: `${body}.${sig}`, phone: phoneE164, expiresAt: payload.exp };
}

function verifyCustomerToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', getSessionSecret()).update(body).digest());
  const a = Buffer.from(sig || ''); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!payload.p || !payload.exp || Date.now() > payload.exp) return null;
    return { phone: payload.p, expiresAt: payload.exp };
  } catch (e) { return null; }
}

function getCustomerTokenFromReq(req) {
  const h = (req && req.headers) || {};
  return String(h['x-customer-session'] || '').trim();
}

// ---------------------------------------------------------------------------
// Rate limiting (in-memory; per server instance)
// ---------------------------------------------------------------------------
global._loraOtpRate = global._loraOtpRate || { phone: new Map(), ip: new Map(), verify: new Map(), inflight: new Set() };
const RATE = global._loraOtpRate;

function clientIp(req) {
  const h = (req && req.headers) || {};
  const fwd = String(h['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || (req && req.socket && req.socket.remoteAddress) || 'unknown';
}

function prune(list, windowMs, now) { return list.filter(t => now - t < windowMs); }

// Returns null when allowed, or { status, message, retryAfter } when blocked.
function checkSendAllowed(key, ip) {
  const now = Date.now();
  if (RATE.inflight.has(key)) {
    return { status: 429, message: 'An OTP request for this number is already in progress. Please wait.', retryAfter: 5 };
  }
  const sends = prune(RATE.phone.get(key) || [], 60 * 60 * 1000, now);
  RATE.phone.set(key, sends);
  const last = sends[sends.length - 1];
  if (last && now - last < LIMITS.resendCooldownSec * 1000) {
    const wait = Math.ceil((LIMITS.resendCooldownSec * 1000 - (now - last)) / 1000);
    return { status: 429, message: `Please wait ${wait}s before requesting another OTP.`, retryAfter: wait };
  }
  if (sends.length >= LIMITS.maxSendsPerPhonePerHour) {
    const wait = Math.ceil((60 * 60 * 1000 - (now - sends[0])) / 1000);
    return { status: 429, message: `Too many OTP requests for this number. Try again in ${Math.ceil(wait / 60)} minute(s).`, retryAfter: wait };
  }
  const ipSends = prune(RATE.ip.get(ip) || [], 60 * 60 * 1000, now);
  RATE.ip.set(ip, ipSends);
  if (ipSends.length >= LIMITS.maxSendsPerIpPerHour) {
    const wait = Math.ceil((60 * 60 * 1000 - (now - ipSends[0])) / 1000);
    return { status: 429, message: `Too many OTP requests from your network. Try again in ${Math.ceil(wait / 60)} minute(s).`, retryAfter: wait };
  }
  return null;
}

function beginSend(key) { RATE.inflight.add(key); }
function endSend(key, ip, succeeded) {
  RATE.inflight.delete(key);
  if (!succeeded) return;
  const now = Date.now();
  RATE.phone.set(key, [...(RATE.phone.get(key) || []), now]);
  RATE.ip.set(ip, [...(RATE.ip.get(ip) || []), now]);
  RATE.verify.delete(key); // fresh code → fresh attempt budget
}

function checkVerifyAllowed(key) {
  const now = Date.now();
  const attempts = prune(RATE.verify.get(key) || [], 15 * 60 * 1000, now);
  RATE.verify.set(key, attempts);
  if (attempts.length >= LIMITS.maxVerifyAttemptsPer15Min) {
    return { status: 429, message: 'Too many incorrect attempts. Please request a new OTP after a few minutes.' };
  }
  return null;
}
function recordVerifyFailure(key) { RATE.verify.set(key, [...(RATE.verify.get(key) || []), Date.now()]); }
function verifyAttemptsLeft(key) { return Math.max(0, LIMITS.maxVerifyAttemptsPer15Min - (RATE.verify.get(key) || []).length); }
function clearVerify(key) { RATE.verify.delete(key); }

// ---------------------------------------------------------------------------
// Checkout enforcement for order writes
// ---------------------------------------------------------------------------
// Returns null when allowed, or { status, message } when the write must be rejected.
function authorizeNewOrders(req, newOrders, isAdmin) {
  if (isAdmin || !newOrders || newOrders.length === 0) return null;
  const session = verifyCustomerToken(getCustomerTokenFromReq(req));
  if (!session) {
    return { status: 401, code: 'PHONE_VERIFICATION_REQUIRED', message: 'Please verify your mobile number with OTP before placing the order.' };
  }
  const verified = last10(session.phone);
  for (const o of newOrders) {
    if (last10(o && o.phone) !== verified) {
      return { status: 403, code: 'PHONE_MISMATCH', message: 'The order phone number does not match your verified number. Please verify this number.' };
    }
  }
  return null;
}

module.exports = {
  LIMITS,
  SMS_PROVIDERS,
  normalizeIndianPhone,
  last10,
  maskPhone,
  canonicalProvider,
  canonicalWaProvider,
  WA_PROVIDERS,
  waProviderStatus,
  readOtpSettings,
  saveOtpSettings,
  twilioEnvStatus,
  smsProviderStatus,
  twilioSendVerification,
  twilioCheckVerification,
  twilioFetchService,
  issueCustomerToken,
  verifyCustomerToken,
  getCustomerTokenFromReq,
  clientIp,
  checkSendAllowed,
  beginSend,
  endSend,
  checkVerifyAllowed,
  recordVerifyFailure,
  verifyAttemptsLeft,
  clearVerify,
  authorizeNewOrders
};
