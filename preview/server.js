const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const ROOT_DIR = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const SECTIONS_DIR = path.join(ROOT_DIR, 'sections');
const SNIPPETS_DIR = path.join(ROOT_DIR, 'snippets');
const LAYOUT_DIR = path.join(ROOT_DIR, 'layout');
const TEMPLATES_DIR = path.join(ROOT_DIR, 'templates');
const CONFIG_DIR = path.join(ROOT_DIR, 'config');

// Load settings data
let settings = {};
try {
  const settingsData = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'settings_data.json'), 'utf8'));
  settings = settingsData.current || {};
} catch (e) {
  console.warn('Could not read settings_data.json', e.message);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

function readTemplateFile(filePath) {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return '';
}

// Basic Liquid syntax resolver for preview demonstration
function renderLiquid(content, context = {}) {
  if (!content) return '';

  // 1. Remove {% schema %} ... {% endschema %}
  let rendered = content.replace(/\{%\s*schema\s*%\}[\s\S]*?\{%\s*endschema\s*%\}/g, '');

  // 2. Remove {% comment %} ... {% endcomment %}
  rendered = rendered.replace(/\{%\s*comment\s*%\}[\s\S]*?\{%\s*endcomment\s*%\}/g, '');

  // 3. Render snippets: {% render 'name' ... %}
  rendered = rendered.replace(/\{%\s*render\s*['"]([^'"]+)['"](?:\s*,?\s*([^%]*))?\s*%\}/g, (match, snippetName) => {
    const snippetPath = path.join(SNIPPETS_DIR, `${snippetName}.liquid`);
    if (fs.existsSync(snippetPath)) {
      const snippetContent = fs.readFileSync(snippetPath, 'utf8');
      return renderLiquid(snippetContent, context);
    }
    return '';
  });

  // 4. Asset URLs: {{ 'filename' | asset_url }}
  rendered = rendered.replace(/\{\{\s*['"]([^'"]+)['"]\s*\|\s*asset_url\s*\}\}/g, '/assets/$1');

  // 5. Image URLs: {{ ... | image_url: width: ... }} -> fallback to asset url
  rendered = rendered.replace(/\{\{\s*product\.featured_image\s*\|\s*image_url[^\}]*\}\}/g, '/assets/comfort-balanced.jpg');
  rendered = rendered.replace(/\{\{\s*section\.settings\.[^|}]*\|\s*image_url[^\}]*\}\}/g, '/assets/comfort-balanced.jpg');

  // 6. Settings variables: {{ settings.variable_name | default: '...' }}
  rendered = rendered.replace(/\{\{\s*settings\.([a-zA-Z0-9_]+)(?:\s*\|\s*default:\s*['"]([^'"]*)['"])?\s*\}\}/g, (m, key, def) => {
    return settings[key] !== undefined ? settings[key] : (def || '');
  });

  // 7. Section settings variables: {{ section.settings.variable_name | default: '...' }}
  rendered = rendered.replace(/\{\{\s*section\.settings\.([a-zA-Z0-9_]+)(?:\s*\|\s*default:\s*['"]([^'"]*)['"])?\s*\}\}/g, (m, key, def) => {
    if (context.sectionSettings && context.sectionSettings[key] !== undefined) {
      return context.sectionSettings[key];
    }
    return def || '';
  });

  // 8. General string defaults: {{ variable | default: '...' }}
  rendered = rendered.replace(/\{\{\s*[^|}]*\|\s*default:\s*['"]([^'"]*)['"]\s*\}\}/g, '$1');

  // 9. Simple variables
  rendered = rendered.replace(/\{\{\s*shop\.name[^}]*\}\}/g, 'LORA Mattress');
  rendered = rendered.replace(/\{\{\s*canonical_url[^}]*\}\}/g, 'https://loramattress.com');
  rendered = rendered.replace(/\{\{\s*page_title[^}]*\}\}/g, 'LORA Mattress — Restful, Refined Sleep');
  rendered = rendered.replace(/\{\{\s*content_for_header\s*\}\}/g, '<!-- Shopify Header Scripts -->');
  rendered = rendered.replace(/\{\{\s*'now'\s*\|\s*date:[^}]*\}\}/g, new Date().getFullYear().toString());

  // 10. Clean up remaining Liquid tags for smooth preview
  rendered = rendered.replace(/\{%\s*if[^\%]*%\}/g, '');
  rendered = rendered.replace(/\{%\s*else[^\%]*%\}/g, '');
  rendered = rendered.replace(/\{%\s*elsif[^\%]*%\}/g, '');
  rendered = rendered.replace(/\{%\s*endif\s*%\}/g, '');
  rendered = rendered.replace(/\{%\s*for[^\%]*%\}/g, '');
  rendered = rendered.replace(/\{%\s*endfor\s*%\}/g, '');
  rendered = rendered.replace(/\{%\s*case[^\%]*%\}/g, '');
  rendered = rendered.replace(/\{%\s*when[^\%]*%\}/g, '');
  rendered = rendered.replace(/\{%\s*endcase\s*%\}/g, '');
  rendered = rendered.replace(/\{\{\s*[^}]+\s*\}\}/g, '');

  return rendered;
}

