// Vercel Serverless Function: /api/store-leads (also used by preview/server.js on GoDaddy)
//
// Routes
//   POST   /api/store-leads                      public  - add a lead (storefront / Lumi)
//   GET    /api/store-leads                      admin   - list active leads
//   PUT    /api/store-leads/:id                  admin   - update status / notes
//   DELETE /api/store-leads/:id                  admin   - move ONE lead to the recycle bin
//   POST   /api/store-leads/bulk-delete          admin   - move {ids:[...]} or {all:true} to the recycle bin
//   GET    /api/store-leads/trash                admin   - list recycle bin
//   POST   /api/store-leads/trash/restore        admin   - restore {ids:[...]} or {all:true}
//   DELETE /api/store-leads/trash/:id            admin   - permanently delete one item
//   DELETE /api/store-leads/trash                admin   - empty the recycle bin
const fs = require('fs');
const path = require('path');
const { verifyAdminAuth } = require('./auth.js');

const LEADS_FILE = path.join(__dirname, '..', 'config', 'store_leads.json');
const TRASH_FILE = path.join(__dirname, '..', 'config', 'store_leads_trash.json');
const TRASH_RETENTION_DAYS = 30;

function readList(file) {
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(data) ? data : [];
    }
  } catch (e) {
    console.error('[API/STORE-LEADS] Read error:', e.message);
  }
  return [];
}

function writeList(file, list) {
  try {
    fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[API/STORE-LEADS] Write error:', e.message);
    return false;
  }
}

// Items older than the retention window are purged automatically
function readTrash() {
  const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 3600 * 1000;
  const trash = readList(TRASH_FILE);
  const kept = trash.filter(t => !t.deletedAt || new Date(t.deletedAt).getTime() >= cutoff);
  if (kept.length !== trash.length) writeList(TRASH_FILE, kept);
  return kept;
}

function getSubPath(req) {
  let pathname = '';
  try { pathname = new URL(req.url || '/', 'http://localhost').pathname; } catch (e) { pathname = req.url || ''; }
  const rest = pathname.replace(/^\/api\/store-leads\/?/, '');
  return rest.split('/').filter(Boolean).map(decodeURIComponent);
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return req.body;
}

