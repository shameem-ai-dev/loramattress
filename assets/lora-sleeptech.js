/**
 * LORA — "ENGINEERED SLEEP" PARTICLE HERO
 *
 * ~34k glowing particles rendered with raw WebGL (additive points).
 * Each particle has three target positions; scroll morphs between them:
 *
 *   0.00 – 0.14  Ch.1  Restless   — drifting, noisy cloud ("restless night")
 *   0.14 – 0.42  Ch.2  Engineered — the cloud condenses into a 3D LORA mattress
 *   0.42 – 0.75  Ch.3  Layers     — mattress separates into its 5 layers (+ labels)
 *   0.75 – 1.00  Ch.4  Deep sleep — layers re-assemble; headline + CTA
 *
 * The pointer gently pushes particles away (they "give" like foam).
 * A small HUD wave turns from jagged (restless) into slow delta waves (deep sleep).
 */
(function () {
  'use strict';

  var LX = 1.0, LZ = 0.68;                         // half length / half width
  var LAYERS = [                                   // top -> bottom
    { y0: 0.12,  y1: 0.19, share: 0.27, col: [0.80, 0.93, 1.00], quilt: true },  // Euro-top
    { y0: 0.065, y1: 0.12, share: 0.12, col: [0.45, 0.80, 1.00] },               // latex
    { y0: 0.0,   y1: 0.065, share: 0.12, col: [0.22, 0.52, 1.00] },              // memory foam
    { y0: -0.13, y1: 0.0,  share: 0.34, col: [0.20, 0.72, 0.98], springs: true },// pocket springs
    { y0: -0.19, y1: -0.13, share: 0.15, col: [0.14, 0.32, 0.92] }               // base
  ];
  var EXPLODE = 0.27;                              // vertical gap per layer when exploded

  function init() {
    var hero = document.getElementById('lora-sleeptech');
    if (!hero) return;

    var stage = hero.querySelector('.ls-stage');
    var canvas = hero.querySelector('.ls-canvas');
    var chapters = hero.querySelectorAll('.ls-chapter');
    var labels = hero.querySelectorAll('.ls-label');
    var bar = hero.querySelector('.ls-progress span');
    var track = hero.querySelector('.ls-track span');
    var countEl = hero.querySelector('[data-ls-count]');
    var stateEl = hero.querySelector('[data-ls-state]');
    var waveCanvas = hero.querySelector('.ls-wave canvas');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var STATES = ['Restless', 'Settling', 'Deep', 'Restored'];
    var bounds = [0, 0.14, 0.42, 0.75, 1.0001];

    function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
    function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
    function smooth(t) { return t * t * (3 - 2 * t); }
    function lerp(a, b, t) { return a + (b - a) * t; }

    var gl = null;
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false }); } catch (e) { gl = null; }
    if (!gl) { hero.classList.add('ls-no-gl'); }

    /* ---------------- Geometry ---------------- */
    var mobile = window.innerWidth < 768;
    var N = mobile ? 22000 : 52000;
    var aRest = new Float32Array(N * 3), aBox = new Float32Array(N * 3), aLay = new Float32Array(N * 3);
    var aCol = new Float32Array(N * 3), aRnd = new Float32Array(N);

    function quiltY(x, z, top) {
      // diamond-lattice tufts: pillowy top with dimples
      var s = 0.17;
      var u = x / s, v = z / s;
      var fu = u - Math.round(u), fv = v - Math.round(v);
      var d1 = fu * fu + fv * fv;
      var gu = u + 0.5 - Math.round(u + 0.5), gv = v + 0.5 - Math.round(v + 0.5);
      var d2 = gu * gu + gv * gv;
      var d = Math.min(d1, d2);
      return top + 0.012 - 0.03 * Math.exp(-d / 0.02);
    }

    (function build() {
      var idx = 0;
      for (var L = 0; L < LAYERS.length; L++) {
        var ly = LAYERS[L];
        var count = (L === LAYERS.length - 1) ? N - idx : Math.round(N * ly.share);
        var h = ly.y1 - ly.y0;
        var off = (2 - L) * EXPLODE;
        for (var k = 0; k < count; k++, idx++) {
          var x, y, z, r = Math.random();
          if (ly.springs && r < 0.86) {
            // pocket coils on a grid
            var nx = 18, nz = 12;
            var ci = Math.floor(Math.random() * nx), cj = Math.floor(Math.random() * nz);
            var cx = -LX + (ci + 0.5) * (2 * LX / nx), cz = -LZ + (cj + 0.5) * (2 * LZ / nz);
            var t = Math.random();
            var ang = t * Math.PI * 2 * 4.5;
            var rad = 0.036 * (0.85 + 0.15 * Math.sin(t * Math.PI));
            x = cx + Math.cos(ang) * rad; z = cz + Math.sin(ang) * rad; y = ly.y0 + t * h;
          } else if (r < 0.14) {
            // crisp edges (12 box edges)
            var e = Math.floor(Math.random() * 12), q = Math.random() * 2 - 1;
            var sx = (e & 1) ? 1 : -1, sz = (e & 2) ? 1 : -1;
            if (e < 4) { x = q * LX; y = (e & 1) ? ly.y1 : ly.y0; z = sz * LZ; }
            else if (e < 8) { x = sx * LX; y = (e & 2) ? ly.y1 : ly.y0; z = q * LZ; }
            else { x = sx * LX; z = sz * LZ; y = ly.y0 + (q * 0.5 + 0.5) * h; }
            if (ly.quilt && y === ly.y1) y = quiltY(x, z, ly.y1);
          } else {
            // faces weighted by area
            var aTop = 4 * LX * LZ, aFB = 4 * LX * h, aLR = 4 * LZ * h;
            var pick = Math.random() * (aTop * (ly.quilt ? 1.6 : 1) + aTop * 0.25 + aFB + aLR);
            if (pick < aTop * (ly.quilt ? 1.6 : 1)) {
              x = (Math.random() * 2 - 1) * LX; z = (Math.random() * 2 - 1) * LZ;
              y = ly.quilt ? quiltY(x, z, ly.y1) : ly.y1;
            } else if ((pick -= aTop * (ly.quilt ? 1.6 : 1)) < aTop * 0.25) {
              x = (Math.random() * 2 - 1) * LX; z = (Math.random() * 2 - 1) * LZ; y = ly.y0;
            } else if ((pick -= aTop * 0.25) < aFB) {
              x = (Math.random() * 2 - 1) * LX; z = Math.random() < 0.5 ? -LZ : LZ; y = ly.y0 + Math.random() * h;
            } else {
              x = Math.random() < 0.5 ? -LX : LX; z = (Math.random() * 2 - 1) * LZ; y = ly.y0 + Math.random() * h;
            }
          }
          var i3 = idx * 3;
          aBox[i3] = x; aBox[i3 + 1] = y; aBox[i3 + 2] = z;
          aLay[i3] = x; aLay[i3 + 1] = y + off; aLay[i3 + 2] = z;
          // restless cloud: wide noisy ellipsoid, denser in the middle
          var th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), rr = Math.pow(Math.random(), 0.55);
          aRest[i3] = Math.sin(ph) * Math.cos(th) * rr * 2.6;
          aRest[i3 + 1] = Math.cos(ph) * rr * 1.25;
          aRest[i3 + 2] = Math.sin(ph) * Math.sin(th) * rr * 1.8;
          var tint = 0.85 + Math.random() * 0.3;
          aCol[i3] = ly.col[0] * tint; aCol[i3 + 1] = ly.col[1] * tint; aCol[i3 + 2] = Math.min(1, ly.col[2] * tint);
          aRnd[idx] = Math.random();
        }
      }
    })();

    /* ---------------- Shaders ---------------- */
    var VS = [
      'attribute vec3 aRest; attribute vec3 aBox; attribute vec3 aLay; attribute vec3 aCol; attribute float aRnd;',
      'uniform float uS; uniform float uTime; uniform float uYaw; uniform float uPitch; uniform float uDist;',
      'uniform float uAspect; uniform vec2 uOffset; uniform vec2 uMouse; uniform float uPush; uniform float uSize; uniform float uBreath;',
      'varying vec3 vCol; varying float vA;',
      'float st(float s, float k){ return smoothstep(0.0, 1.0, clamp((s - k) * 1.6 - aRnd * 0.6, 0.0, 1.0)); }',
      'void main(){',
      '  float t1 = st(uS, 0.0), t2 = st(uS, 1.0), t3 = st(uS, 2.0);',
      '  vec3 p = mix(aRest, aBox, t1);',
      '  p = mix(p, aLay, t2);',
      '  p = mix(p, aBox, t3);',
      '  float wild = 1.0 - t1;',
      '  p += wild * 0.18 * vec3(sin(uTime * 0.7 + aRnd * 40.0), cos(uTime * 0.55 + aRnd * 23.0), sin(uTime * 0.45 + aRnd * 11.0));',
      '  p.y *= 1.0 + uBreath * 0.04 * sin(uTime * 0.9);',
      '  float cy = cos(uYaw), sy = sin(uYaw);',
      '  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);',
      '  float cp = cos(uPitch), sp = sin(uPitch);',
      '  p = vec3(p.x, cp * p.y - sp * p.z, sp * p.y + cp * p.z);',
      '  p.z -= uDist;',
      '  float f = 2.2;',
      '  vec4 clip = vec4(p.x * f / uAspect, p.y * f, 0.0, -p.z);',
      '  clip.xy += uOffset * clip.w;',
      '  vec2 ndc = clip.xy / clip.w;',
      '  vec2 d = (ndc - uMouse) * vec2(uAspect, 1.0);',
      '  float fall = exp(-dot(d, d) / 0.035) * uPush;',
      '  ndc += normalize(d + 1e-5) * fall * 0.09 / vec2(uAspect, 1.0);',
      '  clip.xy = ndc * clip.w;',
      '  gl_Position = clip;',
      '  gl_PointSize = uSize * (4.6 / -p.z) * (1.0 + wild * 0.25) * (0.75 + aRnd * 0.5);',
      '  vCol = aCol + fall * vec3(0.3, 0.5, 0.6);',
      '  vA = mix(0.82, 0.34, wild) * (0.7 + 0.3 * sin(uTime * 1.3 + aRnd * 50.0));',
      '}'
    ].join('\n');
    var FS = [
      'precision mediump float;',
      'varying vec3 vCol; varying float vA;',
      'void main(){',
      '  vec2 c = gl_PointCoord - 0.5;',
      '  float r = dot(c, c);',
      '  if (r > 0.25) discard;',
      '  float a = (exp(-r * 18.0) + 0.35 * exp(-r * 4.0)) * vA;',
      '  gl_FragColor = vec4(vCol * a, a);',
      '}'
    ].join('\n');

    var uni = {};
    if (gl) {
      try {
        var compile = function (type, src) {
          var s = gl.createShader(type);
          gl.shaderSource(s, src); gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
          return s;
        };
        var prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        gl.useProgram(prog);
        [['aRest', aRest, 3], ['aBox', aBox, 3], ['aLay', aLay, 3], ['aCol', aCol, 3], ['aRnd', aRnd, 1]].forEach(function (a) {
          var b = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, b);
          gl.bufferData(gl.ARRAY_BUFFER, a[1], gl.STATIC_DRAW);
          var loc = gl.getAttribLocation(prog, a[0]);
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, a[2], gl.FLOAT, false, 0, 0);
        });
        ['uS', 'uTime', 'uYaw', 'uPitch', 'uDist', 'uAspect', 'uOffset', 'uMouse', 'uPush', 'uSize', 'uBreath'].forEach(function (n) {
          uni[n] = gl.getUniformLocation(prog, n);
        });
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);           // additive glow
        gl.clearColor(0, 0, 0, 0);
      } catch (err) {
        gl = null;
        hero.classList.add('ls-no-gl');
      }
    }

    /* ---------------- Sizing ---------------- */
    var W = 1, H = 1, dpr = 1;
    function resize() {
      var r = stage.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      mobile = W < 768;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
      if (waveCanvas) {
        var wr = waveCanvas.getBoundingClientRect();
        waveCanvas.width = Math.max(1, Math.round(wr.width * dpr));
        waveCanvas.height = Math.max(1, Math.round(wr.height * dpr));
      }
      labelsShown = null;
    }

    /* ---------------- Pointer ---------------- */
    var mouse = { x: 5, y: 5, tx: 5, ty: 5, push: 0, target: 0 };
    stage.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
      mouse.target = 1;
    }, { passive: true });
    stage.addEventListener('pointerleave', function () { mouse.target = 0; });

    /* ---------------- Camera (shared by shader + labels) ---------------- */
    var cam = { yaw: 0, pitch: 0.42, dist: 4.6, ox: 0.34, oy: 0, aspect: 1 };
    function project(x, y, z) {
      var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
      var px = cy * x + sy * z, pz = -sy * x + cy * z, py = y;
      var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      var qy = cp * py - sp * pz, qz = sp * py + cp * pz;
      qz -= cam.dist;
      var w = -qz;
      var nx = px * 2.2 / cam.aspect / w + cam.ox, ny = qy * 2.2 / w + cam.oy;
      return [(nx * 0.5 + 0.5) * W, (1 - (ny * 0.5 + 0.5)) * H];
    }

    /* ---------------- Chapters & labels ---------------- */
    var current = -1, labelsShown = null;
    function setChapter(i) {
      if (i === current) return;
      current = i;
      hero.setAttribute('data-chapter', String(i));
      for (var k = 0; k < chapters.length; k++) {
        chapters[k].classList.toggle('is-active', k === i);
        chapters[k].setAttribute('aria-hidden', k === i ? 'false' : 'true');
      }
      if (countEl) countEl.textContent = '0' + (i + 1);
      if (stateEl) stateEl.textContent = STATES[i];
    }
    function placeLabels(show) {
      for (var i = 0; i < labels.length; i++) {
        var ly = LAYERS[i];
        var yc = (ly.y0 + ly.y1) / 2 + (2 - i) * EXPLODE;
        var pt = project(LX, yc, LZ);
        labels[i].style.left = pt[0].toFixed(1) + 'px';
        labels[i].style.top = pt[1].toFixed(1) + 'px';
        labels[i].style.transitionDelay = show ? (i * 80) + 'ms' : '0ms';
        labels[i].classList.toggle('is-on', show);
      }
    }

    /* ---------------- Sleep wave HUD ---------------- */
    var wctx = waveCanvas ? waveCanvas.getContext('2d') : null;
    function drawWave(t, deep) {
      if (!wctx) return;
      var w = waveCanvas.width, h = waveCanvas.height, mid = h / 2;
      wctx.clearRect(0, 0, w, h);
      var grad = wctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(56,189,248,0)');
      grad.addColorStop(0.25, 'rgba(56,189,248,0.9)');
      grad.addColorStop(1, 'rgba(125,211,252,1)');
      wctx.strokeStyle = grad;
      wctx.lineWidth = 1.5 * dpr;
      wctx.beginPath();
      var freq = lerp(11, 1.7, deep), amp = lerp(0.32, 0.78, deep) * mid, jag = (1 - deep);
      for (var x = 0; x <= w; x += 2) {
        var u = x / w;
        var y = Math.sin(u * Math.PI * 2 * freq - t * lerp(6, 1.4, deep)) * amp;
        y += jag * mid * 0.45 * Math.sin(u * 97 + t * 13) * Math.sin(u * 23 - t * 3);
        if (x === 0) wctx.moveTo(x, mid + y); else wctx.lineTo(x, mid + y);
      }
      wctx.stroke();
    }

    /* ---------------- Loop ---------------- */
    var running = false, t0 = performance.now();
    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      var t = (now - t0) / 1000;
      var runway = hero.offsetHeight - window.innerHeight;
      var p = runway > 0 ? clamp(-hero.getBoundingClientRect().top / runway, 0, 1) : 0;

      var idx = 0;
      for (var i = 0; i < bounds.length - 1; i++) if (p >= bounds[i] && p < bounds[i + 1]) { idx = i; break; }
      setChapter(idx);
      if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      if (track) track.style.transform = 'scaleX(' + seg(p, bounds[idx], Math.min(1, bounds[idx + 1])).toFixed(4) + ')';

      // Morph stage 0..3
      var s = seg(p, 0.1, 0.34) + seg(p, 0.44, 0.58) + seg(p, 0.74, 0.86);
      if (reduce) s = Math.round(s);
      var explode = Math.min(1, seg(p, 0.44, 0.58)) * (1 - seg(p, 0.74, 0.86));

      cam.aspect = W / H;
      cam.yaw = lerp(-0.75, 0.45, smooth(p)) + (reduce ? 0 : Math.sin(t * 0.15) * 0.06);
      cam.pitch = lerp(0.5, 0.36, explode);
      cam.dist = (mobile ? 6.9 : 3.9) + explode * (mobile ? 2.8 : 1.6);
      cam.ox = mobile ? -0.46 * explode : 0.36;
      cam.oy = mobile ? 0.36 : 0.02;

      var show = explode > 0.6;
      if (show !== labelsShown) { labelsShown = show; placeLabels(show); }
      else if (show) placeLabels(true);

      mouse.x += (mouse.tx - mouse.x) * 0.12;
      mouse.y += (mouse.ty - mouse.y) * 0.12;
      mouse.push += (mouse.target - mouse.push) * 0.08;

      if (gl) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(uni.uS, s);
        gl.uniform1f(uni.uTime, reduce ? 0 : t);
        gl.uniform1f(uni.uYaw, cam.yaw);
        gl.uniform1f(uni.uPitch, cam.pitch);
        gl.uniform1f(uni.uDist, cam.dist);
        gl.uniform1f(uni.uAspect, cam.aspect);
        gl.uniform2f(uni.uOffset, cam.ox, cam.oy);
        gl.uniform2f(uni.uMouse, mouse.x, mouse.y);
        gl.uniform1f(uni.uPush, reduce ? 0 : mouse.push);
        gl.uniform1f(uni.uSize, (mobile ? 3.4 : 3.6) * dpr);
        gl.uniform1f(uni.uBreath, idx === 3 ? 1 : 0);
        gl.drawArrays(gl.POINTS, 0, N);
      }

      drawWave(reduce ? 0 : t, smooth(seg(p, 0.08, 0.8)));
    }

    function start() { if (!running) { running = true; requestAnimationFrame(frame); } }
    function stop() { running = false; }

    resize();
    window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { en[0].isIntersecting ? start() : stop(); }, { rootMargin: '100px' }).observe(hero);
    } else { start(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
