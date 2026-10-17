/**
 * LORA — THE SIGNATURE CLOSE-UP (Hero)
 * Scroll progress drives one continuous "camera pull-back":
 *   0.00 – 0.36  macro zooms out (1.0 -> 0.8) and hands off to the corner shot
 *   0.26 – 0.62  corner shot zooms out (1.3 -> 0.88) and hands off to the full mattress
 *   0.52 – 0.80  full mattress settles (1.22 -> 1.0), halo appears
 *   0.76 – 0.96  headline, CTA and trust bar fade in
 */
(function () {
  'use strict';

  function init() {
    var hero = document.getElementById('signature-closeup');
    if (!hero) return;

    var frames = hero.querySelectorAll('.sig-frame');   // [macro, mid, full]
    var halo = hero.querySelector('.sig-halo');
    var intro = hero.querySelector('.sig-intro');
    var shade = hero.querySelector('.sig-intro-shade');
    var finalCopy = hero.querySelector('.sig-final');
    var trust = hero.querySelector('.sig-trust');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ticking = false;

    function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    function smooth(t) { return t * t * (3 - 2 * t); }
    function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
    function lerp(a, b, t) { return a + (b - a) * t; }

    function render() {
      ticking = false;
      var runway = hero.offsetHeight - window.innerHeight;
      var p = runway > 0 ? clamp(-hero.getBoundingClientRect().top / runway, 0, 1) : 0;
      if (reduce) p = p > 0.05 ? 1 : 0;

      var macroZoom = ease(seg(p, 0, 0.36));
      var toMid = smooth(seg(p, 0.26, 0.38));
      var midZoom = ease(seg(p, 0.26, 0.62));
      var toFull = smooth(seg(p, 0.52, 0.64));
      var fullZoom = ease(seg(p, 0.52, 0.8));

      if (frames.length === 3) {
        frames[0].style.opacity = String(1 - toMid);
        frames[0].style.transform = 'scale(' + lerp(1.0, 0.8, macroZoom).toFixed(4) + ')';
        frames[1].style.opacity = String(toMid * (1 - toFull));
        frames[1].style.transform = 'scale(' + lerp(1.3, 0.88, midZoom).toFixed(4) + ')';
        frames[2].style.opacity = String(toFull);
        frames[2].style.transform = 'scale(' + lerp(1.22, 1.0, fullZoom).toFixed(4) + ')';
      }

      if (halo) halo.style.opacity = String(smooth(seg(p, 0.6, 0.8)));

      var out = smooth(seg(p, 0.04, 0.2));
      if (intro) {
        intro.style.opacity = String(1 - out);
        intro.style.transform = 'translateY(' + (-24 * out).toFixed(1) + 'px)';
      }
      if (shade) shade.style.opacity = String(1 - out);

      var reveal = smooth(seg(p, 0.76, 0.92));
      if (finalCopy) {
        finalCopy.style.opacity = String(reveal);
        finalCopy.style.transform = 'translateY(' + (18 * (1 - reveal)).toFixed(1) + 'px)';
        finalCopy.classList.toggle('is-live', reveal > 0.5);
      }
      if (trust) {
        var t = smooth(seg(p, 0.82, 0.96));
        trust.style.opacity = String(t);
        trust.style.transform = 'translate(-50%, ' + (16 * (1 - t)).toFixed(1) + 'px)';
      }

      hero.classList.toggle('is-moving', p > 0.03);
    }

    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(render); }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
