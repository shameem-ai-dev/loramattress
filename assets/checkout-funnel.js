/* =========================================================
   LORA — Checkout funnel diagnostics + abandoned-checkout recovery
   1. InitiateCheckout fires ONCE per cart per 30 min (it was firing on every
      re-open / double click handler, inflating Ads Manager numbers).
   2. Step events (browser pixel + CAPI) show exactly where buyers drop:
        CheckoutFormStarted → CheckoutPhoneEntered → OTPRequested → OTPVerified
        → CheckoutAddressDone → PaymentWindowOpened → PaymentFailed / PaymentDismissed
   3. If a shopper typed a valid mobile number but left without ordering, the
      number is saved to Admin → Leads ("Checkout Abandoned") so the team can
      call / WhatsApp them back.
   ========================================================= */
(function () {
  'use strict';
  if (window.__loraFunnel) return;
  window.__loraFunnel = true;

  var SESSION_KEY = 'lora_funnel_steps_v1';
  var IC_KEY = 'lora_ic_last_v1';
  var orderPlaced = false;
  var abandonSent = {};

  function step(name, data) {
    var done = {};
    try { done = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}'); } catch (e) {}
    if (done[name]) return;
    done[name] = Date.now();
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(done)); } catch (e) {}
    if (window.loraTrack) window.loraTrack(name, data || {});
  }
  function resetSteps() { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} }

  // ---------- 1. de-duplicate InitiateCheckout ----------
  function wrapIC() {
    var orig = window.loraTrackCheckout;
    if (!orig || orig.__deduped) return !!orig;
    var wrapped = function (items) {
      var sig = '';
      try { sig = JSON.stringify((items || []).map(function (i) { return [i.title || i.productName, i.specs || i.size, i.price]; })); } catch (e) {}
      var last = {};
      try { last = JSON.parse(localStorage.getItem(IC_KEY) || '{}'); } catch (e) {}
      if (last.sig === sig && Date.now() - (last.t || 0) < 30 * 60 * 1000) return;
      try { localStorage.setItem(IC_KEY, JSON.stringify({ sig: sig, t: Date.now() })); } catch (e) {}
      return orig.apply(this, arguments);
    };
    wrapped.__deduped = true;
    window.loraTrackCheckout = wrapped;
    return true;
  }
  if (!wrapIC()) {
    var tries = 0, t = setInterval(function () { if (wrapIC() || ++tries > 40) clearInterval(t); }, 250);
  }

  // ---------- helpers ----------
  function val(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
  function phoneDigits() { return val('chk-customer-phone').replace(/\D/g, '').slice(-10); }
  function orderInfo() {
    var o = window.currentCheckoutOrder || {};
    var prod = (document.getElementById('chk-summary-product') || {}).textContent || o.productName || '';
    var specs = (document.getElementById('chk-summary-specs') || {}).textContent || o.size || '';
    var price = (document.getElementById('chk-summary-price') || {}).textContent || o.price || '';
    return { prod: String(prod).trim(), specs: String(specs).trim(), price: String(price).trim() };
  }

  // ---------- 2. step events from the checkout form ----------
  document.addEventListener('focusin', function (e) {
    if (e.target && e.target.closest && e.target.closest('#checkout-modal form, #checkout-modal input, #checkout-modal select')) {
      step('CheckoutFormStarted');
    }
  });
  document.addEventListener('input', function (e) {
    var id = e.target && e.target.id;
    if (!id || id.indexOf('chk-') !== 0) return;
    if (/^[6-9]\d{9}$/.test(phoneDigits())) step('CheckoutPhoneEntered');
    if (/^\d{6}$/.test(val('chk-customer-pincode')) && val('chk-customer-house') && val('chk-customer-street') && val('chk-customer-name')) {
      step('CheckoutAddressDone');
    }
  });

  // OTP send / verify outcomes (fetch wrapper; runs after lora-ads.js wrapper)
  if (window.fetch) {
    var _f = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = ((init && init.method) || 'GET').toUpperCase();
      var p = _f.apply(this, arguments);
      if (method === 'POST' && /\/api\/otp\/(send|verify)/.test(url)) {
        var isSend = /send/.test(url);
        p.then(function (res) {
          if (isSend) step(res && res.ok ? 'OTPRequested' : 'OTPSendFailed');
          else if (res && res.ok) step('OTPVerified');
          else if (window.loraTrack) window.loraTrack('OTPVerifyFailed', {});
        }).catch(function () { step(isSend ? 'OTPSendFailed' : 'OTPVerifyFailed'); });
      }
      return p;
    };
  }

  // Razorpay window opened / failed / dismissed
  function wrapRazorpay() {
    var R = window.Razorpay;
    if (typeof R !== 'function' || R.__loraWrapped) return;
    var W = function (opts) {
      opts = opts || {};
      var modal = opts.modal || (opts.modal = {});
      var od = modal.ondismiss;
      modal.ondismiss = function () { if (window.loraTrack) window.loraTrack('PaymentDismissed', {}); if (od) return od.apply(this, arguments); };
      var inst = new R(opts);
      var origOpen = inst.open;
      inst.open = function () { step('PaymentWindowOpened', { value: Math.round((opts.amount || 0) / 100), currency: 'INR' }); return origOpen.apply(inst, arguments); };
      try { inst.on('payment.failed', function () { if (window.loraTrack) window.loraTrack('PaymentFailed', {}); }); } catch (e) {}
      return inst;
    };
    Object.keys(R).forEach(function (k) { W[k] = R[k]; });
    W.prototype = R.prototype;
    W.__loraWrapped = true;
    window.Razorpay = W;
  }
  var rzT = setInterval(wrapRazorpay, 500);
  setTimeout(function () { clearInterval(rzT); }, 60000);

  // ---------- 3. abandoned-checkout recovery lead ----------
  document.addEventListener('lora:order_placed', function () { orderPlaced = true; resetSteps(); });

  function sendAbandon(reason) {
    if (orderPlaced) return;
    var ph = phoneDigits();
    if (!/^[6-9]\d{9}$/.test(ph) || abandonSent[ph]) return;
    abandonSent[ph] = true;
    var info = orderInfo();
    var body = JSON.stringify({
      id: 'abandon-' + ph + '-' + new Date().toISOString().slice(0, 10),
      name: val('chk-customer-name') || 'Checkout visitor',
      phone: '+91' + ph,
      pincode: val('chk-customer-pincode'),
      place: val('chk-customer-city'),
      preferredMattress: info.prod,
      preferredSize: info.specs,
      summary: 'Started checkout but did not complete (' + reason + '). Product: ' + info.prod + ' | ' + info.specs + ' | ' + info.price + '. Call / WhatsApp to help complete the order.',
      source: 'Checkout Abandoned',
      resultType: 'checkout_abandoned',
      status: 'New'
    });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon('/api/store-leads', new Blob([body], { type: 'application/json' }))) return;
    } catch (e) {}
    try { fetch('/api/store-leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }); } catch (e) {}
  }

  // modal closed without an order
  var lastOpen = false;
  setInterval(function () {
    var m = document.getElementById('checkout-modal');
    var open = !!(m && m.classList.contains('active') && getComputedStyle(m).display !== 'none');
    var conf = document.getElementById('checkout-confirmation-view');
    if (conf && conf.style.display === 'block') orderPlaced = true;
    if (lastOpen && !open) sendAbandon('closed checkout');
    if (!lastOpen && open) { orderPlaced = false; }
    lastOpen = open;
  }, 1000);
  // tab hidden / page left while checkout open
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && lastOpen) {
      // short grace: payment apps (UPI) hide the tab legitimately; only send if still no order after 2 min
      var ph = phoneDigits();
      setTimeout(function () { if (!orderPlaced && phoneDigits() === ph) sendAbandon('left the page'); }, 120000);
    }
  });
  window.addEventListener('pagehide', function () { if (lastOpen) sendAbandon('left the site'); });
})();
