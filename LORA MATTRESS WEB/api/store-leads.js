// Vercel Serverless Function: /api/store-leads
const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.join(__dirname, '..', 'config', 'store_leads.json');

function getStoredLeads() {
  try {
    if (fs.existsSync(LEADS_FILE)) {
      const data = fs.readFileSync(LEADS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[API/STORE-LEADS] Read error:', e);
  }
  return [];
}

function saveStoredLeads(leads) {
  try {
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[API/STORE-LEADS] Write error:', e);
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Return leads list
  if (req.method === 'GET') {
    const leads = getStoredLeads();
    return res.status(200).json({ success: true, leads });
  }

  // POST: Add new lead
  if (req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const leads = getStoredLeads();

      const newLead = {
        id: payload.id || ('lead-' + Date.now()),
        name: (payload.name || 'Anonymous Guest').trim(),
        phone: (payload.phone || '').trim(),
        pincode: (payload.pincode || payload.place || '').trim(),
        place: (payload.place || payload.city || '').trim(),
        preferredMattress: payload.preferredMattress || payload.mattress || null,
        preferredSize: payload.preferredSize || payload.size || null,
        preferredThickness: payload.preferredThickness || payload.thickness || null,
        summary: payload.summary || payload.notes || 'Customer consultation via Lumi AI',
        source: payload.source || 'Lumi AI Sleep Assistant',
        resultType: payload.resultType || 'lumi_consultation',
        studioId: payload.studioId || null,
        studioName: payload.studioName || null,
        distanceKm: payload.distanceKm || null,
        status: payload.status || 'New',
        createdAt: payload.createdAt || new Date().toISOString(),
        notes: payload.notes || payload.summary || 'Customer consultation request'
      };

      leads.unshift(newLead);
      saveStoredLeads(leads);

      return res.status(200).json({
        success: true,
        message: 'Lead saved successfully',
        lead: newLead
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid payload: ' + err.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
