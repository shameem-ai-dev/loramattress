// Vercel Serverless Function: /api/orders
// Handles authoritative order synchronization from customer storefront and admin dashboard
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { verifyAdminAuth } = require('./auth.js');
const otpLib = require('./otp/_lib.js');

const ORDERS_FILE = path.join(__dirname, '..', 'config', 'orders_data.json');
let memoryOrders = null;

function loadOrdersFromDisk() {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const data = fs.readFileSync(ORDERS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[API/ORDERS] Read warning:', err.message);
  }
  return [];
}

function persistOrdersToDisk(ordersList) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(ordersList, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('[API/ORDERS] Write warning (fallback to memory):', err.message);
    return false;
  }
}

function getOrders() {
  if (!memoryOrders || memoryOrders.length === 0) {
    memoryOrders = loadOrdersFromDisk();
  }
  return memoryOrders;
}

// ---- Permanent Recycle Bin (never auto-purged, no permanent-delete route) ----
const TRASH_FILE = path.join(__dirname, '..', 'config', 'orders_trash.json');
function readTrash() {
  try {
    if (fs.existsSync(TRASH_FILE)) {
      const d = JSON.parse(fs.readFileSync(TRASH_FILE, 'utf8'));
      if (Array.isArray(d)) return d;
    }
  } catch (e) { console.warn('[API/ORDERS] Trash read warning:', e.message); }
  return [];
}
function writeTrash(list) {
  fs.writeFileSync(TRASH_FILE, JSON.stringify(list, null, 2), 'utf8');
}
// Move orders into the bin. Trash is written FIRST so data can never be lost.
function moveToTrash(orders, ids, all, reason) {
  const idSet = new Set(ids || []);
  const moving = all ? orders : orders.filter(o => idSet.has(o.id));
  if (!moving.length) return { moved: 0, remaining: orders };
  const now = new Date().toISOString();
  const batchId = 'del-' + Date.now();
  const trash = moving.map(o => ({ ...o, deletedAt: now, deleteReason: reason || 'Deleted by admin', deleteBatch: batchId })).concat(readTrash());
  writeTrash(trash);
  const remaining = all ? [] : orders.filter(o => !idSet.has(o.id));
  memoryOrders = remaining;
  persistOrdersToDisk(remaining);
  return { moved: moving.length, remaining, batchId };
}

function readPaymentSettings() {
  try {
    const p = path.join(__dirname, '..', 'config', 'payment_settings.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')) || {};
  } catch (e) {}
  return {};
}

function rzpGet(urlPath, keyId, keySecret) {
  return new Promise(resolve => {
    const r = https.request({
      hostname: 'api.razorpay.com', port: 443, path: urlPath, method: 'GET', timeout: 8000,
      headers: { Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64') }
    }, resp => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => { try { resolve(resp.statusCode < 300 ? JSON.parse(d) : null); } catch (e) { resolve(null); } });
    });
    r.on('error', () => resolve(null));
    r.on('timeout', () => { r.destroy(); resolve(null); });
    r.end();
  });
}