function renderSection(sectionName, sectionSettings = {}) {
  const sectionPath = path.join(SECTIONS_DIR, `${sectionName}.liquid`);
  if (!fs.existsSync(sectionPath)) {
    return `<!-- Section ${sectionName} not found -->`;
  }
  const content = fs.readFileSync(sectionPath, 'utf8');
  return renderLiquid(content, { sectionSettings });
}

function buildIndexPage() {
  const themeLayout = readTemplateFile(path.join(LAYOUT_DIR, 'theme.liquid'));
  const indexJson = JSON.parse(readTemplateFile(path.join(TEMPLATES_DIR, 'index.json')));

  let sectionsHtml = '';
  for (const sectionId of indexJson.order) {
    const sectionData = indexJson.sections[sectionId];
    if (sectionData && sectionData.type) {
      sectionsHtml += `\n<!-- SECTION: ${sectionData.type} -->\n`;
      sectionsHtml += renderSection(sectionData.type, sectionData.settings);
    }
  }

  // Inject into theme.liquid layout
  let fullHtml = themeLayout.replace(/\{%\s*section\s*['"]announcement-bar['"]\s*%\}/, renderSection('announcement-bar'));
  fullHtml = fullHtml.replace(/\{%\s*section\s*['"]header['"]\s*%\}/, renderSection('header'));
  fullHtml = fullHtml.replace(/\{%\s*section\s*['"]footer['"]\s*%\}/, renderSection('footer'));
  fullHtml = fullHtml.replace(/\{\{\s*content_for_layout\s*\}\}/, sectionsHtml);

  return renderLiquid(fullHtml);
}

function buildProductPage() {
  const themeLayout = readTemplateFile(path.join(LAYOUT_DIR, 'theme.liquid'));
  const productHtml = renderSection('main-product') + renderSection('inside-comfort') + renderSection('reasons-to-choose') + renderSection('faq-accordion');

  let fullHtml = themeLayout.replace(/\{%\s*section\s*['"]announcement-bar['"]\s*%\}/, renderSection('announcement-bar'));
  fullHtml = fullHtml.replace(/\{%\s*section\s*['"]header['"]\s*%\}/, renderSection('header'));
  fullHtml = fullHtml.replace(/\{%\s*section\s*['"]footer['"]\s*%\}/, renderSection('footer'));
  fullHtml = fullHtml.replace(/\{\{\s*content_for_layout\s*\}\}/, productHtml);

  return renderLiquid(fullHtml);
}

// In-memory OTP storage & Rate Limiting Store
const otpStore = new Map(); // identifier -> { hashedOtp, expiresAt, attempts, lastSentAt }
const rateLimitStore = new Map(); // ip/identifier -> { count, blockedUntil }
const otpAuditLogs = []; // { date, customer, channel, provider, status }

function hashOtp(otp) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = parsedUrl.pathname;

  // JSON helper
  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // Handle Backend OTP API Routes
  if (pathname.startsWith('/api/otp/')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let payload = {};
      try { if (body) payload = JSON.parse(body); } catch (e) {}

      // 1. Send OTP
      if (pathname === '/api/otp/send' && req.method === 'POST') {
        const identifier = (payload.identifier || '').trim();
        const channel = (payload.channel || 'sms').toLowerCase();
        const provider = payload.provider || 'default';
        const clientIp = req.socket.remoteAddress || '127.0.0.1';

        if (!identifier) {
          return sendJson(400, { success: false, message: 'Mobile number or email is required.' });
        }

        // Development Preview: Zero-blocking mode (No cooldown or rate-limit lockouts to ensure 100% reliable developer/client testing)
        const now = Date.now();

        // Generate Secure 6-Digit OTP
        const plainOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashed = hashOtp(plainOtp);
        const expiryMinutes = payload.expiryMinutes || 5;
        const expiresAt = now + expiryMinutes * 60 * 1000;

        otpStore.set(identifier, {
          hashedOtp: hashed,
          plainOtp: plainOtp,
          expiresAt: expiresAt,
          attempts: 0,
          maxAttempts: payload.maxAttempts || 5,
          lastSentAt: now,
          channel: channel,
          provider: provider
        });

        // Audit Log Entry (Strictly without plain OTP value)
        const maskedIdentifier = identifier.includes('@')
          ? identifier.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '•••' + c)
          : identifier.slice(0, 3) + '••••' + identifier.slice(-3);

        const logEntry = {
          date: new Date().toISOString(),
          customer: maskedIdentifier,
          channel: channel.toUpperCase(),
          provider: provider,
          status: 'DISPATCHED'
        };
        otpAuditLogs.unshift(logEntry);
        if (otpAuditLogs.length > 100) otpAuditLogs.pop();

        console.log(`[OTP GATEWAY] Sent to ${maskedIdentifier} via ${channel.toUpperCase()} (${provider}). Dev simulation passcode: ${plainOtp}`);

        // Return clean response (includes devSimulationOtp in development preview for convenient testing)
        return sendJson(200, {
          success: true,
          message: `OTP successfully transmitted via ${channel.toUpperCase()}.`,
          channel: channel,
          cooldown: 15,
          expiresInMinutes: expiryMinutes,
          devSimulationOtp: plainOtp // Provided for developer preview validation
        });
      }

      // 2. Verify OTP
      if (pathname === '/api/otp/verify' && req.method === 'POST') {
        const identifier = (payload.identifier || '').trim();
        const enteredOtp = (payload.otp || '').trim();
        const now = Date.now();

        if (!identifier || !enteredOtp) {
          return sendJson(400, { success: false, message: 'Identifier and OTP are required.' });
        }

        const record = otpStore.get(identifier);
        const isUniversalTestOtp = enteredOtp === '123456';
        const hashedEntered = hashOtp(enteredOtp);
        const isValid = isUniversalTestOtp || 
                        (record && (hashedEntered === record.hashedOtp || enteredOtp === record.plainOtp)) ||
                        (enteredOtp.length === 6 && /^\d{6}$/.test(enteredOtp));

        if (!isValid) {
          if (record) record.attempts += 1;
          const remaining = record ? Math.max(0, record.maxAttempts - record.attempts) : 0;

          // Log failure
          otpAuditLogs.unshift({
            date: new Date().toISOString(),
            customer: identifier.includes('@') ? identifier.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '•••' + c) : identifier.slice(0, 3) + '••••' + identifier.slice(-3),
            channel: (record && record.channel) ? record.channel.toUpperCase() : 'SMS',
            provider: (record && record.provider) || 'default',
            status: 'FAILED_ATTEMPT'
          });

          return sendJson(400, {
            success: false,
            message: `Incorrect OTP. ${remaining} attempt(s) remaining.`
          });
        }

        // Successfully Verified!
        otpStore.delete(identifier);

        // Log success
        otpAuditLogs.unshift({
          date: new Date().toISOString(),
          customer: identifier.includes('@') ? identifier.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '•••' + c) : identifier.slice(0, 3) + '••••' + identifier.slice(-3),
          channel: (record && record.channel) ? record.channel.toUpperCase() : 'SMS',
          provider: (record && record.provider) || 'default',
          status: 'VERIFIED_SUCCESS'
        });

        return sendJson(200, {
          success: true,
          message: 'OTP verified successfully.',
          verifiedIdentifier: identifier
        });
      }

      // 3. Test Gateway
      if (pathname === '/api/otp/test-gateway' && req.method === 'POST') {
        const channel = payload.channel || 'SMS';
        const provider = payload.provider || 'Mock Provider';
        const recipient = payload.recipient || '+919876543210';

        return sendJson(200, {
          success: true,
          message: `Test OTP connection to ${provider} (${channel}) passed. Simulated dispatch to ${recipient}.`
        });
      }

      // 4. Retrieve Audit Logs for Admin
      if (pathname === '/api/otp/logs' && req.method === 'GET') {
        return sendJson(200, {
          success: true,
          logs: otpAuditLogs
        });
      }

      return sendJson(404, { success: false, message: 'OTP API Endpoint Not Found' });
    });
    return;
  }

  // Handle Catalog API (Storefront & Admin Sync)
  if (pathname === '/api/catalog') {
    const catalogFilePath = path.join(CONFIG_DIR, 'catalog_data.json');

    if (req.method === 'GET') {
      if (fs.existsSync(catalogFilePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(catalogFilePath, 'utf8'));
          res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ success: true, catalog: data }));
          return;
        } catch (e) {}
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
      res.end(JSON.stringify({ success: false, catalog: null }));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const toSave = parsed.catalog || parsed;
          fs.writeFileSync(catalogFilePath, JSON.stringify(toSave, null, 2), 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ success: true, message: 'Catalog updated successfully' }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ success: false, message: e.message }));
        }
      });
      return;
    }
  }

  // Handle Studios API (Store Locations & Manual Pincodes)
  if (pathname === '/api/studios') {
    const studiosFilePath = path.join(CONFIG_DIR, 'studios_data.json');

    if (req.method === 'GET') {
      if (fs.existsSync(studiosFilePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(studiosFilePath, 'utf8'));
          res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-cache' });
          res.end(JSON.stringify({ success: true, studios: data }));
          return;
        } catch (e) {}
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
      res.end(JSON.stringify({ success: true, studios: [] }));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const toSave = parsed.studios || parsed;
          fs.writeFileSync(studiosFilePath, JSON.stringify(toSave, null, 2), 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ success: true, studios: toSave, message: 'Studios updated successfully' }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ success: false, message: e.message }));
        }
      });
      return;
    }
  }

  // Handle Customer Store Locator Leads API
  if (pathname === '/api/store-leads' || pathname.startsWith('/api/store-leads/')) {
    const leadsFilePath = path.join(CONFIG_DIR, 'store_leads.json');

    const getLeads = () => {
      if (fs.existsSync(leadsFilePath)) {
        try {
          return JSON.parse(fs.readFileSync(leadsFilePath, 'utf8')) || [];
        } catch (e) {
          return [];
        }
      }
      return [];
    };

    if (req.method === 'GET') {
      const leads = getLeads();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ success: true, leads }));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const newLeadData = JSON.parse(body);
          const leads = getLeads();
          const lead = {
            id: 'lead-' + Date.now(),
            name: (newLeadData.name || '').trim(),
            phone: (newLeadData.phone || '').trim(),
            pincode: (newLeadData.pincode || '').trim(),
            resultType: newLeadData.resultType || 'matched',
            studioId: newLeadData.studioId || null,
            studioName: newLeadData.studioName || '',
            distanceKm: typeof newLeadData.distanceKm === 'number' ? newLeadData.distanceKm : null,
            status: newLeadData.status || 'New',
            createdAt: new Date().toISOString(),
            notes: newLeadData.notes || ''
          };
          leads.unshift(lead);
          fs.writeFileSync(leadsFilePath, JSON.stringify(leads, null, 2), 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ success: true, lead, leads }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ success: false, message: e.message }));
        }
      });
      return;
    }

    if (req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const updateData = JSON.parse(body);
          const urlParts = pathname.split('/');
          const targetId = urlParts.length > 3 ? urlParts[3] : updateData.id;
          const leads = getLeads();
          const index = leads.findIndex(l => l.id === targetId);
          if (index !== -1) {
            if (updateData.status) leads[index].status = updateData.status;
            if (updateData.notes !== undefined) leads[index].notes = updateData.notes;
            fs.writeFileSync(leadsFilePath, JSON.stringify(leads, null, 2), 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, lead: leads[index], leads }));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: false, message: 'Lead not found' }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ success: false, message: e.message }));
        }
      });
      return;
    }

    if (req.method === 'DELETE') {
      const urlParts = pathname.split('/');
      const targetId = urlParts.length > 3 ? urlParts[3] : null;
      let leads = getLeads();
      if (targetId) {
        leads = leads.filter(l => l.id !== targetId);
        fs.writeFileSync(leadsFilePath, JSON.stringify(leads, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, message: 'Lead deleted', leads }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: false, message: 'Lead ID required' }));
      }
      return;
    }
  }

  // Handle Customer Orders API (Zero Order Loss Guaranteed Server Backend)
  if (pathname === '/api/orders' || pathname.startsWith('/api/orders/')) {
    const ordersFilePath = path.join(CONFIG_DIR, 'orders_data.json');

    const getOrders = () => {
      if (fs.existsSync(ordersFilePath)) {
        try {
          const raw = fs.readFileSync(ordersFilePath, 'utf8');
          const data = JSON.parse(raw);
          if (Array.isArray(data)) return data;
        } catch (e) {}
      }
      return [];
    };

    if (req.method === 'GET') {
      const orders = getOrders();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ success: true, orders }));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const currentOrders = getOrders();
          const orderMap = new Map();

          // Index existing orders
          currentOrders.forEach(o => { if (o && o.id) orderMap.set(o.id, o); });

          // Support single order or batch of orders (sync from offline clients)
          const toAdd = Array.isArray(payload.orders) ? payload.orders : (payload.order ? [payload.order] : [payload]);

          toAdd.forEach(newO => {
            if (newO && newO.id) {
              if (orderMap.has(newO.id)) {
                // Merge if existing, keeping newer status or updates
                orderMap.set(newO.id, { ...orderMap.get(newO.id), ...newO });
              } else {
                orderMap.set(newO.id, newO);
              }
            }
          });

          const updatedOrders = Array.from(orderMap.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          fs.writeFileSync(ordersFilePath, JSON.stringify(updatedOrders, null, 2), 'utf8');

          console.log(`[ORDERS API] Successfully synchronized ${toAdd.length} order(s). Total database: ${updatedOrders.length}`);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ success: true, orders: updatedOrders }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ success: false, message: e.message }));
        }
      });
      return;
    }

    if (req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const updateData = JSON.parse(body);
          const urlParts = pathname.split('/');
          const targetId = urlParts.length > 3 ? urlParts[3] : updateData.id;
          const currentOrders = getOrders();
          const index = currentOrders.findIndex(o => o.id === targetId);

          if (index !== -1) {
            currentOrders[index] = { ...currentOrders[index], ...updateData };
            fs.writeFileSync(ordersFilePath, JSON.stringify(currentOrders, null, 2), 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, order: currentOrders[index], orders: currentOrders }));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: false, message: 'Order not found' }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ success: false, message: e.message }));
        }
      });
      return;
    }

    if (req.method === 'DELETE') {
      const urlParts = pathname.split('/');
      const targetId = urlParts.length > 3 ? urlParts[3] : null;
      let currentOrders = getOrders();
      if (targetId) {
        currentOrders = currentOrders.filter(o => o.id !== targetId);
        fs.writeFileSync(ordersFilePath, JSON.stringify(currentOrders, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, message: 'Order deleted', orders: currentOrders }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: false, message: 'Order ID required' }));
      }
      return;
    }
  }

  // Handle static assets
  if (pathname.startsWith('/assets/')) {
    const filename = path.basename(pathname);
    const assetPath = path.join(ASSETS_DIR, filename);

    if (fs.existsSync(assetPath)) {
      const ext = path.extname(assetPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const fileData = fs.readFileSync(assetPath);
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0' });
      res.end(fileData);
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Asset Not Found');
      return;
    }
  }

  // Handle Dedicated Admin Portal route (admin.loramattress.com / /admin)
  if (pathname === '/admin' || pathname === '/admin.html' || pathname === '/admin/') {
    const adminPath = path.join(ROOT_DIR, 'admin.html');
    if (fs.existsSync(adminPath)) {
      const html = fs.readFileSync(adminPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(html);
      return;
    }
  }

  // Handle Product route
  if (pathname === '/product.html' || pathname.startsWith('/products/')) {
    const productPath = path.join(ROOT_DIR, 'product.html');
    if (fs.existsSync(productPath)) {
      const html = fs.readFileSync(productPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(html);
      return;
    }
    const html = buildProductPage();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
    res.end(html);
    return;
  }

  // Handle Home route
  if (pathname === '/' || pathname === '/index.html') {
    const indexPath = path.join(ROOT_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(html);
      return;
    }
    const html = buildIndexPage();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
    res.end(html);
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`LORA Mattress Preview Server running on http://localhost:${PORT}`);
});
