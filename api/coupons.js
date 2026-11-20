// /api/coupons — storewide coupon codes
//   GET  /api/coupons                 public: active coupons marked "show at checkout"
//                                     admin (Authorization): every coupon incl. usage
//   POST /api/coupons                 admin: save the full coupon list  { coupons: [...] }
//   POST /api/coupons/validate        public: { code, amount } → discount + final price
//   POST /api/coupons/redeem          public: { code, orderId } → counts one use (idempotent per order)
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'config', 'coupons.json');
const DEFAULTS = [
  { code: 'LORA10', type: 'percent', value: 10, minOrder: 0, maxDiscount: 0, usageLimit: 0, usedCount: 0, expiresAt: '', active: true, showAtCheckout: true, description: '10% off on any mattress' }
];
let memory = null;

function load() {
  if (memory) return memory;
  try {
    if (fs.existsSync(FILE)) {
      const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (Array.isArray(d.coupons)) { memory = d; return memory; }
    }
  } catch (e) { console.warn('[COUPONS] read warning:', e.message); }
  memory = { coupons: DEFAULTS.map(c => ({ ...c })), redeemed: {} };
  return memory;
}
function save(d) {
  memory = d;
  try { fs.writeFileSync(FILE, JSON.stringify(d, null, 2), 'utf8'); return true; }
  catch (e) { console.warn('[COUPONS] write warning (memory only):', e.message); return false; }
}

const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
function clean(c) {
  const type = c.type === 'flat' ? 'flat' : 'percent';
  let value = Math.max(0, Number(c.value) || 0);
  if (type === 'percent') value = Math.min(value, 90);
  return {
    code: normCode(c.code),
    type, value,
    minOrder: Math.max(0, Math.round(Number(c.minOrder) || 0)),
    maxDiscount: Math.max(0, Math.round(Number(c.maxDiscount) || 0)),
    usageLimit: Math.max(0, Math.round(Number(c.usageLimit) || 0)),
    usedCount: Math.max(0, Math.round(Number(c.usedCount) || 0)),
    expiresAt: c.expiresAt ? String(c.expiresAt).slice(0, 30) : '',
    active: c.active !== false,
    showAtCheckout: c.showAtCheckout !== false,
    description: String(c.description || '').slice(0, 120)
  };
}

function expired(c) {
  if (!c.expiresAt) return false;
  const t = new Date(c.expiresAt.length <= 10 ? c.expiresAt + 'T23:59:59+05:30' : c.expiresAt).getTime();
  return !isNaN(t) && Date.now() > t;
}

function evaluate(c, amount) {
  amount = Math.max(0, Math.round(Number(amount) || 0));
  if (!c || !c.active) return { valid: false, message: 'This coupon code is not valid.' };
  if (expired(c)) return { valid: false, message: 'This coupon has expired.' };
  if (c.usageLimit && c.usedCount >= c.usageLimit) return { valid: false, message: 'This coupon has reached its usage limit.' };
  if (c.minOrder && amount < c.minOrder) {
    return { valid: false, shortBy: c.minOrder - amount, message: `Add ₹${(c.minOrder - amount).toLocaleString('en-IN')} more to use ${c.code} (min order ₹${c.minOrder.toLocaleString('en-IN')}).` };
  }
  let discount = c.type === 'flat' ? c.value : Math.round(amount * c.value / 100);
  if (c.maxDiscount) discount = Math.min(discount, c.maxDiscount);
  discount = Math.min(discount, Math.max(0, amount - 500)); // never below ₹500 (payment gateway minimum)
  return { valid: discount > 0, code: c.code, discount, finalAmount: amount - discount, message: discount > 0 ? `${c.code} applied — you save ₹${discount.toLocaleString('en-IN')}` : 'Coupon not applicable.' };
}

function publicView(c) {
  return { code: c.code, type: c.type, value: c.value, minOrder: c.minOrder, maxDiscount: c.maxDiscount, expiresAt: c.expiresAt, description: c.description };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const url = String(req.url || '');
  const sub = url.split('?')[0].replace(/^\/api\/coupons\/?/, '');
  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const isAdmin = () => { try { return require('./auth.js').verifyAdminAuth(req); } catch (e) { return false; } };
  const d = load();

  if (req.method === 'GET' && !sub) {
    if (isAdmin()) return res.status(200).json({ success: true, coupons: d.coupons });
    const list = d.coupons.filter(c => c.active && c.showAtCheckout && !expired(c) && !(c.usageLimit && c.usedCount >= c.usageLimit)).map(publicView);
    return res.status(200).json({ success: true, coupons: list });
  }

  if (req.method === 'POST' && sub === 'validate') {
    const code = normCode(body.code);
    const c = d.coupons.find(x => x.code === code);
    return res.status(200).json({ success: true, ...evaluate(c, body.amount) });
  }

  if (req.method === 'POST' && sub === 'redeem') {
    const code = normCode(body.code);
    const orderId = String(body.orderId || '').slice(0, 64);
    const c = d.coupons.find(x => x.code === code);
    if (!c || !orderId) return res.status(200).json({ success: false });
    d.redeemed = d.redeemed || {};
    if (!d.redeemed[orderId]) {
      d.redeemed[orderId] = code;
      c.usedCount = (c.usedCount || 0) + 1;
      save(d);
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'POST' && !sub) {
    if (!isAdmin()) return res.status(401).json({ success: false, message: 'Unauthorized: admin login required.' });
    const list = Array.isArray(body.coupons) ? body.coupons.map(clean).filter(c => c.code && c.value > 0) : null;
    if (!list) return res.status(400).json({ success: false, message: 'coupons array required' });
    const seen = new Set();
    const unique = list.filter(c => !seen.has(c.code) && seen.add(c.code));
    const saved = save({ coupons: unique, redeemed: d.redeemed || {} });
    return res.status(200).json({ success: true, persisted: saved, coupons: unique });
  }

  return res.status(404).json({ success: false, message: 'Not found' });
};
module.exports.evaluate = evaluate;
