/* =========================================================
   LORA — Meta Ads tracking layer (Pixel + Conversions API)
   - Loads the pixel id from the server (admin-configured), so every
     visitor is tracked, not only the admin's own browser.
   - Every event fires in the browser AND through the server relay
     (/api/meta-event) with the same event_id → Meta de-duplicates,
     match quality goes up and ad delivery cost goes down.
   - Advanced matching (phone / name / PIN) from the logged-in customer
     is sent to Meta hashed (SHA-256); raw values never leave in clear
     to Meta and are never logged.
   - Captures fbclid (→ _fbc), utm_* and attaches attribution to orders.
   Public API:  window.loraTrack(eventName, customData?, { user? })
   ========================================================= */
(function () {
  'use strict';
  if (window.loraTrack) return;

  var CFG_KEY = 'lora_mkt_cfg_v2';
  var ATTR_KEY = 'lora_attr_v1';
  var FIRED_KEY = 'lora_fired_purchases_v1';
  var queue = [];
  var cfg = null;
  var pixelReady = false;

  // ---------------- cookies / ids ----------------
  function getCookie(n) {
    var m = document.cookie.match('(?:^|; )' + n.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&') + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : '';
  }
  function setCookie(n, v, days) {
    var d = new Date(Date.now() + days * 864e5).toUTCString();
    var host = location.hostname.replace(/^www\./, '');
    var domain = /^[\d.]+$|localhost/.test(host) ? '' : '; domain=.' + host;
    document.cookie = n + '=' + encodeURIComponent(v) + '; expires=' + d + '; path=/; SameSite=Lax' + domain;
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  // ---------------- attribution (fbclid / utm) ----------------
  var params = new URLSearchParams(location.search);
  var fbclid = params.get('fbclid');
  if (fbclid) setCookie('_fbc', 'fb.1.' + Date.now() + '.' + fbclid, 90);
  if (!getCookie('_fbp')) setCookie('_fbp', 'fb.1.' + Date.now() + '.' + Math.floor(Math.random() * 1e10), 90);

  var touch = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'].forEach(function (k) {
    var v = params.get(k);
    if (v) touch[k] = v.slice(0, 120);
  });
  try {
    var attr = JSON.parse(localStorage.getItem(ATTR_KEY) || '{}');
    if (Object.keys(touch).length) {
      touch.landing = location.pathname + location.search.slice(0, 200);
      touch.at = new Date().toISOString();
      if (!attr.first) attr.first = touch;
      attr.last = touch;
      if (document.referrer && !attr.referrer) attr.referrer = document.referrer.slice(0, 200);
      localStorage.setItem(ATTR_KEY, JSON.stringify(attr));
    }
  } catch (e) {}
  function getAttribution() {
    try { return JSON.parse(localStorage.getItem(ATTR_KEY) || 'null'); } catch (e) { return null; }
  }
  window.loraGetAttribution = getAttribution;

  // ---------------- advanced matching ----------------
  function customerData() {
    var c = null;
    try { c = JSON.parse(localStorage.getItem('lora_customer_session_v1') || 'null'); } catch (e) {}
    var lumi = null;
    try { lumi = JSON.parse(sessionStorage.getItem('lora_lumi_lead_v1') || 'null'); } catch (e) {}
    var u = {};
    var phone = (c && c.phone) || (lumi && lumi.phone) || window.verifiedCheckoutPhone || '';
    if (phone) u.ph = String(phone).replace(/\D/g, '');
    if (c) {
      if (c.name && !/^lora sleeper$/i.test(c.name)) {
        var parts = String(c.name).trim().split(/\s+/);
        u.fn = parts[0];
        if (parts.length > 1) u.ln = parts[parts.length - 1];
      }
      if (c.email && !/@customer\.loramattress\.com$/i.test(c.email)) u.em = c.email;
      if (c.pincode) u.zp = c.pincode;
      if (c.city) u.ct = c.city;
      if (c.state) u.st = c.state;
      if (c.id) u.external_id = c.id;
    }
    if (!u.zp && lumi && lumi.pincode) u.zp = lumi.pincode;
    return u;
  }
  // pixel-side advanced matching keys (pixel hashes them itself)
  function pixelMatching(u) {
    var m = {};
    if (u.ph) m.ph = u.ph.length === 10 ? '91' + u.ph : u.ph;
    if (u.em) m.em = String(u.em).toLowerCase();
    if (u.fn) m.fn = String(u.fn).toLowerCase();
    if (u.ln) m.ln = String(u.ln).toLowerCase();
    if (u.zp) m.zp = String(u.zp).replace(/\D/g, '');
    if (u.ct) m.ct = String(u.ct).toLowerCase().replace(/[^a-z]/g, '');
    if (u.st) m.st = String(u.st).toLowerCase().replace(/[^a-z]/g, '');
    if (u.external_id) m.external_id = u.external_id;
    m.country = 'in';
    return m;
  }

  // ---------------- pixel loader ----------------
  function loadPixel(id) {
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', id, pixelMatching(customerData()));
    pixelReady = true;
  }
  function loadGa4(id) {
    if (!id || window.gtag) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id);
  }

  // ---------------- server relay (CAPI) ----------------
  var relayBuf = [], relayT = null;
  function relay(evt) {
    if (!cfg || !cfg.capi) return;
    relayBuf.push(evt);
    clearTimeout(relayT);
    relayT = setTimeout(flushRelay, evt.event_name === 'Purchase' ? 0 : 400);
  }
  function flushRelay() {
    if (!relayBuf.length) return;
    var body = JSON.stringify({ events: relayBuf.splice(0, 10) });
    var sent = false;
    try {
      if (navigator.sendBeacon) sent = navigator.sendBeacon('/api/meta-event', new Blob([body], { type: 'application/json' }));
    } catch (e) {}
    if (!sent) {
      try { _fetch('/api/meta-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }); } catch (e) {}
    }
    if (relayBuf.length) flushRelay();
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushRelay(); });

  // ---------------- public track ----------------
  var GA_MAP = { ViewContent: 'view_item', AddToCart: 'add_to_cart', InitiateCheckout: 'begin_checkout', Purchase: 'purchase', Lead: 'generate_lead', Search: 'search' };
  function track(name, data, opts) {
    data = data || {};
    opts = opts || {};
    if (!cfg) { queue.push([name, data, opts]); return; }
    if (!cfg.enabled) return;
    var eventId = opts.eventId || (name + '.' + uuid());
    if (data.value !== undefined) { data.value = Math.round(Number(data.value) || 0); data.currency = data.currency || 'INR'; }
    if (pixelReady && window.fbq) {
      var std = ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase', 'Lead', 'CompleteRegistration', 'Contact', 'Search', 'FindLocation'].indexOf(name) !== -1;
      window.fbq(std ? 'track' : 'trackCustom', name, data, { eventID: eventId });
    }
    if (window.gtag && GA_MAP[name]) {
      window.gtag('event', GA_MAP[name], { value: data.value, currency: data.currency, transaction_id: data.order_id, items: (data.content_ids || []).map(function (id) { return { item_id: id, item_name: data.content_name }; }) });
    }
    var u = customerData();
    if (opts.user) Object.keys(opts.user).forEach(function (k) { if (opts.user[k]) u[k] = opts.user[k]; });
    u.fbp = getCookie('_fbp');
    u.fbc = getCookie('_fbc');
    relay({ event_name: name, event_id: eventId, event_source_url: location.href.split('#')[0], custom_data: data, user_data: u });
  }
  window.loraTrack = track;

  // ---------------- product id helpers (must match /meta-catalog feed ids) ----------------
  function modelFromName(name) {
    var m = String(name || '').match(/^(\d{2})\b/);
    return m ? m[1] : '';
  }
  function sizeKey(spec) {
    var s = String(spec || '').toLowerCase();
    if (s.indexOf('king') !== -1) return 'KING';
    if (s.indexOf('queen') !== -1) return 'QUEEN';
    if (s.indexOf('double') !== -1) return 'DOUBLE';
    if (s.indexOf('single') !== -1) return 'SINGLE';
    return '';
  }
  function contentId(name, spec) {
    var m = modelFromName(name);
    if (!m) return '';
    var sz = sizeKey(spec);
    return sz ? 'LORA-' + m + '-' + sz : 'LORA-' + m;
  }
  window.loraContentId = contentId;
  function priceNum(v) { return Number(String(v == null ? '' : v).replace(/[^\d.]/g, '')) || 0; }

  // Convenience helpers used by the storefront
  window.loraTrackAddToCart = function (item) {
    if (!item) return;
    var id = contentId(item.title || item.productName, item.specs || item.size);
    track('AddToCart', {
      content_ids: id ? [id] : [], content_type: id && id.split('-').length > 2 ? 'product' : 'product_group',
      content_name: item.title || item.productName, value: priceNum(item.price), currency: 'INR', num_items: 1
    });
  };
  window.loraTrackCheckout = function (items) {
    items = Array.isArray(items) ? items : [];
    var ids = items.map(function (i) { return contentId(i.title || i.productName, i.specs || i.size); }).filter(Boolean);
    var total = items.reduce(function (s, i) { return s + priceNum(i.price) * (i.quantity || 1); }, 0);
    track('InitiateCheckout', { content_ids: ids, content_type: 'product', value: total, currency: 'INR', num_items: items.length || 1 });
  };

  // ---------------- fetch hook: Purchase + Lead + attribution on orders ----------------
  var _fetch = window.fetch ? window.fetch.bind(window) : null;
  function firedBefore(id) {
    try {
      var list = JSON.parse(localStorage.getItem(FIRED_KEY) || '[]');
      if (list.indexOf(id) !== -1) return true;
      list.push(id);
      localStorage.setItem(FIRED_KEY, JSON.stringify(list.slice(-50)));
    } catch (e) {}
    return false;
  }
  function onOrder(o) {
    if (!o || !o.id || firedBefore(o.id)) return;
    var st = String(o.status || o.paymentStatus || '').toLowerCase();
    if (/declined|failed|cancel/.test(st)) return;
    var items = Array.isArray(o.items) && o.items.length ? o.items : [{ title: o.productName, specs: o.size, price: o.totalPrice, quantity: o.quantity }];
    var ids = items.map(function (i) { return contentId(i.title || i.productName, i.specs || i.size || o.size); }).filter(Boolean);
    var digits = String(o.phone || '').replace(/\D/g, '');
    track('Purchase', {
      content_ids: ids, content_type: 'product', value: priceNum(o.totalPrice), currency: 'INR',
      num_items: items.length, order_id: o.id, contents: ids.map(function (id) { return { id: id, quantity: 1 }; })
    }, {
      eventId: 'purchase.' + o.id,   // stable id: browser + server + retries collapse into one purchase
      user: { ph: digits, zp: o.addressDetails && o.addressDetails.pincode, ct: o.addressDetails && o.addressDetails.city, st: o.addressDetails && o.addressDetails.state, fn: String(o.customerName || '').split(/\s+/)[0] }
    });
  }
  if (_fetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      var path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
      var parsed = null;
      if (method === 'POST' && init && typeof init.body === 'string' && (path === '/api/orders' || path === '/api/store-leads')) {
        try { parsed = JSON.parse(init.body); } catch (e) {}
        // attach marketing attribution to new orders (visible in admin, used for ROAS)
        if (parsed && path === '/api/orders') {
          var a = getAttribution();
          var fbc = getCookie('_fbc');
          var stamp = function (o) { if (o && typeof o === 'object' && !o.attribution) o.attribution = { first: a && a.first, last: a && a.last, referrer: a && a.referrer, fbc: fbc || undefined }; };
          if (parsed.order) stamp(parsed.order);
          if (Array.isArray(parsed.orders)) parsed.orders.forEach(stamp);
          try { init = Object.assign({}, init, { body: JSON.stringify(parsed) }); } catch (e) {}
        }
      }
      var p = _fetch(input, init);
      if (parsed) {
        p.then(function (res) {
          if (!res || !res.ok) return;
          if (path === '/api/orders') {
            if (parsed.order) onOrder(parsed.order);
            if (Array.isArray(parsed.orders)) parsed.orders.forEach(onOrder);
          } else if (path === '/api/store-leads') {
            var lead = parsed.lead || parsed;
            var isLumi = /lumi/i.test(lead.source || '') || lead.resultType === 'lumi_consultation';
            var mid = modelFromName(lead.preferredMattress);
            track('Lead', {
              content_name: isLumi ? 'Lumi AI consultation' : 'Store locator enquiry',
              content_category: isLumi ? 'lumi' : 'store_locator',
              content_ids: mid ? ['LORA-' + mid] : undefined
            }, { eventId: 'lead.' + (lead.id || uuid()), user: { ph: String(lead.phone || '').replace(/\D/g, ''), zp: lead.pincode, fn: String(lead.name || '').split(/\s+/)[0] } });
          }
        }).catch(function () {});
      }
      return p;
    };
  }

  // ---------------- engagement signal (cheap optimisation audience) ----------------
  var engaged = false, start = Date.now(), maxScroll = 0;
  function checkEngaged() {
    if (engaged) return;
    var h = document.documentElement;
    maxScroll = Math.max(maxScroll, (window.scrollY + window.innerHeight) / Math.max(1, h.scrollHeight));
    if (Date.now() - start > 30000 && maxScroll > .4) {
      engaged = true;
      if (pixelReady && window.fbq) window.fbq('trackCustom', 'EngagedVisitor', { scroll: Math.round(maxScroll * 100) });
    }
  }
  var engT = setInterval(function () { checkEngaged(); if (engaged) clearInterval(engT); }, 5000);

  // ---------------- boot ----------------
  function boot(c) {
    cfg = c || { enabled: false };
    if (cfg.enabled && cfg.metaPixelId) loadPixel(cfg.metaPixelId);
    if (cfg.enabled && cfg.ga4Id) loadGa4(cfg.ga4Id);
    track('PageView', {});
    // ViewContent on product pages (matches catalog item_group_id → Advantage+ retargeting)
    var model = (params.get('model') || '').replace(/\D/g, '');
    if (/product\.html|\/products\//.test(location.pathname) && model) {
      var size = (params.get('size') || '').toUpperCase();
      var send = function (price, name) {
        track('ViewContent', {
          content_ids: [size ? 'LORA-' + model + '-' + size : 'LORA-' + model],
          content_type: size ? 'product' : 'product_group',
          content_name: name || ('LORA ' + model), value: price || undefined, currency: 'INR'
        });
      };
      _fetch('/api/catalog').then(function (r) { return r.json(); }).then(function (d) {
        var cat = d && (d.catalog || d);
        var prod = cat && (cat[model] || (Array.isArray(cat) ? cat.find(function (p) { return p.id === model; }) : null));
        send(prod && prod.basePrice, prod && prod.name);
      }).catch(function () { send(); });
    }
    var q = queue.splice(0);
    q.forEach(function (a) { track(a[0], a[1], a[2]); });
  }
  try {
    var cached = JSON.parse(sessionStorage.getItem(CFG_KEY) || 'null');
    if (cached && Date.now() - cached.t < 10 * 60 * 1000) { boot(cached.c); return; }
  } catch (e) {}
  (_fetch ? _fetch('/api/marketing-settings', { cache: 'no-store' }) : Promise.reject())
    .then(function (r) { return r.json(); })
    .then(function (c) {
      try { sessionStorage.setItem(CFG_KEY, JSON.stringify({ t: Date.now(), c: c })); } catch (e) {}
      boot(c);
    })
    .catch(function () { boot({ enabled: false }); });
})();
