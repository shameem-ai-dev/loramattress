// Vercel Serverless Function: /api/orders
// Handles authoritative order synchronization from customer storefront and admin dashboard
const fs = require('fs');
const path = require('path');
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
      return res.status(200).json({ success: true, orders, isAdmin: true });
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

  // DELETE: Admin-only reset of all orders for live launch
  if (req.method === 'DELETE') {
    if (!verifyAdminAuth(req)) {
      return res.status(401).json({ success: false, message: 'Unauthorized: admin access required to reset orders.' });
    }
    orders = [];
    memoryOrders = [];
    persistOrdersToDisk([]);
    return res.status(200).json({ success: true, message: 'All order records have been reset.', orders: [] });
  }

  // POST or PUT: Update, create or reset orders
  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

      // Admin reset action via POST
      if (payload.action === 'reset_all' || payload.reset === true) {
        if (!verifyAdminAuth(req)) {
          return res.status(401).json({ success: false, message: 'Unauthorized: admin access required to reset orders.' });
        }
        orders = [];
        memoryOrders = [];
        persistOrdersToDisk([]);
        return res.status(200).json({ success: true, message: 'All order records have been reset to zero.', orders: [] });
      }

      const toAdd = Array.isArray(payload.orders)
        ? payload.orders
        : (payload.order ? [payload.order] : (payload.id ? [payload] : []));

      if (toAdd.length === 0 && payload && typeof payload === 'object' && payload.id) {
        toAdd.push(payload);
      }

      const orderMap = new Map();
      orders.forEach(o => { if (o && o.id) orderMap.set(o.id, o); });

      // Checkout verification enforced server-side: brand-new orders need a verified phone session
      const newOrders = toAdd.filter(o => o && o.id && !orderMap.has(o.id));
      const denied = otpLib.authorizeNewOrders(req, newOrders, verifyAdminAuth(req));
      if (denied) {
        return res.status(denied.status).json({ success: false, code: denied.code, message: denied.message });
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
        orders
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid order payload: ' + err.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
};
