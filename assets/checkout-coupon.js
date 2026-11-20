/* =========================================================
   LORA — Checkout coupon box
   - Shows inside checkout, right under the order summary.
   - Lists "show at checkout" coupons as one-tap chips ("Tap to apply").
   - Auto-applies the coupon the shopper claimed from the offer poster, or the
     best eligible public coupon, so nobody pays more than they need to.
   - Recomputes when the bag total changes; the server re-validates the code
     again at the moment the order is placed (window.loraCouponRevalidate).
   ========================================================= */
(function () {
  'use strict';
  if (window.__loraCouponBox) return;
  window.__loraCouponBox = true;

  var CLAIM_KEY = 'lora_claimed_coupon_v1';
  var REMOVED_KEY = 'lora_coupon_removed_v1';
  var publicCoupons = [];
  var applied = null;      // { code, discount, finalAmount }
  var lastSubtotal = 0;
  var box = null;

  var inr = function (n) { return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN'); };
  function subtotal() { return window.__loraGetCheckoutSubtotal ? window.__loraGetCheckoutSubtotal() : 0; }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function localEval(c, amount) {
    if (!c) return { valid: false };
    if (c.minOrder && amount < c.minOrder) return { valid: false, shortBy: c.minOrder - amount };
    var d = c.type === 'flat' ? c.value : Math.round(amount * c.value / 100);
    if (c.maxDiscount) d = Math.min(d, c.maxDiscount);
    d = Math.min(d, Math.max(0, amount - 500));
    return { valid: d > 0, code: c.code, discount: d, finalAmount: amount - d };
  }
  function label(c) {
    var off = c.type === 'flat' ? inr(c.value) + ' OFF' : c.value + '% OFF';
    if (c.type !== 'flat' && c.maxDiscount) off += ' (up to ' + inr(c.maxDiscount) + ')';
    return off;
  }

  function validate(code, amount) {
    return fetch('/api/coupons/validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, amount: amount })
    }).then(function (r) { return r.json(); });
  }

  // Called by the checkout submit handler right before creating the order/payment.
  window.loraCouponRevalidate = function (amount) {
    if (!applied) return Promise.resolve(null);
    return validate(applied.code, amount).then(function (r) {
      if (!r || !r.valid) { setApplied(null, r && r.message); return null; }
      return r;
    });
  };

  function build() {
    var card = document.getElementById('chk-order-items-card');
    if (!card || document.getElementById('lcp-box')) return !!card;
    box = document.createElement('div');
    box.id = 'lcp-box';
    box.className = 'lcp-box';
    box.innerHTML =
      '<div class="lcp-applied" id="lcp-applied" hidden></div>' +
      '<div class="lcp-entry" id="lcp-entry">' +
        '<div class="lcp-head">🏷️ <strong>Have a coupon code?</strong></div>' +
        '<div class="lcp-chips" id="lcp-chips"></div>' +
        '<div class="lcp-row">' +
          '<input type="text" id="lcp-input" placeholder="Enter coupon code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="24">' +
          '<button type="button" id="lcp-apply">Apply</button>' +
        '</div>' +
        '<div class="lcp-msg" id="lcp-msg" role="status" aria-live="polite"></div>' +
      '</div>' +
      '<div class="lcp-bill" id="lcp-bill" hidden>' +
        '<div><span>Subtotal</span><span id="lcp-sub"></span></div>' +
        '<div class="lcp-disc"><span id="lcp-disc-label">Coupon</span><span id="lcp-disc"></span></div>' +
        '<div class="lcp-total"><span>You pay</span><span id="lcp-total"></span></div>' +
      '</div>';
    card.parentNode.insertBefore(box, card.nextSibling);

    var input = box.querySelector('#lcp-input');
    box.querySelector('#lcp-apply').addEventListener('click', function () { applyCode(input.value, true); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); applyCode(input.value, true); } });
    input.addEventListener('input', function () { input.value = input.value.toUpperCase().replace(/\s/g, ''); });
    return true;
  }

  function msg(text, kind) {
    var m = document.getElementById('lcp-msg');
    if (!m) return;
    m.textContent = text || '';
    m.className = 'lcp-msg' + (kind ? ' is-' + kind : '');
  }

  function renderChips() {
    var wrap = document.getElementById('lcp-chips');
    if (!wrap) return;
    var amt = subtotal();
    var list = publicCoupons.filter(function (c) { return !applied || c.code !== applied.code; });
    wrap.innerHTML = list.map(function (c) {
      var ev = localEval(c, amt);
      var sub = ev.valid ? 'Save ' + inr(ev.discount) : (ev.shortBy ? 'Add ' + inr(ev.shortBy) + ' more' : (c.description || ''));
      return '<button type="button" class="lcp-chip' + (ev.valid ? '' : ' is-locked') + '" data-code="' + esc(c.code) + '">' +
        '<b>' + esc(c.code) + '</b><span>' + esc(label(c)) + ' · ' + esc(sub) + '</span><em>' + (ev.valid ? 'Apply' : '🔒') + '</em></button>';
    }).join('');
    wrap.querySelectorAll('.lcp-chip').forEach(function (b) {
      b.addEventListener('click', function () { applyCode(b.getAttribute('data-code'), true); });
    });
  }

  function paint() {
    if (!box) return;
    var amt = subtotal();
    var ap = document.getElementById('lcp-applied');
    var entry = document.getElementById('lcp-entry');
    var bill = document.getElementById('lcp-bill');
    var priceEl = document.getElementById('chk-summary-price');
    if (applied) {
      ap.hidden = false;
      ap.innerHTML = '<span class="lcp-ok">🎉 <b>' + esc(applied.code) + '</b> applied — you save <b>' + inr(applied.discount) + '</b></span>' +
        '<button type="button" id="lcp-remove">Remove</button>';
      ap.querySelector('#lcp-remove').addEventListener('click', function () {
        try { sessionStorage.setItem(REMOVED_KEY, applied.code); } catch (e) {}
        setApplied(null);
      });
      entry.hidden = true;
      bill.hidden = false;
      document.getElementById('lcp-sub').textContent = inr(amt);
      document.getElementById('lcp-disc-label').textContent = 'Coupon (' + applied.code + ')';
      document.getElementById('lcp-disc').textContent = '− ' + inr(applied.discount);
      document.getElementById('lcp-total').textContent = inr(applied.finalAmount);
      if (priceEl) priceEl.innerHTML = '<s class="lcp-strike">' + inr(amt) + '</s> ' + inr(applied.finalAmount);
    } else {
      ap.hidden = true;
      entry.hidden = false;
      bill.hidden = true;
      if (priceEl && priceEl.querySelector('.lcp-strike')) priceEl.textContent = inr(amt);
    }
    renderChips();
  }

  function setApplied(r, why) {
    applied = r && r.valid ? { code: r.code, discount: r.discount, finalAmount: r.finalAmount } : null;
    if (!applied && why) msg(why, 'warn');
    paint();
  }

  function applyCode(code, manual) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!code) { msg('Please enter a coupon code.', 'warn'); return Promise.resolve(); }
    var amt = subtotal();
    if (manual) msg('Checking…');
    return validate(code, amt).then(function (r) {
      if (r && r.valid) {
        try { sessionStorage.removeItem(REMOVED_KEY); } catch (e) {}
        msg('');
        setApplied(r);
        var inp = document.getElementById('lcp-input'); if (inp) inp.value = '';
        if (window.loraTrack) window.loraTrack('CouponApplied', { coupon: r.code, value: r.discount, currency: 'INR' });
      } else if (manual) {
        msg((r && r.message) || 'This coupon code is not valid.', 'warn');
      }
    }).catch(function () { if (manual) msg('Could not check the code right now. Please try again.', 'warn'); });
  }

  // Auto-apply: claimed poster code first, else best eligible public coupon.
  function autoApply() {
    if (applied) return;
    var removed = '';
    try { removed = sessionStorage.getItem(REMOVED_KEY) || ''; } catch (e) {}
    var amt = subtotal();
    var claimed = '';
    try { claimed = localStorage.getItem(CLAIM_KEY) || ''; } catch (e) {}
    if (claimed && claimed !== removed) { applyCode(claimed, false); return; }
    var best = null;
    publicCoupons.forEach(function (c) {
      if (c.code === removed) return;
      var ev = localEval(c, amt);
      if (ev.valid && (!best || ev.discount > best.discount)) best = ev;
    });
    if (best) applyCode(best.code, false);
  }

  function loadCoupons() {
    return fetch('/api/coupons', { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (d) { publicCoupons = (d && d.coupons) || []; })
      .catch(function () { publicCoupons = []; });
  }

  // Watch the checkout modal: build once, auto-apply on open, re-price on bag changes.
  var wasOpen = false;
  setInterval(function () {
    var m = document.getElementById('checkout-modal');
    var open = !!(m && m.classList.contains('active') && getComputedStyle(m).display !== 'none');
    if (open && !wasOpen) {
      build();
      loadCoupons().then(function () { lastSubtotal = subtotal(); paint(); autoApply(); });
    }
    if (open && box) {
      var amt = subtotal();
      if (amt !== lastSubtotal) {
        lastSubtotal = amt;
        if (applied) applyCode(applied.code, false).then(function () { if (!applied) autoApply(); });
        else { paint(); autoApply(); }
      } else if (applied) {
        var priceEl = document.getElementById('chk-summary-price');
        if (priceEl && !priceEl.querySelector('.lcp-strike')) paint();   // summary re-rendered by checkout
      }
    }
    wasOpen = open;
  }, 600);

  // After an order: count the use, clear the claimed code.
  document.addEventListener('lora:order_placed', function (e) {
    var o = e && e.detail;
    if (o && o.couponCode) {
      fetch('/api/coupons/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: o.couponCode, orderId: o.id }) }).catch(function () {});
    }
    try { localStorage.removeItem(CLAIM_KEY); sessionStorage.removeItem(REMOVED_KEY); } catch (err) {}
    applied = null;
    window.__loraOrderCoupon = null;
    paint();
  });

  // Styles (kept here so the feature is one drop-in file)
  var css = document.createElement('style');
  css.textContent =
    '.lcp-box [hidden]{display:none!important}' +
    '.lcp-box{background:#FFFFFF;border:1px dashed #C26136;border-radius:12px;padding:.7rem .85rem;margin:0 0 .75rem;font-size:.82rem;color:#44403C}' +
    '.lcp-head{margin-bottom:.45rem;color:#1C1917}' +
    '.lcp-chips{display:flex;flex-direction:column;gap:.4rem;margin-bottom:.5rem}' +
    '.lcp-chips:empty{display:none}' +
    '.lcp-chip{display:flex;align-items:center;gap:.55rem;width:100%;text-align:left;background:#FFF8F2;border:1px solid rgba(194,97,54,.3);border-radius:10px;padding:.5rem .65rem;cursor:pointer;font:inherit;color:#44403C}' +
    '.lcp-chip b{flex-shrink:0;color:#9E461E;letter-spacing:.05em;border:1px dashed #C26136;border-radius:6px;padding:.1rem .4rem;background:#FFF}' +
    '.lcp-chip span{flex:1;min-width:0;font-size:.76rem}' +
    '.lcp-chip em{font-style:normal;font-weight:800;color:#C26136;font-size:.76rem}' +
    '.lcp-chip.is-locked{opacity:.7;background:#FAF7F2}' +
    '.lcp-row{display:flex;gap:.45rem}' +
    '.lcp-row input{flex:1;min-width:0;height:40px;border:1.5px solid #E8DFD5;border-radius:9px;padding:0 .7rem;font:inherit;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#1C1917;background:#fff}' +
    '.lcp-row input:focus{outline:none;border-color:#C26136;box-shadow:0 0 0 3px rgba(194,97,54,.15)}' +
    '.lcp-row button{height:40px;padding:0 1rem;border:0;border-radius:9px;background:#1C1917;color:#fff;font:inherit;font-weight:800;cursor:pointer}' +
    '.lcp-msg{margin-top:.35rem;font-size:.76rem;min-height:0}' +
    '.lcp-msg.is-warn{color:#B45309}' +
    '.lcp-applied{display:flex;align-items:center;justify-content:space-between;gap:.5rem;background:#ECFDF5;border:1px solid #A7F3D0;border-radius:9px;padding:.5rem .65rem;color:#065F46}' +
    '.lcp-applied button{background:none;border:0;color:#9E461E;font:inherit;font-size:.76rem;font-weight:700;text-decoration:underline;cursor:pointer;flex-shrink:0}' +
    '.lcp-bill{margin-top:.55rem;display:flex;flex-direction:column;gap:.25rem;font-size:.8rem}' +
    '.lcp-bill>div{display:flex;justify-content:space-between}' +
    '.lcp-disc{color:#047857;font-weight:700}' +
    '.lcp-total{border-top:1px solid #E8DFD5;padding-top:.3rem;font-weight:800;color:#1C1917;font-size:.9rem}' +
    '.lcp-strike{color:#A8A29E;font-weight:600;font-size:.82rem;margin-right:.2rem}';
  document.head.appendChild(css);
})();
