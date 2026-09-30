/**
 * LORA Mattress — Product Gallery & Media Controller
 * Manages high-resolution thumbnail switching, zoom inspection, and responsive swipes.
 */

(function () {
  'use strict';

  function initProductGallery() {
    const gallery = document.querySelector('.product-gallery-sticky');
    if (!gallery) return;

    const mainImg = gallery.querySelector('.gallery-main-img');
    const thumbBtns = gallery.querySelectorAll('.gallery-thumb-btn');

    thumbBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        const fullSrc = this.getAttribute('data-full-src');
        if (mainImg && fullSrc) {
          mainImg.style.opacity = '0.5';
          mainImg.src = fullSrc;
          setTimeout(() => {
            mainImg.style.opacity = '1';
          }, 120);
        }

        thumbBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
      });
    });

    // Subtle inspection zoom on mousemove
    const viewContainer = gallery.querySelector('.gallery-main-view');
    if (viewContainer && mainImg) {
      viewContainer.addEventListener('mousemove', function (e) {
        const rect = viewContainer.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        mainImg.style.transformOrigin = `${x}% ${y}%`;
        mainImg.style.transform = 'scale(1.18)';
      });

      viewContainer.addEventListener('mouseleave', function () {
        mainImg.style.transform = 'scale(1)';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductGallery);
  } else {
    initProductGallery();
  }
})();
