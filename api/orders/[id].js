// Vercel dynamic route handler for /api/orders/[id]
const ordersHandler = require('../orders.js');

module.exports = async function handler(req, res) {
  return ordersHandler(req, res);
};
