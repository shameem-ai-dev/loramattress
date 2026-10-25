/* =========================================================
   LORA — FLOATING MATTRESS HERO
   Builds the CSS-3D mattress, drives intro, the scroll explode /
   reassemble sequence, layer tags, pointer parallax and light lines.
   ========================================================= */
(function () {
  'use strict';
  var root = document.getElementById('lora-float');
  if (!root) return;

  var FACES = ['ft', 'fb', 'ff', 'fk', 'fl', 'fr'];
  var K = 4; // segments per rounded corner
  var SHADE = [[0, .05], [90, .3], [180, .45], [270, .4], [360, .05]];
  function shadeAt(a) {
    for (var n = 1; n < SHADE.length; n++) {
      if (a <= SHADE[n][0]) {
        var t = (a - SHADE[n - 1][0]) / (SHADE[n][0] - SHADE[n - 1][0]);
        return SHADE[n - 1][1] + (SHADE[n][1] - SHADE[n - 1][1]) * t;
      }
    }
    return .05;
  }
  var CORNERS = [[0, 1, 1], [90, 1, -1], [180, -1, -1], [270, -1, 1]];
  var segW = (2 * Math.sin(Math.PI / (4 * K))).toFixed(5);
  var segZ = Math.cos(Math.PI / (4 * K)).toFixed(5);
  var slabs = [];
  ['.lf-base', '.lf-springs', '.lf-gel', '.lf-latex', '.lf-comfort', '.lf-quilt'].forEach(function (sel) {
    var s = root.querySelector(sel);
    if (!s) return;
    FACES.forEach(function (c) {
      var f = document.createElement('div');
      f.className = 'lf-f ' + c;
      s.appendChild(f);
    });
    CORNERS.forEach(function (c) {
      for (var j = 0; j < K; j++) {
        var a = c[0] + (j + .5) * 90 / K;
        var f = document.createElement('div');
        f.className = 'lf-f fc';
        f.style.width = 'calc(var(--r) * ' + segW + ' + 1px)';
        f.style.transform =
          'translateX(calc(' + c[1] + ' * (var(--w) / 2 - var(--r)))) ' +
          'translateZ(calc(' + c[2] + ' * (var(--d) / 2 - var(--r)))) ' +
          'rotateY(' + a.toFixed(2) + 'deg) translateZ(calc(var(--r) * ' + segZ + ')) translate(-50%, -50%)';
        f.style.setProperty('--sh', shadeAt(a).toFixed(3));
        s.appendChild(f);
      }
    });
    slabs.push(s);
  });
  var label = root.querySelector('.lf-springs .ff');
  if (label) {
    var logo = root.getAttribute('data-logo') || 'assets/lora-logo-transparent.png';
    label.innerHTML = '<i class="lf-handle l"></i><span class="lf-badge"><img src="' + logo + '" alt=""></span><i class="lf-handle r"></i>';
  }

  // tags are listed top layer first in the markup; map to slab index (0 = base)
  var tags = Array.prototype.slice.call(root.querySelectorAll('.lf-tag'));
  tags.forEach(function (t, j) { if (j % 2 === 1) t.classList.add('is-left'); });

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var canvas = root.querySelector('.lf-lines');
  var ctx = canvas ? canvas.getContext('2d') : null;
  var sticky = root.querySelector('.lf-sticky');

  var sp = 0, px = 0, py = 0, tpx = 0, tpy = 0;
  var t0 = 0, ready = false, running = true, looping = false, lastNow = 0, frame = 0;
  var cw = 0, ch = 0, dpr = 1;
  // Cached scroll geometry (re-measured on resize only, never inside the frame loop)
  var secTop = 0, range = 1, vh = window.innerHeight;
  var cache = {};
  function setVar(name, val) {
    if (cache[name] !== val) { cache[name] = val; root.style.setProperty(name, val); }
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  var mobileFlag = window.innerWidth <= 760;
  function isMobile() { return mobileFlag; }

  function goReady() {
    if (ready) return;
    ready = true;
    t0 = performance.now();
    root.classList.add('is-ready');
    kick();
  }
  var bg = root.querySelector('.lf-bg img');
  if (bg && !bg.complete) {
    bg.addEventListener('load', goReady, { once: true });
    bg.addEventListener('error', goReady, { once: true });
    setTimeout(goReady, 1800);
  } else {
    requestAnimationFrame(goReady);
  }

  function measure() {
    mobileFlag = window.innerWidth <= 760;
    // sticky is 100svh: stable while the mobile URL bar shows/hides (no jumps)
    vh = (sticky && sticky.clientHeight) || window.innerHeight;
    secTop = root.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop);
    range = Math.max(1, root.offsetHeight - vh);
  }
  function resize() {
    measure();
    if (!canvas) return;
    dpr = mobileFlag ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    cw = sticky.clientWidth;
    ch = sticky.clientHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  resize();
  var rzT;
  window.addEventListener('resize', function () {
    // debounced so the mobile URL bar show/hide doesn't trigger repeated re-layouts
    clearTimeout(rzT);
    rzT = setTimeout(function () { resize(); kick(); }, 120);
  }, { passive: true });
  window.addEventListener('load', function () { measure(); kick(); });
  window.addEventListener('scroll', kick, { passive: true });

  if (finePointer && !reduce) {
    window.addEventListener('pointermove', function (e) {
      tpx = (e.clientX / window.innerWidth - .5) * 2;
      tpy = (e.clientY / window.innerHeight - .5) * 2;
      kick();
    }, { passive: true });
  }

  function kick() {
    if (looping || !running) return;
    looping = true;
    lastNow = 0;
    requestAnimationFrame(tick);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      running = en[0].isIntersecting;
      if (running) { measure(); kick(); }
    }).observe(root);
  }

  // three-act scroll timeline
  //  act 1: hero copy + mattress on the right
  //  act 2: copy fades, mattress glides to centre and explodes (tags left/right)
  //  act 3: layers reassemble, outro line + CTA appear
  function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  var curM = 0, curOut = 0;
  function drawLines(now) {
    if (!ctx) return;
    var t = now / 1000;
    var mob = isMobile();
    var Wm = mob ? Math.min(cw * .56, 270) : Math.min(cw * .32, 520);
    var sx = cw * (mob ? .5 : .66 - .16 * curM), sy = ch * (mob ? .74 - .2 * curM - .04 * curOut : .57 - .03 * curM - .06 * curOut);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.lineWidth = 1;

    var cx = sx + Wm * .3, cy = sy - Wm * .2;
    var span = Math.max(cw, ch) * .55, n = mob ? 5 : 8, gap = span / n;
    for (var i = 0; i < n; i++) {
      var r = Wm * .6 + ((t * 14 + i * gap) % span);
      var a = (1 - (r - Wm * .6) / span) * .16;
      ctx.strokeStyle = 'rgba(125,211,252,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    var lines = mob ? 3 : 5;
    for (var k = 0; k < lines; k++) {
      var base = ch * (.7 + k * .055);
      var g = ctx.createLinearGradient(0, 0, cw, 0);
      g.addColorStop(0, 'rgba(56,189,248,0)');
      g.addColorStop(.5, 'rgba(125,211,252,' + (.12 - k * .015).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.strokeStyle = g;
      ctx.beginPath();
      for (var x = 0; x <= cw; x += 16) {
        var y = base + Math.sin(x * .0042 + t * .45 + k * 1.3) * (18 + k * 6) + Math.sin(x * .011 - t * .3 + k) * 6;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  var tagsShown = true;
  function placeTags(es) {
    var any = false;
    for (var q = 0; q < es.length; q++) if (es[q] > .55) { any = true; break; }
    if (!any) {
      // no layout reads while tags are hidden (most of the scroll)
      if (tagsShown) { tags.forEach(function (t) { t.style.opacity = '0'; }); tagsShown = false; }
      return;
    }
    tagsShown = true;
    var mob = isMobile();
    // batch all reads first, then all writes (avoids layout thrashing)
    var rects = [];
    for (var j = 0; j < tags.length; j++) {
      var slab = slabs[slabs.length - 1 - j];
      var face = slab && slab.querySelector(j % 2 === 1 ? '.fl' : '.fr');
      rects.push(face ? face.getBoundingClientRect() : null);
    }
    for (var k = 0; k < tags.length; k++) {
      var r = rects[k];
      if (!r) continue;
      var idx = slabs.length - 1 - k;
      var left = k % 2 === 1;
      var op = clamp((es[idx] - .55) / .35, 0, 1);
      var off = mob ? 6 : 18;
      var x = left ? r.left - off : r.right + off;
      var y = r.top + r.height * .5;
      var slide = (1 - op) * (left ? 10 : -10);
      tags[k].style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(' + (left ? '-100%' : '0') + ', -50%) translateX(' + slide.toFixed(1) + 'px)';
      tags[k].style.opacity = op.toFixed(3);
    }
  }

  function tick(now) {
    if (!running) { looping = false; return; }
    var dt = lastNow ? Math.min(64, now - lastNow) : 16.67;
    lastNow = now;
    frame++;
    // re-sync geometry occasionally (content above may load late); read happens before any writes
    if (frame % 90 === 0) measure();
    // scroll position from cached geometry: no layout read per frame
    var y = window.pageYOffset || document.documentElement.scrollTop;
    var p = clamp((y - secTop) / range, 0, 1);
    // frame-rate independent easing (same feel at 30, 60 or 120 Hz)
    var k = reduce ? 1 : 1 - Math.pow(1 - (isMobile() ? .2 : .14), dt / 16.67);
    var kp = 1 - Math.pow(1 - .06, dt / 16.67);
    sp += (p - sp) * k;
    if (Math.abs(p - sp) < .0004) sp = p;
    px += (tpx - px) * kp;
    py += (tpy - py) * kp;

    var introRaw = ready ? clamp((now - t0 - 300) / 1800, 0, 1) : 0;
    var intro = reduce ? 1 : easeOut(introRaw);
    var m, ex, out, ins;
    if (reduce) { m = 0; ex = 0; out = 0; ins = 0; }
    else {
      m = easeInOut(seg(sp, .06, .28));                       // glide to centre (stays centred)
      ex = seg(sp, .24, .52) * (1 - seg(sp, .74, .9));       // explode, hold, reassemble
      out = easeInOut(seg(sp, .88, .98));                    // outro
      ins = clamp(seg(sp, .3, .4) * (1 - seg(sp, .72, .8)), 0, 1);
    }
    curM = m; curOut = out;
    var cop = clamp(1 - seg(sp, .04, .18), 0, 1);
    var es = [];
    // cascade: top layer leads, base follows
    for (var i = 0; i < 6; i++) {
      var ei = easeInOut(clamp(ex * 1.5 - (5 - i) * .1, 0, 1));
      es.push(ei);
      setVar('--e' + i, ei.toFixed(3));
    }
    var exE = easeInOut(ex);
    var spin = reduce ? 0 : seg(sp, .3, .9) * 14;            // slow turntable across act 2-3
    setVar('--ex', exE.toFixed(3));
    setVar('--m', m.toFixed(3));
    setVar('--out', out.toFixed(3));
    setVar('--ins', ins.toFixed(3));
    setVar('--cop', cop.toFixed(3));
    setVar('--shell', clamp(1 - ex * 3, 0, 1).toFixed(2));
    setVar('--p', sp.toFixed(3));
    setVar('--ry', (-32 + 10 * m + spin - 4 * exE + (1 - intro) * 14 + px * 6).toFixed(1));
    setVar('--rx', (-21 + 4 * exE + py * 3).toFixed(1));
    setVar('--px', px.toFixed(2));
    setVar('--py', py.toFixed(2));
    root.classList.toggle('is-act2', cop < .5);
    root.classList.toggle('is-outro', out > .5);

    placeTags(es);
    // ambient light lines: 30fps on mobile is visually identical and halves the cost
    if (!reduce && (!isMobile() || frame % 2 === 0)) drawLines(now);

    var settled = sp === p && Math.abs(tpx - px) < .002 && Math.abs(tpy - py) < .002 && introRaw >= 1;
    var inView = y < secTop + range + vh;
    if (!running || (settled && (reduce || !inView))) { looping = false; return; }
    requestAnimationFrame(tick);
  }
  kick();
})();
