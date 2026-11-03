// /api/admin-login — server-side admin authentication (Vercel + preview/server.js)
// POST { username, password } -> { success, token, expiresInHours }
const { checkAdminCredentials, createAdminToken, verifyAdminAuth, usingDefaultPassword, checkPassword, setAdminPassword } = require('./auth.js');

// Brute-force protection: max 8 failed attempts per IP per 15 minutes
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;

function clientIp(req) {
  const xf = (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || '';
  return String(xf).split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: check whether the current token is still valid
  if (req.method === 'GET') {
    return res.status(200).json({ success: true, valid: verifyAdminAuth(req), defaultPassword: usingDefaultPassword() });
  }
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const ip = clientIp(req);
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && now - rec.first < WINDOW_MS && rec.count >= MAX_FAILS) {
    const mins = Math.ceil((WINDOW_MS - (now - rec.first)) / 60000);
    return res.status(429).json({ success: false, message: `Too many failed attempts. Try again in ${mins} minute(s).` });
  }

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  // Change password (must be logged in AND know the current password)
  if (body.action === 'change_password') {
    if (!verifyAdminAuth(req)) return res.status(401).json({ success: false, message: 'Please sign in again.' });
    if (!checkPassword(body.current)) {
      await new Promise(r => setTimeout(r, 600));
      return res.status(400).json({ success: false, message: 'Current password does not match.' });
    }
    const next = String(body.next || '');
    if (next.length < 10 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
      return res.status(400).json({ success: false, message: 'New password must be at least 10 characters and include letters and numbers.' });
    }
    try { setAdminPassword(next); } catch (e) {
      return res.status(500).json({ success: false, message: 'Could not save password on server: ' + e.message });
    }
    // Signing key changed → all old sessions are invalid; return a fresh token for this browser
    return res.status(200).json({ success: true, token: createAdminToken(), message: 'Password updated. Other devices have been signed out.' });
  }

  if (!checkAdminCredentials(body.username, body.password)) {
    if (!rec || now - rec.first >= WINDOW_MS) attempts.set(ip, { first: now, count: 1 });
    else rec.count++;
    await new Promise(r => setTimeout(r, 600)); // slow down guessing
    return res.status(401).json({ success: false, message: 'Invalid username or password.' });
  }

  attempts.delete(ip);
  return res.status(200).json({ success: true, token: createAdminToken(), expiresInHours: 12, defaultPassword: usingDefaultPassword() });
};
