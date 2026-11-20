/* =========================================================
   LORA — "Find My Size" + animated cot-measuring demo
   Self-mounting: works on the home page inline product view and on
   product.html. Placed right under the Bed Type buttons.
   ========================================================= */
(function () {
  'use strict';
  var TARGETS = [
    { bed: '.pdp-bed-pills-wrap', bedBtn: '.pdp-bed-pills-wrap [data-type]', inch: '#pdp-inch-container',
      setCustom: function (L, W) { if (window.setPdpCustomDim) { window.setPdpCustomDim('len', L); window.setPdpCustomDim('wid', W); } } },
    { bed: '.inner-bed-type-row', bedBtn: '.inner-bed-type-row [data-type]', inch: '#inner-inch-container',
      setCustom: function (L, W) { setInput('custom-len', L); setInput('custom-wid', W); } }
  ];
  var MARKUP = "<div class=\"lfs-wrap\" id=\"lfs-wrap\">\n  <!-- Animated \"how to measure your cot\" demo (pure SVG/CSS, 12s loop) -->\n  <div class=\"lfs-demo\" aria-label=\"Animation: measure the inside length and width of your cot, not the outer frame\">\n    <div class=\"lfs-caption\" aria-hidden=\"true\">\n      <span class=\"c0\">This is your cot (top view)</span>\n      <span class=\"c1\">Step 1 \u00b7 Measure the <b>inside length</b> (head \u2192 toe)</span>\n      <span class=\"c2\">Step 2 \u00b7 Measure the <b>inside width</b> (side \u2192 side)</span>\n      <span class=\"c3\">\u2717 Don't measure the <b>outer wooden edge</b></span>\n      <span class=\"c4\">\u2713 Your mattress fits perfectly inside</span>\n    </div>\n    <svg class=\"lfs-svg\" viewBox=\"0 0 320 175\" role=\"img\" aria-hidden=\"true\">\n      <defs>\n        <pattern id=\"lfsTicks\" width=\"8\" height=\"10\" patternUnits=\"userSpaceOnUse\">\n          <rect width=\"8\" height=\"10\" fill=\"#F2C14E\"/><line x1=\"0.5\" y1=\"0\" x2=\"0.5\" y2=\"4\" stroke=\"#7A5200\" stroke-width=\"1\"/>\n        </pattern>\n        <pattern id=\"lfsTicksV\" width=\"10\" height=\"8\" patternUnits=\"userSpaceOnUse\">\n          <rect width=\"10\" height=\"8\" fill=\"#F2C14E\"/><line x1=\"0\" y1=\"0.5\" x2=\"4\" y2=\"0.5\" stroke=\"#7A5200\" stroke-width=\"1\"/>\n        </pattern>\n      </defs>\n      <!-- cot frame -->\n      <rect x=\"30\" y=\"22\" width=\"260\" height=\"124\" rx=\"10\" fill=\"#8B5E3C\"/>\n      <rect x=\"30\" y=\"22\" width=\"260\" height=\"124\" rx=\"10\" fill=\"none\" stroke=\"#6F4A2F\" stroke-width=\"2\"/>\n      <rect class=\"lfs-inner\" x=\"42\" y=\"34\" width=\"236\" height=\"100\" rx=\"4\" fill=\"#EFE6DA\"/>\n      <rect x=\"20\" y=\"14\" width=\"16\" height=\"140\" rx=\"6\" fill=\"#6F4A2F\"/>\n      <text class=\"lfs-head\" x=\"28\" y=\"168\" text-anchor=\"middle\">HEAD</text>\n      <text class=\"lfs-head\" x=\"290\" y=\"168\" text-anchor=\"middle\">TOE</text>\n\n      <!-- wrong: outer edge -->\n      <g class=\"lfs-wrong\">\n        <rect x=\"27\" y=\"19\" width=\"266\" height=\"130\" rx=\"12\" fill=\"none\" stroke=\"#DC2626\" stroke-width=\"3\" stroke-dasharray=\"7 5\"/>\n        <circle cx=\"293\" cy=\"19\" r=\"11\" fill=\"#DC2626\"/><text x=\"293\" y=\"23.5\" text-anchor=\"middle\" class=\"lfs-x\">\u2717</text>\n      </g>\n\n      <!-- length tape -->\n      <rect class=\"lfs-tape-len\" x=\"42\" y=\"77\" width=\"236\" height=\"10\" fill=\"url(#lfsTicks)\" rx=\"2\"/>\n      <g class=\"lfs-case-len\"><rect x=\"-11\" y=\"-11\" width=\"22\" height=\"22\" rx=\"5\" fill=\"#C26136\"/><circle r=\"5\" fill=\"#FFFFFF\"/><circle r=\"2\" fill=\"#C26136\"/></g>\n      <g class=\"lfs-tag lfs-tag-len\"><rect x=\"108\" y=\"92\" width=\"104\" height=\"24\" rx=\"12\" fill=\"#1C1917\"/><text x=\"160\" y=\"108\" text-anchor=\"middle\">Length 78\u2033 \u00b7 6.5 ft</text></g>\n\n      <!-- width tape -->\n      <rect class=\"lfs-tape-wid\" x=\"231\" y=\"34\" width=\"10\" height=\"100\" fill=\"url(#lfsTicksV)\" rx=\"2\"/>\n      <g class=\"lfs-case-wid\"><rect x=\"-11\" y=\"-11\" width=\"22\" height=\"22\" rx=\"5\" fill=\"#C26136\"/><circle r=\"5\" fill=\"#FFFFFF\"/><circle r=\"2\" fill=\"#C26136\"/></g>\n      <g class=\"lfs-tag lfs-tag-wid\"><rect x=\"140\" y=\"40\" width=\"86\" height=\"24\" rx=\"12\" fill=\"#1C1917\"/><text x=\"183\" y=\"56\" text-anchor=\"middle\">Width 60\u2033 \u00b7 5 ft</text></g>\n\n      <!-- mattress drop-in -->\n      <g class=\"lfs-mattress\">\n        <rect x=\"43\" y=\"35\" width=\"234\" height=\"98\" rx=\"6\" fill=\"#FFFFFF\" stroke=\"#C26136\" stroke-width=\"2\"/>\n        <path d=\"M60 50 H260 M60 84 H260 M60 118 H260\" stroke=\"#F0E2D3\" stroke-width=\"2\"/>\n        <rect x=\"54\" y=\"52\" width=\"30\" height=\"64\" rx=\"10\" fill=\"#F6EEE4\"/>\n        <text x=\"160\" y=\"89\" text-anchor=\"middle\" class=\"lfs-brand\">LORA</text>\n      </g>\n      <g class=\"lfs-ok\"><circle cx=\"293\" cy=\"19\" r=\"11\" fill=\"#059669\"/><text x=\"293\" y=\"23.5\" text-anchor=\"middle\" class=\"lfs-x\">\u2713</text></g>\n    </svg>\n    <ol class=\"lfs-steps\">\n      <li class=\"s1\"><b>1</b> Inside length</li>\n      <li class=\"s2\"><b>2</b> Inside width</li>\n      <li class=\"s3\"><b>3</b> Enter below \u2193</li>\n    </ol>\n    <p class=\"lfs-tip\">\ud83d\udca1 Tip: <b>78\u2033 \u00d7 60\u2033</b> (6.5 \u00d7 5 ft) is India's most common Queen cot.</p>\n  </div>\n  <button type=\"button\" class=\"lfs-toggle\" id=\"lfs-toggle\" aria-expanded=\"false\" aria-controls=\"lfs-panel\">\n    <span class=\"lfs-toggle-icon\">\ud83d\udccf</span>\n    <span class=\"lfs-toggle-text\"><strong>Not sure of your size?</strong> Enter your cot measurement \u2014 we'll pick the right one</span>\n    <span class=\"lfs-toggle-arrow\">\u25be</span>\n  </button>\n  <div class=\"lfs-panel\" id=\"lfs-panel\" hidden>\n    <p class=\"lfs-help\">Measure the <strong>inside</strong> of your cot frame (where the mattress sits).</p>\n    <div class=\"lfs-units\" role=\"radiogroup\" aria-label=\"Measurement unit\">\n      <button type=\"button\" class=\"lfs-unit active\" data-unit=\"in\" role=\"radio\" aria-checked=\"true\">Inches</button>\n      <button type=\"button\" class=\"lfs-unit\" data-unit=\"ft\" role=\"radio\" aria-checked=\"false\">Feet</button>\n      <button type=\"button\" class=\"lfs-unit\" data-unit=\"cm\" role=\"radio\" aria-checked=\"false\">cm</button>\n    </div>\n    <div class=\"lfs-inputs\">\n      <label class=\"lfs-field\">\n        <span>Length <small>(head \u2192 toe)</small></span>\n        <input type=\"number\" id=\"lfs-len\" inputmode=\"decimal\" step=\"any\" min=\"0\" placeholder=\"e.g. 78\">\n      </label>\n      <span class=\"lfs-x\">\u00d7</span>\n      <label class=\"lfs-field\">\n        <span>Width <small>(side \u2192 side)</small></span>\n        <input type=\"number\" id=\"lfs-wid\" inputmode=\"decimal\" step=\"any\" min=\"0\" placeholder=\"e.g. 60\">\n      </label>\n    </div>\n    <button type=\"button\" class=\"lfs-go\" id=\"lfs-go\">Find My Size</button>\n    <div class=\"lfs-result\" id=\"lfs-result\" role=\"status\" aria-live=\"polite\" hidden></div>\n  </div>\n</div>";
  var COT_NAME = { queen: 'Queen', king: 'King', double: 'Double', single: 'Single' };
  // standard cot sizes (length × width, inches) → bed type
  var STD = [
    [78,72,'king'],[75,72,'king'],[72,72,'king'],[84,72,'king'],
    [78,66,'queen'],[75,66,'queen'],[72,66,'queen'],[78,60,'queen'],[75,60,'queen'],[72,60,'queen'],
    [78,48,'double'],[75,48,'double'],[72,48,'double'],
    [78,42,'single'],[75,42,'single'],[72,42,'single'],[78,36,'single'],[75,36,'single'],[72,36,'single'],
    [78,30,'single'],[75,30,'single'],[72,30,'single']
  ];
  var PH = { in: ['e.g. 78', 'e.g. 60'], ft: ['e.g. 6.5', 'e.g. 5'], cm: ['e.g. 198', 'e.g. 152'] };

  function setInput(id, v) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function mount(t) {
    if (document.getElementById('lfs-wrap')) return true;
    var bed = document.querySelector(t.bed);
    if (!bed) return false;
    var anchor = bed.closest('.pdp-pill-row, .inner-opt-group') || bed;
    var holder = document.createElement('div');
    holder.innerHTML = MARKUP;
    var wrap = holder.firstElementChild;
    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    wire(wrap, t);
    return true;
  }

  function wire(wrap, t) {
    var toggle = wrap.querySelector('#lfs-toggle');
    var panel = wrap.querySelector('#lfs-panel');
    var lenIn = wrap.querySelector('#lfs-len');
    var widIn = wrap.querySelector('#lfs-wid');
    var result = wrap.querySelector('#lfs-result');
    var unit = 'in';

    toggle.addEventListener('click', function () {
      var open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      wrap.classList.toggle('is-open', open);
      if (open) setTimeout(function () { lenIn.focus(); }, 50);
    });
    wrap.querySelectorAll('.lfs-unit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        unit = btn.getAttribute('data-unit');
        wrap.querySelectorAll('.lfs-unit').forEach(function (b) { b.classList.toggle('active', b === btn); b.setAttribute('aria-checked', String(b === btn)); });
        lenIn.placeholder = PH[unit][0]; widIn.placeholder = PH[unit][1];
      });
    });
    function toIn(v) {
      v = parseFloat(String(v).replace(',', '.'));
      if (!(v > 0)) return 0;
      return unit === 'ft' ? v * 12 : unit === 'cm' ? v / 2.54 : v;
    }
    function show(html, kind) { result.hidden = false; result.className = 'lfs-result is-' + kind; result.innerHTML = html; }
    function bedBtn(cot) { return document.querySelector(t.bedBtn.replace('[data-type]', '[data-type="' + cot + '"]')); }
    function trySelect(c) {
      var b = bedBtn(c[2]);
      if (!b || b.disabled || b.classList.contains('is-unavailable')) return false;
      b.click();
      var pill = document.querySelector(t.inch + ' [data-inch="' + c[0] + 'x' + c[1] + '"]');
      if (!pill || pill.disabled) return false;
      pill.click();
      return true;
    }
    function run() {
      var a = toIn(lenIn.value), b = toIn(widIn.value);
      if (!a || !b) { show('Please enter both length and width.', 'warn'); return; }
      var L = Math.max(a, b), W = Math.min(a, b);
      if (L < 60 || L > 86 || W < 30 || W > 84) {
        show('That works out to <strong>' + Math.round(L) + '" × ' + Math.round(W) + '"</strong>, which looks unusual for a cot. Please re-check the measurement and the unit (inches / feet / cm).', 'warn');
        return;
      }
      var typed = (Math.round(L * 10) / 10) + '" × ' + (Math.round(W * 10) / 10) + '"';
      // mattress must sit INSIDE the cot: allow up to 1.5" smaller, max 0.5" bigger
      var cands = STD.filter(function (c) { var dl = L - c[0], dw = W - c[1]; return dl >= -0.5 && dw >= -0.5 && dl <= 1.5 && dw <= 1.5; })
        .sort(function (x, y) { return (Math.abs(L - x[0]) + Math.abs(W - x[1])) - (Math.abs(L - y[0]) + Math.abs(W - y[1])); });
      for (var i = 0; i < cands.length; i++) {
        if (trySelect(cands[i])) {
          var c = cands[i];
          show('✅ Perfect fit: <strong>' + COT_NAME[c[2]] + ' ' + c[0] + '" × ' + c[1] + '"</strong> is selected for your ' + typed + ' cot.', 'ok');
          if (window.loraTrack) window.loraTrack('SizeFinderMatch', { content_category: c[2], size: c[0] + 'x' + c[1] });
          var row = document.querySelector(t.inch);
          if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
      var cl = Math.round(L), cw = Math.round(W);
      var cb = bedBtn('custom');
      if (cb && !cb.disabled && !cb.classList.contains('is-unavailable')) {
        cb.click();
        t.setCustom(cl, cw);
        show('✂️ Your cot (' + typed + ') isn\'t a standard size, so we\'ve set a <strong>Custom Size ' + cl + '" × ' + cw + '"</strong> — made exactly to fit, at no extra cost.', 'ok');
        if (window.loraTrack) window.loraTrack('SizeFinderMatch', { content_category: 'custom', size: cl + 'x' + cw });
      } else {
        show('Your cot (' + typed + ') isn\'t a standard size. Please message us on WhatsApp and we\'ll confirm the right fit.', 'warn');
      }
    }
    wrap.querySelector('#lfs-go').addEventListener('click', run);
    [lenIn, widIn].forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run(); } }); });
  }

  function tryMount() { return TARGETS.some(mount); }
  function start() {
    if (tryMount()) return;
    var n = 0, iv = setInterval(function () { if (tryMount() || ++n > 60) clearInterval(iv); }, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
