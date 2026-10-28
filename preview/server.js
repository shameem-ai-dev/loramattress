const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Load environment variables from .env or .env.godaddy if present locally
function loadLocalEnv() {
  const envCandidates = ['.env', '.env.local', '.env.godaddy'];
  for (const envFile of envCandidates) {
    const fullPath = path.join(ROOT_DIR, envFile);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        content.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
            if (key && !(key in process.env)) {
              process.env[key] = val;
            }
          }
        });
      } catch (e) {}
    }
  }
}
loadLocalEnv();

// Shared backend API handlers (Single Source of Truth)
const paymentSettingsHandler = require('../api/payment-settings.js');
const rzpCreateOrderHandler = require('../api/razorpay/create-order.js');
const rzpVerifyPaymentHandler = require('../api/razorpay/verify-payment.js');
const rzpTestConnectionHandler = require('../api/razorpay/test-connection.js');
const otpSendHandler = require('../api/otp/send.js');
const otpTestGatewayHandler = require('../api/otp/test-gateway.js');
const otpVerifyHandler = require('../api/otp/verify.js');
const otpSettingsHandler = require('../api/otp/settings.js');
const otpSessionHandler = require('../api/otp/session.js');
const otpLib = require('../api/otp/_lib.js');
const { verifyAdminAuth } = require('../api/auth.js');
const ordersHandler = require('../api/orders.js');
const marketingHandler = require('../api/marketing.js');
function withSeo(html, page, req) {
  try { return marketingHandler.renderSeoHead(html, page, req); } catch (e) { console.warn('[SEO] head injection skipped:', e.message); return html; }
}

function callApiHandler(handler, req, res, bodyData) {
  req.body = bodyData;
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    if (!this.writableEnded) {
      this.setHeader('Content-Type', 'application/json; charset=UTF-8');
      this.end(JSON.stringify(data));
    }
    return this;
  };
  return Promise.resolve(handler(req, res)).catch(err => {
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=UTF-8');
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
  });
}

const PORT = process.env.PORT || 3456;
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const SECTIONS_DIR = path.join(ROOT_DIR, 'sections');
const SNIPPETS_DIR = path.join(ROOT_DIR, 'snippets');
const LAYOUT_DIR = path.join(ROOT_DIR, 'layout');
const TEMPLATES_DIR = path.join(ROOT_DIR, 'templates');
const CONFIG_DIR = path.join(ROOT_DIR, 'config');

