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
  var t0 = 0, ready = false, running = true;
  var cw = 0, ch = 0, dpr = 1;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function isMobile() { return window.innerWidth <= 760; }

  function goReady() {
    if (ready) return;
    ready = true;
    t0 = performance.now();
    root.classList.add('is-ready');
  }
  var bg = root.querySelector('.lf-bg img');
  if (bg && !bg.complete) {
    bg.addEventListener('load', goReady, { once: true });
    bg.addEventListener('error', goReady, { once: true });
    setTimeout(goReady, 1800);
  } else {
    requestAnimationFrame(goReady);
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cw = sticky.clientWidth;
    ch = sticky.clientHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  if (finePointer && !reduce) {
    window.addEventListener('pointermove', function (e) {
      tpx = (e.clientX / window.innerWidth - .5) * 2;
      tpy = (e.clientY / window.innerHeight - .5) * 2;
    }, { passive: true });
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      running = en[0].isIntersecting;
      if (running) requestAnimationFrame(tick);
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

  function placeTags(es) {
    var mob = isMobile();
    for (var j = 0; j < tags.length; j++) {
      var idx = slabs.length - 1 - j;           // first tag = top layer
      var slab = slabs[idx];
      if (!slab) continue;
      var left = j % 2 === 1;
      var face = slab.querySelector(left ? '.fl' : '.fr');
      var r = face.getBoundingClientRect();
      var op = clamp((es[idx] - .55) / .35, 0, 1);
      var off = mob ? 6 : 18;
      var x = left ? r.left - off : r.right + off;
      var y = r.top + r.height * .5;
      var slide = (1 - op) * (left ? 10 : -10);
      tags[j].style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(' + (left ? '-100%' : '0') + ', -50%) translateX(' + slide.toFixed(1) + 'px)';
      tags[j].style.opacity = op.toFixed(3);
    }
  }

  function tick(now) {
    if (!running) return;
    var rect = root.getBoundingClientRect();
    var range = Math.max(1, rect.height - window.innerHeight);
    var p = clamp(-rect.top / range, 0, 1);
    sp += (p - sp) * (reduce ? 1 : .12);
    px += (tpx - px) * .06;
    py += (tpy - py) * .06;

    var intro = reduce ? 1 : (ready ? easeOut(clamp((now - t0 - 300) / 1800, 0, 1)) : 0);
    var m, ex, out, ins;
    if (reduce) { m = 0; ex = 0; out = 0; ins = 0; }
    else {
      m = easeInOut(seg(sp, .06, .28)) * (1 - 0);           // glide to centre (stays centred)
      ex = seg(sp, .24, .52) * (1 - seg(sp, .74, .9));       // explode, hold, reassemble
      out = easeInOut(seg(sp, .88, .98));                    // outro
      ins = clamp(seg(sp, .3, .4) * (1 - seg(sp, .72, .8)), 0, 1);
    }
    curM = m; curOut = out;
    var cop = clamp(1 - seg(sp, .04, .18), 0, 1);
    var s = root.style;
    var es = [];
    // cascade: top layer leads, base follows
    for (var i = 0; i < 6; i++) {
      var ei = easeInOut(clamp(ex * 1.5 - (5 - i) * .1, 0, 1));
      es.push(ei);
      s.setProperty('--e' + i, ei.toFixed(4));
    }
    var exE = easeInOut(ex);
    var spin = reduce ? 0 : seg(sp, .3, .9) * 14;            // slow turntable across act 2-3
    s.setProperty('--ex', exE.toFixed(4));
    s.setProperty('--m', m.toFixed(4));
    s.setProperty('--out', out.toFixed(4));
    s.setProperty('--ins', ins.toFixed(4));
    s.setProperty('--cop', cop.toFixed(4));
    s.setProperty('--shell', clamp(1 - ex * 3, 0, 1).toFixed(3));
    s.setProperty('--p', sp.toFixed(4));
    s.setProperty('--ry', (-32 + 10 * m + spin - 4 * exE + (1 - intro) * 14 + px * 6).toFixed(2));
    s.setProperty('--rx', (-21 + 4 * exE + py * 3).toFixed(2));
    s.setProperty('--px', px.toFixed(3));
    s.setProperty('--py', py.toFixed(3));
    root.classList.toggle('is-act2', cop < .5);
    root.classList.toggle('is-outro', out > .5);

    placeTags(es);
    if (!reduce) drawLines(now);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
