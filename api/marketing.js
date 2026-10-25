// LORA — Meta Ads + SEO server module
// -------------------------------------------------------------
//  GET  /api/marketing-settings      public: pixel id / GA4 id (no secrets)
//  POST /api/marketing-settings      admin : save settings
//  POST /api/meta-event              public: browser → Meta Conversions API relay
//                                     (server-side hashing, IP + UA enrichment, dedup by event_id)
//  GET  /api/meta-status             admin : CAPI configuration status (never returns the token)
//  GET  /meta-catalog.csv | .xml     Commerce Manager product feed (Advantage+ catalog ads)
//  GET  /sitemap.xml  /robots.txt    SEO
//  renderSeoHead(html, page, req)    server-side meta / Open Graph / JSON-LD injection
//
//  Secrets come only from environment variables:
//    META_CAPI_TOKEN   – Conversions API access token (Events Manager → Settings)
//    META_PIXEL_ID     – optional override of the pixel id saved in admin
//    SITE_URL          – canonical origin, e.g. https://loramattress.com
// -------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { verifyAdminAuth } = require('./auth.js');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'marketing_settings.json');
const CATALOG_FILE = path.join(CONFIG_DIR, 'catalog_data.json');
const GRAPH_VERSION = 'v21.0';
const BRAND = 'LORA Mattress';
const ALLOWED_EVENTS = new Set(['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase', 'Lead', 'CompleteRegistration', 'Contact', 'Search', 'FindLocation']);

const SIZE_LABELS = { single: 'Single (72x36)', double: 'Double (72x48)', queen: 'Queen (78x60)', king: 'King (78x72)' };

// ---------------------------------------------------------------- helpers
function readJson(file, fallback) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  return fallback;
}
function readSettings() {
  const s = readJson(SETTINGS_FILE, {}) || {};
  return {
    enabled: s.enabled !== false,
    metaPixelId: String(process.env.META_PIXEL_ID || s.metaPixelId || '').replace(/\D/g, ''),
    ga4Id: String(s.ga4Id || '').trim(),
    testEventCode: String(s.testEventCode || '').trim(),
    domainVerification: String(s.domainVerification || '').trim(),
    googleVerification: String(s.googleVerification || '').trim(),
    capiEnabled: s.capiEnabled !== false
  };
}
function capiToken() { return String(process.env.META_CAPI_TOKEN || '').trim(); }
function siteOrigin(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const h = (req && req.headers) || {};
  const host = h['x-forwarded-host'] || h.host || 'loramattress.com';
  const proto = (h['x-forwarded-proto'] || '').split(',')[0] || (/localhost|127\.0\.0\.1/.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}
function sha256(v) { return crypto.createHash('sha256').update(v).digest('hex'); }
function isHashed(v) { return /^[a-f0-9]{64}$/.test(v); }
function normPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 10) d = '91' + d;           // Indian numbers default to +91
  if (d.length === 11 && d.startsWith('0')) d = '91' + d.slice(1);
  return d.length >= 11 ? d : '';
}
function hashField(v, norm) {
  if (!v) return undefined;
  const s = String(v).trim().toLowerCase();
  if (isHashed(s)) return s;
  const n = norm ? norm(s) : s;
  return n ? sha256(n) : undefined;
}
function clientIp(req) {
  const xf = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || (req.socket && req.socket.remoteAddress) || '';
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function cleanName(n) { return String(n || '').replace(/^\d{2}\.\s*/, '').replace(/™/g, '').trim(); }
function loadCatalog() {
  const raw = readJson(CATALOG_FILE, {}) || {};
  const list = Array.isArray(raw) ? raw : Object.values(raw.products || raw);
  return list.filter(p => p && p.id && p.name).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}
function absUrl(origin, p) {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  return origin + '/' + String(p).replace(/^\/+/, '');
}
function productUrl(origin, id) { return `${origin}/product.html?model=${encodeURIComponent(id)}`; }
function productDescription(p) {
  const bits = [p.tagline, p.feelLabel && `Feel: ${p.feelLabel}`, p.warranty, p.postureRec].filter(Boolean);
  return bits.join('. ').replace(/\.\./g, '.').slice(0, 4900) || `${cleanName(p.name)} mattress by LORA — direct from factory.`;
}

// ---------------------------------------------------------------- tiny rate limit for the public relay
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { n: 0, t: now };
  if (now - rec.t > 60000) { rec.n = 0; rec.t = now; }
  rec.n++;
  hits.set(ip, rec);
  if (hits.size > 5000) hits.clear();
  return rec.n > 120;
}