function moveToTrash(ids, all, reason) {
  const leads = readList(LEADS_FILE);
  const idSet = new Set(ids || []);
  const moving = all ? leads : leads.filter(l => idSet.has(l.id));
  if (!moving.length) return { moved: 0, leads, trash: readTrash() };
  const remaining = all ? [] : leads.filter(l => !idSet.has(l.id));
  const now = new Date().toISOString();
  const trash = moving.map(l => ({ ...l, deletedAt: now, deleteReason: reason || 'Deleted by admin' })).concat(readTrash());
  // Write trash first so a failure can never lose data
  if (!writeList(TRASH_FILE, trash)) throw new Error('Could not write recycle bin (server storage is read-only).');
  if (!writeList(LEADS_FILE, remaining)) throw new Error('Could not update leads file.');
  return { moved: moving.length, leads: remaining, trash };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-role');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sub = getSubPath(req);
  const body = parseBody(req);

  // ---- Public: storefront / Lumi adds a lead ----
  if (req.method === 'POST' && sub.length === 0) {
    try {
      const payload = body;
      const leads = readList(LEADS_FILE);
      const newLead = {
        id: String(payload.id || ('lead-' + Date.now())).slice(0, 64),
        name: String(payload.name || 'Anonymous Guest').trim().slice(0, 80),
        phone: String(payload.phone || '').trim().slice(0, 20),
        pincode: String(payload.pincode || payload.place || '').trim().slice(0, 12),
        place: String(payload.place || payload.city || '').trim().slice(0, 80),
        preferredMattress: payload.preferredMattress || payload.mattress || null,
        preferredSize: payload.preferredSize || payload.size || null,
        preferredThickness: payload.preferredThickness || payload.thickness || null,
        summary: String(payload.summary || payload.notes || 'Customer consultation via Lumi AI').slice(0, 1000),
        source: payload.source || 'Lumi AI Sleep Assistant',
        resultType: payload.resultType || 'lumi_consultation',
        studioId: payload.studioId || null,
        studioName: payload.studioName || null,
        distanceKm: payload.distanceKm || null,
        status: payload.status || 'New',
        createdAt: payload.createdAt || new Date().toISOString(),
        notes: String(payload.notes || payload.summary || 'Customer consultation request').slice(0, 1000)
      };
      if (leads.some(l => l.id === newLead.id)) {
        return res.status(200).json({ success: true, message: 'Lead already saved', lead: newLead });
      }
      leads.unshift(newLead);
      writeList(LEADS_FILE, leads);
      return res.status(200).json({ success: true, message: 'Lead saved successfully', lead: newLead });
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid payload: ' + err.message });
    }
  }

  // ---- Everything below exposes or changes customer data: admin only ----
  if (!verifyAdminAuth(req)) {
    return res.status(401).json({ success: false, message: 'Unauthorized: admin login required.' });
  }

  try {
    // Recycle bin
    if (sub[0] === 'trash') {
      if (req.method === 'GET' && sub.length === 1) {
        return res.status(200).json({ success: true, trash: readTrash(), retentionDays: TRASH_RETENTION_DAYS });
      }
      if (req.method === 'POST' && sub[1] === 'restore') {
        const trash = readTrash();
        const idSet = new Set(body.ids || []);
        const restoring = body.all ? trash : trash.filter(t => idSet.has(t.id));
        if (!restoring.length) return res.status(404).json({ success: false, message: 'Nothing to restore.' });
        const leads = readList(LEADS_FILE);
        const existing = new Set(leads.map(l => l.id));
        const restored = restoring
          .filter(t => !existing.has(t.id))
          .map(({ deletedAt, deleteReason, ...lead }) => ({ ...lead, restoredAt: new Date().toISOString() }));
        const merged = restored.concat(leads).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (!writeList(LEADS_FILE, merged)) throw new Error('Could not update leads file.');
        const restIds = new Set(restoring.map(t => t.id));
        const newTrash = trash.filter(t => !restIds.has(t.id));
        writeList(TRASH_FILE, newTrash);
        return res.status(200).json({ success: true, restored: restoring.length, leads: merged, trash: newTrash });
      }
      if (req.method === 'DELETE' && sub.length === 2) {
        const trash = readTrash();
        const newTrash = trash.filter(t => t.id !== sub[1]);
        if (newTrash.length === trash.length) return res.status(404).json({ success: false, message: 'Item not found in recycle bin.' });
        writeList(TRASH_FILE, newTrash);
        return res.status(200).json({ success: true, trash: newTrash });
      }
      if (req.method === 'DELETE' && sub.length === 1) {
        writeList(TRASH_FILE, []);
        return res.status(200).json({ success: true, trash: [] });
      }
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    if (req.method === 'GET' && sub.length === 0) {
      return res.status(200).json({ success: true, leads: readList(LEADS_FILE), trashCount: readTrash().length });
    }

    if (req.method === 'POST' && sub[0] === 'bulk-delete') {
      const ids = Array.isArray(body.ids) ? body.ids : [];
      if (!body.all && !ids.length) return res.status(400).json({ success: false, message: 'No leads selected.' });
      const out = moveToTrash(ids, !!body.all, body.reason);
      return res.status(200).json({ success: true, moved: out.moved, leads: out.leads, trashCount: out.trash.length });
    }

    if (req.method === 'PUT' && sub.length === 1) {
      const leads = readList(LEADS_FILE);
      const idx = leads.findIndex(l => l.id === sub[0]);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Lead not found' });
      if (body.status) leads[idx].status = String(body.status).slice(0, 30);
      if (body.notes !== undefined) leads[idx].notes = String(body.notes).slice(0, 1000);
      leads[idx].updatedAt = new Date().toISOString();
      writeList(LEADS_FILE, leads);
      return res.status(200).json({ success: true, lead: leads[idx] });
    }

    if (req.method === 'DELETE' && sub.length === 1) {
      const out = moveToTrash([sub[0]], false, body.reason);
      if (!out.moved) return res.status(404).json({ success: false, message: 'Lead not found' });
      return res.status(200).json({ success: true, moved: 1, leads: out.leads, trashCount: out.trash.length });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
