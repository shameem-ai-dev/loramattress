// Vercel Serverless Function: /api/orders
// Handles authoritative order synchronization from customer storefront and admin dashboard
const fs = require('fs');
const path = require('path');

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let orders = getOrders();

  // GET: Return all orders
  if (req.method === 'GET') {
    return res.status(200).json({ success: true, orders });
  }

  // POST or PUT: Update or create orders
  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const toAdd = Array.isArray(payload.orders)
        ? payload.orders
        : (payload.order ? [payload.order] : (payload.id ? [payload] : []));

      if (toAdd.length === 0 && payload && typeof payload === 'object' && payload.id) {
        toAdd.push(payload);
      }

      const orderMap = new Map();
      orders.forEach(o => { if (o && o.id) orderMap.set(o.id, o); });

      toAdd.forEach(newO => {
        if (newO && newO.id) {
          if (orderMap.has(newO.id)) {
            orderMap.set(newO.id, { ...orderMap.get(newO.id), ...newO });
          } else {
            orderMap.set(newO.id, newO);
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