function postGraph(pixelId, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'graph.facebook.com',
      path: `/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(capiToken())}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 8000
    }, (r) => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => { let j = {}; try { j = JSON.parse(data); } catch (e) {} resolve({ status: r.statusCode, body: j }); });
    });
    req.on('error', (e) => resolve({ status: 0, body: { error: { message: e.message } } }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: { error: { message: 'timeout' } } }); });
    req.write(body);
    req.end();
  });
}

// Build a CAPI event from a browser payload (PII hashed here, never logged)
function buildCapiEvent(e, req) {
  const u = e.user_data || {};
  const user = {
    client_ip_address: clientIp(req) || undefined,
    client_user_agent: req.headers['user-agent'] || undefined,
    fbp: u.fbp || undefined,
    fbc: u.fbc || undefined,
    ph: hashField(u.ph, normPhone),
    em: hashField(u.em, s => (s.includes('@') && !/@customer\.loramattress\.com$/.test(s) ? s : '')),
    fn: hashField(u.fn, s => s.split(/\s+/)[0]),
    ln: hashField(u.ln),
    ct: hashField(u.ct, s => s.replace(/[^a-z]/g, '')),
    st: hashField(u.st, s => s.replace(/[^a-z]/g, '')),
    zp: hashField(u.zp, s => s.replace(/\D/g, '').slice(0, 6)),
    country: sha256('in'),
    external_id: hashField(u.external_id)
  };
  Object.keys(user).forEach(k => user[k] === undefined && delete user[k]);
  const cd = e.custom_data && typeof e.custom_data === 'object' ? e.custom_data : {};
  const custom = {};
  ['value', 'currency', 'content_ids', 'content_type', 'content_name', 'content_category', 'contents', 'num_items', 'order_id', 'search_string', 'predicted_ltv'].forEach(k => {
    if (cd[k] !== undefined && cd[k] !== null && cd[k] !== '') custom[k] = cd[k];
  });
  if (custom.value !== undefined) { custom.value = Math.max(0, Number(custom.value) || 0); custom.currency = custom.currency || 'INR'; }
  return {
    event_name: e.event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: String(e.event_id || '').slice(0, 100) || undefined,
    event_source_url: String(e.event_source_url || '').slice(0, 1000) || undefined,
    action_source: 'website',
    user_data: user,
    custom_data: custom
  };
}

// ---------------------------------------------------------------- feeds
function feedRows(origin) {
  const rows = [];
  loadCatalog().forEach(p => {
    const mult = p.multipliers || { queen: 1 };
    const sizes = Object.keys(SIZE_LABELS).filter(s => mult[s]);
    if (!sizes.length) sizes.push('queen');
    sizes.forEach(size => {
      const price = Math.round((Number(p.basePrice) || 0) * (mult[size] || 1));
      const mrp = p.mrp ? Math.round(Number(p.mrp) * (mult[size] || 1)) : 0;
      const hasSale = mrp && mrp > price;
      rows.push({
        id: `LORA-${p.id}-${size.toUpperCase()}`,
        item_group_id: `LORA-${p.id}`,
        title: `LORA ${cleanName(p.name).replace(/^LORA\s+/i, '')} Mattress – ${SIZE_LABELS[size]}`.slice(0, 150),
        description: productDescription(p),
        availability: 'in stock',
        condition: 'new',
        price: `${hasSale ? mrp : price}.00 INR`,
        sale_price: hasSale ? `${price}.00 INR` : '',
        link: `${productUrl(origin, p.id)}&size=${size}&utm_source=facebook&utm_medium=catalog`,
        image_link: absUrl(origin, p.heroImg || p.img),
        additional_image_link: [p.roomImg, p.detailImg, p.explodedImg].filter(Boolean).map(i => absUrl(origin, i)).join(','),
        brand: 'LORA',
        google_product_category: 'Furniture > Beds & Accessories > Mattresses',
        fb_product_category: 'Home > Mattresses',
        product_type: p.category || 'Mattress',
        size: SIZE_LABELS[size],
        custom_label_0: p.warranty || '',
        custom_label_1: p.feelLabel || '',
        custom_label_2: price >= 30000 ? 'premium' : price >= 20000 ? 'mid' : 'value',
        shipping: 'IN:::0.00 INR'
      });
    });
  });
  return rows;
}
function toCsv(rows) {
  if (!rows.length) return 'id,title\n';
  const cols = Object.keys(rows[0]);
  const q = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n');
}
function toXml(rows, origin) {
  const items = rows.map(r => '    <item>\n' + Object.keys(r).filter(k => r[k] !== '').map(k => `      <g:${k}>${esc(r[k])}</g:${k}>`).join('\n') + '\n    </item>').join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>${BRAND} Catalog</title>\n    <link>${esc(origin)}</link>\n    <description>LORA mattresses – direct from factory</description>\n${items}\n  </channel>\n</rss>\n`;
}
function sitemap(origin) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [{ loc: origin + '/', pr: '1.0', cf: 'daily' }]
    .concat(loadCatalog().map(p => ({ loc: productUrl(origin, p.id), pr: '0.9', cf: 'weekly', img: absUrl(origin, p.heroImg), title: cleanName(p.name) })));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    urls.map(u => `  <url>\n    <loc>${esc(u.loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.cf}</changefreq>\n    <priority>${u.pr}</priority>${u.img ? `\n    <image:image><image:loc>${esc(u.img)}</image:loc><image:title>${esc(u.title)}</image:title></image:image>` : ''}\n  </url>`).join('\n') +
    '\n</urlset>\n';
}
function robots(origin) {
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin.html\nDisallow: /api/\nDisallow: /config/\nAllow: /api/meta-catalog\n\nSitemap: ${origin}/sitemap.xml\n`;
}

// ---------------------------------------------------------------- SEO head injection
function offerFor(p, origin) {
  const mult = p.multipliers || { queen: 1 };
  const prices = Object.keys(SIZE_LABELS).filter(s => mult[s]).map(s => Math.round(p.basePrice * mult[s]));
  const low = prices.length ? Math.min(...prices) : p.basePrice;
  const high = prices.length ? Math.max(...prices) : p.basePrice;
  const validUntil = new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10);
  return {
    '@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: low, highPrice: high, offerCount: prices.length || 1,
    availability: 'https://schema.org/InStock', url: productUrl(origin, p.id), priceValidUntil: validUntil,
    seller: { '@type': 'Organization', name: BRAND }
  };
}
function productLd(p, origin) {
  const years = (String(p.warranty || '').match(/\d+/) || [])[0];
  return {
    '@type': 'Product',
    '@id': productUrl(origin, p.id) + '#product',
    name: `LORA ${cleanName(p.name).replace(/^LORA\s+/i, '')} Mattress`,
    sku: `LORA-${p.id}`,
    mpn: `LORA-${p.id}`,
    brand: { '@type': 'Brand', name: 'LORA' },
    category: p.category || 'Mattress',
    description: productDescription(p),
    image: [p.heroImg, p.roomImg, p.detailImg].filter(Boolean).map(i => absUrl(origin, i)),
    url: productUrl(origin, p.id),
    offers: offerFor(p, origin),
    ...(years ? { additionalProperty: [{ '@type': 'PropertyValue', name: 'Warranty', value: `${years} years` }] } : {})
  };
}
function renderSeoHead(html, page, req) {
  const origin = siteOrigin(req);
  const s = readSettings();
  const catalog = loadCatalog();
  let title, desc, canonical, image, ld, ogType = 'website';
  let extra = [];
  const org = {
    '@type': 'Organization', '@id': origin + '/#org', name: BRAND, url: origin + '/',
    logo: absUrl(origin, 'assets/lora-logo.png'),
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', areaServed: 'IN', availableLanguage: ['en', 'hi', 'ml'] }
  };
  if (page === 'product') {
    const url = new URL(req.url, origin);
    const id = (url.searchParams.get('model') || '01').replace(/[^0-9a-z-]/gi, '');
    const p = catalog.find(x => String(x.id) === id) || catalog[0];
    if (!p) return html;
    const name = cleanName(p.name);
    const low = offerFor(p, origin).lowPrice;
    title = `${name} Mattress – ${p.warranty || 'Factory Warranty'} | Buy Online from ₹${Number(low).toLocaleString('en-IN')} | LORA`;
    desc = `${name}: ${p.tagline || ''}. ${p.warranty || ''}, free flat delivery across India, direct factory pricing. Sizes: Single, Double, Queen, King.`.replace(/\s+/g, ' ').slice(0, 300);
    canonical = productUrl(origin, p.id);
    image = absUrl(origin, p.heroImg);
    ogType = 'product';
    const crumbs = { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: origin + '/' },
      { '@type': 'ListItem', position: 2, name: 'Mattresses', item: origin + '/#the-collection' },
      { '@type': 'ListItem', position: 3, name, item: canonical }
    ] };
    ld = { '@context': 'https://schema.org', '@graph': [org, productLd(p, origin), crumbs] };
    // product-specific OG price tags (used by Meta link previews & catalog matching)
    extra = [
      `<meta property="product:price:amount" content="${low}" />`,
      `<meta property="product:price:currency" content="INR" />`,
      `<meta property="product:availability" content="in stock" />`,
      `<meta property="product:condition" content="new" />`,
      `<meta property="product:brand" content="LORA" />`,
      `<meta property="product:retailer_item_id" content="LORA-${esc(p.id)}-QUEEN" />`
    ];
  } else {
    title = 'LORA Mattress – Orthopedic, Latex & Hybrid Mattresses Online India | Up to 15 Yr Warranty';
    desc = 'Buy LORA orthopedic, natural latex, memory foam & pocket spring hybrid mattresses direct from factory. Free flat delivery across India, up to 15-year warranty, easy EMI. 5,00,000+ happy sleepers.';
    canonical = origin + '/';
    image = absUrl(origin, 'assets/hero-lora-flagship.jpg');
    ld = { '@context': 'https://schema.org', '@graph': [
      org,
      { '@type': 'WebSite', '@id': origin + '/#website', url: origin + '/', name: BRAND, publisher: { '@id': origin + '/#org' }, inLanguage: 'en-IN' },
      { '@type': 'ItemList', name: 'LORA Mattress Collection', itemListElement: catalog.map((p, i) => ({ '@type': 'ListItem', position: i + 1, item: productLd(p, origin) })) }
    ] };
  }
  const tags = [
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />`,
    `<meta name="theme-color" content="#060B1A" />`,
    `<meta property="og:site_name" content="${BRAND}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:alt" content="${esc(title)}" />`,
    ...extra,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    s.domainVerification ? `<meta name="facebook-domain-verification" content="${esc(s.domainVerification)}" />` : '',
    s.googleVerification ? `<meta name="google-site-verification" content="${esc(s.googleVerification)}" />` : '',
    s.metaPixelId ? `<link rel="preconnect" href="https://connect.facebook.net" crossorigin />` : '',
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`
  ].filter(Boolean).join('\n  ');

  let out = html;
  out = out.replace(/<title[^>]*>[\s\S]*?<\/title>/i, m => m.replace(/>[\s\S]*?</, `>${esc(title)}<`));
  out = out.replace(/(<meta name="description"[^>]*content=")[^"]*(")/i, `$1${esc(desc)}$2`);
  out = out.replace(/<!--LORA_SEO-->[\s\S]*?<!--\/LORA_SEO-->/, '');
  out = out.replace(/<\/head>/i, `  <!--LORA_SEO-->\n  ${tags}\n  <!--/LORA_SEO-->\n</head>`);
  return out;
}

// ---------------------------------------------------------------- HTTP handler
function send(res, status, type, body, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  if (cache) res.setHeader('Cache-Control', cache);
  res.end(body);
}
function json(res, status, obj) { send(res, status, 'application/json; charset=UTF-8', JSON.stringify(obj), 'no-store'); }

async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const origin = siteOrigin(req);

  if (p === '/robots.txt') return send(res, 200, 'text/plain; charset=UTF-8', robots(origin), 'public, max-age=3600');
  if (p === '/sitemap.xml') return send(res, 200, 'application/xml; charset=UTF-8', sitemap(origin), 'public, max-age=3600');
  if (p === '/meta-catalog.csv' || p === '/api/meta-catalog.csv') return send(res, 200, 'text/csv; charset=UTF-8', toCsv(feedRows(origin)), 'public, max-age=1800');
  if (p === '/meta-catalog.xml' || p === '/api/meta-catalog.xml') return send(res, 200, 'application/xml; charset=UTF-8', toXml(feedRows(origin), origin), 'public, max-age=1800');

  if (p === '/api/marketing-settings') {
    if (req.method === 'GET') {
      const s = readSettings();
      return json(res, 200, { success: true, enabled: s.enabled, metaPixelId: s.enabled ? s.metaPixelId : '', ga4Id: s.enabled ? s.ga4Id : '', capi: Boolean(s.enabled && s.capiEnabled && capiToken() && s.metaPixelId) });
    }
    if (req.method === 'POST') {
      if (!verifyAdminAuth(req)) return json(res, 401, { success: false, message: 'Unauthorized' });
      const b = req.body || {};
      const cur = readJson(SETTINGS_FILE, {}) || {};
      const next = {
        ...cur,
        enabled: b.enabled !== false,
        metaPixelId: String(b.metaPixelId || '').replace(/\D/g, '').slice(0, 20),
        ga4Id: String(b.ga4Id || '').trim().slice(0, 30),
        testEventCode: String(b.testEventCode || '').trim().slice(0, 30),
        domainVerification: String(b.domainVerification || '').replace(/[^a-z0-9]/gi, '').slice(0, 64),
        googleVerification: String(b.googleVerification || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 100),
        capiEnabled: b.capiEnabled !== false,
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2));
      return json(res, 200, { success: true, settings: { ...next } });
    }
  }

  if (p === '/api/meta-status' && req.method === 'GET') {
    if (!verifyAdminAuth(req)) return json(res, 401, { success: false, message: 'Unauthorized' });
    const s = readSettings();
    let test = null;
    if (url.searchParams.get('test') === '1' && s.metaPixelId && capiToken()) {
      const r = await postGraph(s.metaPixelId, {
        data: [{ event_name: 'PageView', event_time: Math.floor(Date.now() / 1000), action_source: 'website', event_source_url: origin + '/', user_data: { client_ip_address: clientIp(req), client_user_agent: req.headers['user-agent'] || 'admin-test' } }],
        ...(s.testEventCode ? { test_event_code: s.testEventCode } : {})
      });
      test = r.status === 200 ? { ok: true, received: r.body.events_received } : { ok: false, message: (r.body.error && r.body.error.message) || 'Request failed' };
    }
    return json(res, 200, {
      success: true,
      pixelConfigured: Boolean(s.metaPixelId),
      capiTokenConfigured: Boolean(capiToken()),
      capiActive: Boolean(s.enabled && s.capiEnabled && s.metaPixelId && capiToken()),
      testEventCode: s.testEventCode || null,
      feeds: { csv: origin + '/meta-catalog.csv', xml: origin + '/meta-catalog.xml' },
      sitemap: origin + '/sitemap.xml',
      products: loadCatalog().length,
      test
    });
  }

  if (p === '/api/meta-event' && req.method === 'POST') {
    const s = readSettings();
    if (!s.enabled || !s.capiEnabled || !s.metaPixelId || !capiToken()) return json(res, 200, { success: true, skipped: true });
    if (rateLimited(clientIp(req))) return json(res, 429, { success: false });
    const b = req.body || {};
    const list = (Array.isArray(b.events) ? b.events : [b]).slice(0, 10).filter(e => e && ALLOWED_EVENTS.has(e.event_name));
    if (!list.length) return json(res, 400, { success: false, message: 'No valid events' });
    const payload = { data: list.map(e => buildCapiEvent(e, req)) };
    if (s.testEventCode) payload.test_event_code = s.testEventCode;
    const r = await postGraph(s.metaPixelId, payload);
    if (r.status !== 200) console.warn('[META CAPI] rejected:', (r.body.error && r.body.error.message) || r.status);
    return json(res, 200, { success: r.status === 200 });
  }

  return json(res, 404, { success: false, message: 'Not found' });
}

module.exports = handler;
module.exports.renderSeoHead = renderSeoHead;
module.exports.buildCapiEvent = buildCapiEvent;
module.exports.feedRows = feedRows;
module.exports.isMarketingPath = (p) => ['/robots.txt', '/sitemap.xml', '/meta-catalog.csv', '/meta-catalog.xml', '/api/meta-catalog.csv', '/api/meta-catalog.xml', '/api/marketing-settings', '/api/meta-status', '/api/meta-event'].includes(p);