// Re-verify an online payment on the server: valid signature AND Razorpay confirms the amount was paid
async function verifyRazorpayPayment(o) {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  const orderId = String(o.razorpayOrderId || '').trim();
  const paymentId = String(o.paymentId || '').trim();
  const sig = String(o.razorpaySignature || '').trim();
  if (!keySecret) return { ok: false, reason: 'gateway keys not configured' };
  if (!orderId || !paymentId || !sig) return { ok: false, reason: 'missing payment proof' };
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'invalid signature' };
  const rzpOrder = await rzpGet(`/v1/orders/${encodeURIComponent(orderId)}`, keyId, keySecret);
  if (!rzpOrder) return { ok: false, reason: 'could not confirm amount with Razorpay' };
  const expectedPaise = Math.round((Number(o.totalPrice) || 0) * 100);
  if (Number(rzpOrder.amount_paid) < expectedPaise) {
    return { ok: false, reason: `paid ₹${(Number(rzpOrder.amount_paid) / 100).toLocaleString('en-IN')} but order total is ₹${(expectedPaise / 100).toLocaleString('en-IN')}` };
  }
  return { ok: true };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Customer-Session');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let orders = getOrders();

  // GET: Return orders based on authorization level (Admin gets all, Customer gets only their own)
  if (req.method === 'GET') {
    const isAdmin = verifyAdminAuth(req);
    if (isAdmin) {
      let wantTrash = false;
      try { wantTrash = new URL(req.url || '/', 'http://localhost').searchParams.get('trash') === '1'; } catch (e) {}
      if (wantTrash || (req.query && req.query.trash === '1')) {
        return res.status(200).json({ success: true, trash: readTrash() });
      }
      return res.status(200).json({ success: true, orders, isAdmin: true, trashIds: readTrash().map(t => t.id) });
    }

    const session = otpLib.verifyCustomerToken(otpLib.getCustomerTokenFromReq(req));
    if (session && session.phone) {
      const verifiedLast10 = otpLib.last10(session.phone);
      const customerOrders = orders.filter(o => otpLib.last10(o.phone) === verifiedLast10);
      return res.status(200).json({ success: true, orders: customerOrders, customerPhone: session.phone });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication required to access order records.',
      orders: []
    });
  }

  // DELETE: Admin-only reset — orders are moved to the permanent recycle bin
  if (req.method === 'DELETE') {
    if (!verifyAdminAuth(req)) {
      return res.status(401).json({ success: false, message: 'Unauthorized: admin access required to reset orders.' });
    }
    try {
      const r = moveToTrash(orders, null, true, 'Sales data reset');
      return res.status(200).json({ success: true, message: `${r.moved} order(s) moved to Recycle Bin.`, moved: r.moved, orders: [] });
    } catch (e) {
      return res.status(500).json({ success: false, message: 'Could not write recycle bin: ' + e.message });
    }
  }

  // POST or PUT: Update, create or reset orders
  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

      // Admin recycle-bin actions: reset_all / delete / restore
      if (['reset_all', 'delete', 'restore'].includes(payload.action) || payload.reset === true) {
        if (!verifyAdminAuth(req)) {
          return res.status(401).json({ success: false, message: 'Unauthorized: admin access required.' });
        }
        if (payload.action === 'restore') {
          const trash = readTrash();
          const idSet = new Set(payload.ids || []);
          const restoring = payload.all ? trash : trash.filter(t => idSet.has(t.id) && (!payload.batch || t.deleteBatch === payload.batch));
          if (!restoring.length) return res.status(404).json({ success: false, message: 'Nothing to restore.' });
          const existing = new Set(orders.map(o => o.id));
          const restored = restoring.filter(t => !existing.has(t.id))
            .map(({ deletedAt, deleteReason, deleteBatch, ...o }) => ({ ...o, restoredAt: new Date().toISOString() }));
          orders = restored.concat(orders).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          memoryOrders = orders;
          persistOrdersToDisk(orders);
          const restoredSet = new Set(restoring);
          writeTrash(trash.filter(t => !restoredSet.has(t)));
          return res.status(200).json({ success: true, restored: restored.length, orders });
        }
        const all = payload.action === 'reset_all' || payload.reset === true;
        const r = moveToTrash(orders, payload.ids, all, payload.reason || (all ? 'Sales data reset' : 'Deleted by admin'));
        orders = r.remaining;
        return res.status(200).json({ success: true, message: `${r.moved} order(s) moved to Recycle Bin.`, moved: r.moved, orders });
      }

      let toAdd = Array.isArray(payload.orders)
        ? payload.orders
        : (payload.order ? [payload.order] : (payload.id ? [payload] : []));

      if (toAdd.length === 0 && payload && typeof payload === 'object' && payload.id) {
        toAdd.push(payload);
      }

      const orderMap = new Map();
      orders.forEach(o => { if (o && o.id) orderMap.set(o.id, o); });

      // Deleted orders stay in the bin: stale browser caches can't push them back (use Restore instead)
      const trashedIds = new Set(readTrash().map(t => t.id));
      for (let i = toAdd.length - 1; i >= 0; i--) {
        if (toAdd[i] && trashedIds.has(toAdd[i].id) && !orderMap.has(toAdd[i].id)) toAdd.splice(i, 1);
      }

      // Checkout verification enforced server-side: brand-new orders need a verified phone session
      const isAdmin = verifyAdminAuth(req);
      const newOrders = toAdd.filter(o => o && o.id && !orderMap.has(o.id));
      const denied = otpLib.authorizeNewOrders(req, newOrders, isAdmin);
      if (denied) {
        return res.status(denied.status).json({ success: false, code: denied.code, message: denied.message });
      }

      // Customers (non-admin) may ONLY create brand-new orders — never edit existing ones
      if (!isAdmin) {
        toAdd = newOrders.slice(0, 3);
        const pay = readPaymentSettings();
        for (const o of toAdd) {
          const nowIso = new Date().toISOString();
          const isCod = /cod|cash/i.test(String(o.paymentMethod || ''));
          if (isCod) {
            if (pay.cod_enabled === false) {
              return res.status(400).json({ success: false, code: 'COD_DISABLED', message: 'Cash on Delivery is currently unavailable for this delivery. Please pay online.' });
            }
            const max = Number(pay.cod_max_amount) || 0;
            if (max > 0 && Number(o.totalPrice) > max) {
              return res.status(400).json({ success: false, code: 'COD_LIMIT', message: `Cash on Delivery is available for orders up to ₹${max.toLocaleString('en-IN')}. Please pay online.` });
            }
            o.paymentId = '';
            o.paymentStatus = `COD (Collect ₹${(Math.max(0, Number(o.totalPrice) || 0)).toLocaleString('en-IN')})`;
          } else {
            const v = await verifyRazorpayPayment(o);
            o.paymentVerified = v.ok;
            if (!v.ok) o.paymentStatus = `⚠️ UNVERIFIED PAYMENT — check Razorpay before dispatch (${v.reason})`;
          }
          // Admin-controlled fields can't be set by customers
          o.status = 'Order Received';
          o.createdAt = nowIso;
          o.courier = ''; o.awb = ''; o.dispatchDate = ''; o.expectedDelivery = ''; o.dispatchNotes = '';
          o.statusHistory = [{ status: 'Order Received', timestamp: nowIso, staff: 'Customer Online Storefront', notes: isCod ? 'Order placed via Cash on Delivery.' : (o.paymentVerified ? `Payment verified with Razorpay (${o.paymentId}).` : 'Online payment could NOT be verified — confirm in Razorpay dashboard.') }];
          delete o.razorpaySignature;
          delete o.auditLog; delete o.deletedAt; delete o.restoredAt;
        }
      }

      // Sanitize inputs
      const sanitizeStr = (s, maxLen = 250) => String(s || '').replace(/<[^>]*>?/gm, '').trim().slice(0, maxLen);

      toAdd.forEach(newO => {
        if (newO && newO.id) {
          const cleanO = {
            ...newO,
            id: sanitizeStr(newO.id, 50),
            customerName: sanitizeStr(newO.customerName, 100),
            phone: sanitizeStr(newO.phone, 30),
            email: sanitizeStr(newO.email, 100),
            address: sanitizeStr(newO.address, 500),
            productName: sanitizeStr(newO.productName, 120),
            size: sanitizeStr(newO.size, 150),
            orderNotes: sanitizeStr(newO.orderNotes, 500),
            totalPrice: Math.max(0, Number(newO.totalPrice) || 0),
            quantity: Math.max(1, Number(newO.quantity) || 1)
          };

          if (orderMap.has(cleanO.id)) {
            orderMap.set(cleanO.id, { ...orderMap.get(cleanO.id), ...cleanO });
          } else {
            orderMap.set(cleanO.id, cleanO);
          }
        }
      });

      orders = Array.from(orderMap.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      memoryOrders = orders;
      persistOrdersToDisk(orders);

      return res.status(200).json({
        success: true,
        message: `Successfully synchronized ${toAdd.length} order(s).`,
        // Customers only get back what they submitted — never the full order book
        orders: isAdmin ? orders : toAdd.map(o => orderMap.get(String(o.id).slice(0, 50))).filter(Boolean)
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid order payload: ' + err.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
};
