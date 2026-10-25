/* LORA — reveal-on-scroll (IntersectionObserver, zero scroll listeners) */
(function () {
  'use strict';
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var sel = [
    '.section-head-center', '.section-title', '.proof-item', '.mattress-card',
    '.inside-comfort-section .container > *', '.factory-direct-section .container > *',
    '.measure-guide-section .container > *', '.quiz-section .container > *',
    '.store-locator-section .container > *', '.simulator-section .container > *'
  ].join(',');
  var els = Array.prototype.slice.call(document.querySelectorAll(sel)).filter(function (el) {
    return !el.closest('#lora-float') && !el.closest('.modal-overlay, .checkout-modal-overlay, [role="dialog"]');
  });
  if (!els.length) return;
  var vh = window.innerHeight;
  els.forEach(function (el) {
    // anything already on screen stays visible (no flash on load)
    var r = el.getBoundingClientRect();
    if (r.top < vh && r.bottom > 0) return;
    el.classList.add('lp-reveal');
  });
  document.documentElement.classList.add('lp-reveal-ready');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      // gentle stagger for siblings in the same row
      var sibs = el.parentNode ? Array.prototype.indexOf.call(el.parentNode.children, el) : 0;
      el.style.transitionDelay = Math.min(sibs % 4, 3) * 70 + 'ms';
      el.classList.add('lp-in');
      io.unobserve(el);
      setTimeout(function () { el.style.transitionDelay = ''; }, 1200);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach(function (el) { if (el.classList.contains('lp-reveal')) io.observe(el); });
})();
