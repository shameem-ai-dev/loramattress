// Vercel Serverless Function: /api/orders
// Handles order synchronization from customer storefront and admin dashboard

let memoryOrders = [];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Return orders list
  if (req.method === 'GET') {
    return res.status(200).json({ success: true, orders: memoryOrders });
  }

  // POST: Receive new order or sync list of orders
  if (req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const toAdd = Array.isArray(payload.orders) ? payload.orders : (payload.order ? [payload.order] : [payload]);

      const orderMap = new Map();
      memoryOrders.forEach(o => { if (o && o.id) orderMap.set(o.id, o); });

      toAdd.forEach(newO => {
        if (newO && newO.id) {
          if (orderMap.has(newO.id)) {
            orderMap.set(newO.id, { ...orderMap.get(newO.id), ...newO });
          } else {
            orderMap.set(newO.id, newO);
          }
        }
      });

      memoryOrders = Array.from(orderMap.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      return res.status(200).json({
        success: true,
        message: `Successfully synchronized ${toAdd.length} order(s).`,
        orders: memoryOrders
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid order payload: ' + err.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
};