// Persistent data directory OUTSIDE the app folder.
// GoDaddy/cPanel redeploys (Git pull, re-upload, "Setup Node.js App" rebuilds) replace the app folder,
// which wiped admin-uploaded photos (assets/uploads) and reset config/catalog_data.json to the repo copy.
// Override with LORA_DATA_DIR env var if needed.
const DATA_DIR = process.env.LORA_DATA_DIR || path.join(require('os').homedir(), 'lora-data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) { console.error('[DATA] Cannot create data dir', DATA_DIR, e.message); }

// Returns path of a persistent data file; seeds it from the bundled config/ copy on first use.
function dataFile(name) {
  const target = path.join(DATA_DIR, name);
  if (!fs.existsSync(target)) {
    const seed = path.join(CONFIG_DIR, name);
    try { if (fs.existsSync(seed)) fs.copyFileSync(seed, target); } catch (e) {}
  }
  return target;
}

// One-time migration: copy any photos still inside the app folder into persistent storage.
try {
  const legacyUploads = path.join(ASSETS_DIR, 'uploads');
  if (fs.existsSync(legacyUploads)) {
    for (const f of fs.readdirSync(legacyUploads)) {
      const dest = path.join(UPLOADS_DIR, f);
      if (!fs.existsSync(dest)) fs.copyFileSync(path.join(legacyUploads, f), dest);
    }
  }
} catch (e) { console.warn('[DATA] Upload migration skipped:', e.message); }
console.log('[DATA] Persistent data directory:', DATA_DIR);

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
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
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
  let indexJson = { order: [], sections: {} };
  try {
    const raw = readTemplateFile(path.join(TEMPLATES_DIR, 'index.json'));
    if (raw) indexJson = JSON.parse(raw);
  } catch (e) {
    console.warn('Could not parse index.json', e.message);
  }

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

  // Enforce standard production HTTP security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Customer-Session'
    });
    res.end();
    return;
  }

  // Handle Backend OTP API Routes
  if (pathname.startsWith('/api/otp/')) {
    if (req.method === 'GET' && pathname === '/api/otp/send') {
      return callApiHandler(otpSendHandler, req, res, null);
    }
    if (req.method === 'GET' && pathname === '/api/otp/settings') {
      return callApiHandler(otpSettingsHandler, req, res, null);
    }
    if (req.method === 'GET' && pathname === '/api/otp/session') {
      return callApiHandler(otpSessionHandler, req, res, null);
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let payload = {};
      try { if (body) payload = JSON.parse(body); } catch (e) {}

      // 1. Send OTP (Strict server process.env execution via api/otp/send.js)
      if (pathname === '/api/otp/send' && req.method === 'POST') {
        return callApiHandler(otpSendHandler, req, res, payload);
      }

      // 2. Verify OTP (Strict server token verification via api/otp/verify.js)
      if (pathname === '/api/otp/verify' && req.method === 'POST') {
        return callApiHandler(otpVerifyHandler, req, res, payload);
      }

      // 3. Test Gateway (Admin authorized non-destructive check via api/otp/test-gateway.js)
      if (pathname === '/api/otp/test-gateway' && req.method === 'POST') {
        return callApiHandler(otpTestGatewayHandler, req, res, payload);
      }

      // 3b. Save OTP provider settings (admin only, non-secret values)
      if (pathname === '/api/otp/settings' && req.method === 'POST') {
        return callApiHandler(otpSettingsHandler, req, res, payload);
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

  // Ribbon Settings Helper
  const ribbonSettingsPath = dataFile('ribbon_settings.json');
  const getRibbonSettings = () => {
    if (fs.existsSync(ribbonSettingsPath)) {
      try {
        return JSON.parse(fs.readFileSync(ribbonSettingsPath, 'utf8'));
      } catch (e) {}
    }
    return {
      enabled: true,
      speedSeconds: 28,
      pauseOnHover: true,
      messages: [
        {
          id: "ribbon_1",
          tag: "FESTIVE SALE",
          text: "Get Flat 20% Off + Complimentary Orthopedic Pillow Pair with Code LORA20",
          link: "#the-collection"
        },
        {
          id: "ribbon_2",
          tag: "FACTORY DIRECT",
          text: "100% Natural Latex & Memory Foam Mattresses Direct from Factory to Your Bedroom",
          link: "#the-collection"
        },
        {
          id: "ribbon_3",
          tag: "15-YEAR WARRANTY",
          text: "Direct Factory Craftsmanship with up to 15 Years Warranty",
          link: "#the-collection"
        },
        {
          id: "ribbon_4",
          tag: "FREE DELIVERY",
          text: "Complimentary Flat Delivery & Unboxing Across India within 24–48 Hours",
          link: "#the-collection"
        }
      ],
      updatedAt: new Date().toISOString()
    };
  };

  // Offer Ribbon Settings API (GET / POST)
  if (pathname === '/api/ribbon-settings') {
    if (req.method === 'GET') {
      const current = getRibbonSettings();
      return sendJson(200, { success: true, settings: current });
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const toSave = payload.settings || payload;
          const cleanSettings = {
            enabled: typeof toSave.enabled === 'boolean' ? toSave.enabled : true,
            speedSeconds: Math.max(8, Math.min(120, Number(toSave.speedSeconds) || 28)),
            pauseOnHover: toSave.pauseOnHover !== false,
            messages: Array.isArray(toSave.messages) ? toSave.messages.map((m, idx) => ({
              id: m.id || `ribbon_${idx + 1}`,
              tag: String(m.tag || '').trim().slice(0, 30),
              text: String(m.text || '').trim().slice(0, 180),
              link: String(m.link || '').trim()
            })).filter(m => m.text.length > 0) : [],
            updatedAt: new Date().toISOString()
          };
          fs.writeFileSync(ribbonSettingsPath, JSON.stringify(cleanSettings, null, 2), 'utf8');
          return sendJson(200, {
            success: true,
            persisted: true,
            message: 'Offer ribbon settings saved and published permanently to storefront.',
            settings: cleanSettings
          });
        } catch (e) {
          return sendJson(400, { success: false, message: e.message });
        }
      });
      return;
    }
  }

  // Payment Settings Helper
  const paymentSettingsPath = path.join(CONFIG_DIR, 'payment_settings.json');
  const getPaymentSettings = () => {
    if (fs.existsSync(paymentSettingsPath)) {
      try {
        return JSON.parse(fs.readFileSync(paymentSettingsPath, 'utf8'));
      } catch (e) {}
    }
    return {
      razorpay_enabled: true,
      razorpay_key_id: 'rzp_test_51L0RA9876DEMO',
      razorpay_key_secret: '',
      razorpay_mode: 'test',
      razorpay_theme_color: '#00B4D8',
      cod_enabled: true,
      cod_max_amount: 50000,
      cod_notice: 'Cash or UPI accepted upon delivery arrival.'
    };
  };

  // Payment Settings API (GET / POST)
  if (pathname === '/api/payment-settings') {
    if (req.method === 'GET') {
      return callApiHandler(paymentSettingsHandler, req, res, null);
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let payload = {};
      try { if (body) payload = JSON.parse(body); } catch (e) {}
      return callApiHandler(paymentSettingsHandler, req, res, payload);
    });
    return;
  }

  // Razorpay Gateway API Routes
  if (pathname.startsWith('/api/razorpay/')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let payload = {};
      try { if (body) payload = JSON.parse(body); } catch (e) {}

      // 1. Create Razorpay Order (Strict server credentials via api/razorpay/create-order.js)
      if (pathname === '/api/razorpay/create-order' && req.method === 'POST') {
        return callApiHandler(rzpCreateOrderHandler, req, res, payload);
      }

      // 2. Verify Razorpay Payment Signature (Strict HMAC-SHA256 via api/razorpay/verify-payment.js)
      if (pathname === '/api/razorpay/verify-payment' && req.method === 'POST') {
        return callApiHandler(rzpVerifyPaymentHandler, req, res, payload);
      }

      // 3. Test Connection (Admin authorized non-destructive query via api/razorpay/test-connection.js)
      if (pathname === '/api/razorpay/test-connection' && req.method === 'POST') {
        return callApiHandler(rzpTestConnectionHandler, req, res, payload);
      }

      return sendJson(404, { success: false, message: 'Razorpay API Endpoint Not Found' });
    });
    return;
  }

  // Handle Catalog API (Storefront & Admin Sync)
  if (pathname === '/api/catalog') {
    const catalogFilePath = dataFile('catalog_data.json');

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

  // Handle File / Image Upload API (Persistent Local & Server Storage)
  if (pathname === '/api/upload') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const rawImage = parsed.image || parsed.data;
          const modelKey = (parsed.model || 'general').replace(/[^a-zA-Z0-9_-]/g, '');
          const slotName = (parsed.slot || 'slot').replace(/[^a-zA-Z0-9_-]/g, '');

          if (!rawImage) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: false, message: 'No image data provided' }));
            return;
          }

          let buffer;
          let ext = '.jpg';

          if (rawImage.startsWith('data:')) {
            const matches = rawImage.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
            if (matches) {
              ext = matches[1] === 'jpeg' ? '.jpg' : `.${matches[1]}`;
              buffer = Buffer.from(matches[2], 'base64');
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=UTF-8' });
              res.end(JSON.stringify({ success: false, message: 'Invalid base64 image data' }));
              return;
            }
          } else {
            buffer = Buffer.from(rawImage, 'base64');
          }

          const uploadsDir = UPLOADS_DIR;
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }

          const safeFileName = `prod_${modelKey}_${slotName}_${Date.now()}${ext}`;
          const targetFilePath = path.join(uploadsDir, safeFileName);
          fs.writeFileSync(targetFilePath, buffer);

          const publicUrl = `/assets/uploads/${safeFileName}`;
          console.log(`[UPLOAD API] Successfully saved persistent asset: ${publicUrl} (${buffer.length} bytes)`);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({
            success: true,
            url: publicUrl,
            filename: safeFileName,
            size: buffer.length,
            message: 'Image uploaded and stored persistently'
          }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ success: false, message: 'Upload failed: ' + e.message }));
        }
      });
      return;
    }
  }

  // Handle Studios API (Store Locations & Manual Pincodes)
  if (pathname === '/api/studios') {
    const studiosFilePath = dataFile('studios_data.json');

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

  // Handle Lumi AI Sleep Assistant API (Version 2.5)
  if (pathname === '/api/lumi-chat') {
    const apiPath = path.join(ROOT_DIR, 'api', 'lumi-chat.js');
    const enginePath = path.join(ROOT_DIR, 'api', 'lumi-conversational-engine.js');
    try {
      delete require.cache[require.resolve(apiPath)];
      delete require.cache[require.resolve(enginePath)];
    } catch(e) {}
    const lumiHandler = require(apiPath);
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const mockReq = {
          method: req.method,
          headers: req.headers,
          body: body ? JSON.parse(body) : {}
        };
        const mockRes = {
          setHeader: (k, v) => res.setHeader(k, v),
          status: (code) => {
            res.statusCode = code;
            return {
              json: (data) => {
                res.writeHead(code, {
                  'Content-Type': 'application/json; charset=UTF-8',
                  'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(data));
              },
              end: () => res.end()
            };
          }
        };
        await lumiHandler(mockReq, mockRes);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  // Meta Ads (Conversions API relay, catalog feed) + SEO (robots, sitemap)
  if (marketingHandler.isMarketingPath(pathname)) {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 64 * 1024) req.destroy(); });
      req.on('end', () => {
        let payload = {};
        try { if (body) payload = JSON.parse(body); } catch (e) {}
        callApiHandler(marketingHandler, req, res, payload);
      });
      return;
    }
    return callApiHandler(marketingHandler, req, res, null);
  }

  // Security: sensitive config, database JSONs, and environment files must never be served statically
  if (/^\/config\//i.test(pathname) || /^\/\.env/i.test(pathname) || /^\/\.git/i.test(pathname)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=UTF-8' });
    res.end(JSON.stringify({ success: false, message: 'Forbidden' }));
    return;
  }

  // Handle Customer Leads API (+ recycle bin) — delegated to api/store-leads.js
  if (pathname === '/api/store-leads' || pathname.startsWith('/api/store-leads/')) {
    const apiPath = path.join(ROOT_DIR, 'api', 'store-leads.js');
    try { delete require.cache[require.resolve(apiPath)]; } catch (e) {}
    const leadsHandler = require(apiPath);
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      let parsed = {};
      try { parsed = body ? JSON.parse(body) : {}; } catch (e) { parsed = {}; }
      const mockReq = { method: req.method, headers: req.headers, url: req.url, body: parsed };
      const mockRes = {
        statusCode: 200,
        setHeader: (k, v) => res.setHeader(k, v),
        status(code) { this.statusCode = code; return this; },
        json(data) {
          res.writeHead(this.statusCode, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify(data));
        },
        end() { res.writeHead(this.statusCode); res.end(); }
      };
      try {
        await leadsHandler(mockReq, mockRes);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  // Handle Customer Orders API (Delegated to api/orders.js with authorization and audit protection)
  if (pathname === '/api/orders' || pathname.startsWith('/api/orders/')) {
    if (req.method === 'GET' || req.method === 'DELETE') {
      return callApiHandler(ordersHandler, req, res, null);
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let payload = {};
      try { if (body) payload = JSON.parse(body); } catch (e) {}
      return callApiHandler(ordersHandler, req, res, payload);
    });
    return;
  }

  // Instagram Reels showcase config (GET public, POST admin)
  if (pathname === '/api/instagram-reels') {
    const reelsPath = dataFile('instagram_reels.json');
    if (req.method === 'GET') {
      let data = { enabled: true, title: 'Watch LORA', subtitle: '', profileUrl: '', reels: [] };
      try { if (fs.existsSync(reelsPath)) data = Object.assign(data, JSON.parse(fs.readFileSync(reelsPath, 'utf8'))); } catch (e) {}
      res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ success: true, settings: data }));
      return;
    }
    if (req.method === 'POST') {
      if (!verifyAdminAuth(req)) return sendJson(401, { success: false, message: 'Unauthorized' });
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on('end', () => {
        try {
          const p = JSON.parse(body || '{}');
          const s = p.settings || p;
          const igRe = /^https:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+/i;
          const localRe = /^\/assets\/uploads\/[A-Za-z0-9_\/.-]+$/;
          const clean = {
            enabled: s.enabled !== false,
            title: String(s.title || 'Watch LORA').slice(0, 80),
            subtitle: String(s.subtitle || '').slice(0, 200),
            profileUrl: /^https:\/\/(www\.)?instagram\.com\//i.test(s.profileUrl || '') ? String(s.profileUrl) : '',
            reels: (Array.isArray(s.reels) ? s.reels : []).slice(0, 30).map((r, i) => ({
              id: String(r.id || `reel_${Date.now()}_${i}`).slice(0, 60),
              instagramUrl: igRe.test(r.instagramUrl || '') ? String(r.instagramUrl).split('?')[0] : '',
              videoUrl: localRe.test(r.videoUrl || '') ? String(r.videoUrl) : '',
              posterUrl: localRe.test(r.posterUrl || '') ? String(r.posterUrl) : '',
              caption: String(r.caption || '').slice(0, 140),
              active: r.active !== false
            })).filter(r => r.instagramUrl || r.videoUrl),
            updatedAt: new Date().toISOString()
          };
          fs.writeFileSync(reelsPath, JSON.stringify(clean, null, 2), 'utf8');
          return sendJson(200, { success: true, settings: clean });
        } catch (e) {
          return sendJson(400, { success: false, message: e.message });
        }
      });
      return;
    }
  }

  // Streamed video upload (raw binary body, admin only) — keeps original resolution untouched
  if (pathname === '/api/upload-video' && req.method === 'POST') {
    if (!verifyAdminAuth(req)) return sendJson(401, { success: false, message: 'Unauthorized' });
    const MAX_BYTES = 500 * 1024 * 1024;
    const typeMap = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/x-m4v': '.m4v' };
    const ctype = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const ext = typeMap[ctype];
    if (!ext) return sendJson(415, { success: false, message: 'Only MP4, WebM or MOV videos are supported' });
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > MAX_BYTES) return sendJson(413, { success: false, message: 'Video exceeds 500 MB limit' });

    const videosDir = path.join(UPLOADS_DIR, 'videos');
    fs.mkdirSync(videosDir, { recursive: true });
    const fileName = `reel_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const target = path.join(videosDir, fileName);
    const tmp = target + '.part';
    const out = fs.createWriteStream(tmp);
    let received = 0;
    let aborted = false;
    const fail = (code, msg) => {
      if (aborted) return;
      aborted = true;
      out.destroy();
      fs.unlink(tmp, () => {});
      sendJson(code, { success: false, message: msg });
    };
    req.on('data', chunk => {
      received += chunk.length;
      if (received > MAX_BYTES) { fail(413, 'Video exceeds 500 MB limit'); req.destroy(); }
    });
    req.on('error', () => fail(500, 'Upload interrupted'));
    out.on('error', e => fail(500, 'Write failed: ' + e.message));
    out.on('finish', () => {
      if (aborted) return;
      if (received === 0) return fail(400, 'Empty upload');
      fs.renameSync(tmp, target);
      console.log(`[VIDEO UPLOAD] Saved ${fileName} (${(received / 1048576).toFixed(1)} MB)`);
      sendJson(200, { success: true, url: `/assets/uploads/videos/${fileName}`, size: received });
    });
    req.pipe(out);
    return;
  }

  // Handle static assets (including uploads and subfolders)
  if (pathname.startsWith('/assets/') || pathname.startsWith('/admin/assets/')) {
    const cleanPath = pathname.replace(/^\/admin/, '');
    const relAssetPath = cleanPath.replace(/^\/assets\//, '');
    const safePath = path.normalize(relAssetPath).replace(/^(\.\.[\/\\])+/, '');
    let assetPath = path.join(ASSETS_DIR, safePath);
    if (/^uploads[\/\\]/.test(safePath)) {
      const persisted = path.join(UPLOADS_DIR, safePath.replace(/^uploads[\/\\]/, ''));
      if (fs.existsSync(persisted)) assetPath = persisted;
    }

    if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      const ext = path.extname(assetPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      // Videos: stream with HTTP Range support (required by Safari/iOS, enables instant start + seeking)
      if (contentType.startsWith('video/')) {
        const size = fs.statSync(assetPath).size;
        const baseHeaders = { 'Content-Type': contentType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable' };
        const range = req.headers.range;
        if (range) {
          const m = /bytes=(\d*)-(\d*)/.exec(range);
          let start = m && m[1] ? parseInt(m[1], 10) : 0;
          let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
          if (m && !m[1] && m[2]) { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
          end = Math.min(end, size - 1);
          if (isNaN(start) || start >= size || start > end) {
            res.writeHead(416, { 'Content-Range': `bytes */${size}` });
            res.end();
            return;
          }
          res.writeHead(206, Object.assign({ 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 }, baseHeaders));
          fs.createReadStream(assetPath, { start, end }).pipe(res);
        } else {
          res.writeHead(200, Object.assign({ 'Content-Length': size }, baseHeaders));
          fs.createReadStream(assetPath).pipe(res);
        }
        return;
      }

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
      const html = withSeo(fs.readFileSync(productPath, 'utf8'), 'product', req);
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
      const html = withSeo(fs.readFileSync(indexPath, 'utf8'), 'home', req);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(html);
      return;
    }
    const html = buildIndexPage();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
    res.end(html);
    return;
  }

  // Health check route for GoDaddy container health monitors
  if (pathname === '/health' || pathname === '/healthz' || pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), time: new Date().toISOString() }));
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`LORA Mattress Server running on http://0.0.0.0:${PORT}`);
});
