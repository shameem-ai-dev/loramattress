/**
 * LORA Mattress — The Continuous Scroll-Driven Visual Journey Engine
 * 
 * Flow:
 * Phase 1 (0.00 - 0.24): Comfort Starts Here — Realistic 3/4 LORA mattress in warm ivory daylight studio
 * Phase 2 (0.24 - 0.52): Build the Bedroom — Modern Kerala bedroom suite gently builds around the mattress
 * Phase 3 (0.52 - 0.82): Discover What's Inside — Room fades, camera draws closer, 4 authentic layers separate vertically
 * Phase 4 (0.82 - 1.00): Bring Comfort Home — Layers reunite into complete mattress, inviting to explore the collection
 * 
 * Aesthetics:
 * Warm ivory (#FAF7F2), natural wood, subtle Lora blue (#0284C7).
 * No neon glows, no cosmic drifts, no sci-fi gimmicks.
 * Responsive mobile-first with zero content clipping.
 */

(function () {
  'use strict';

  function initContinuousHeroJourney() {
    const wrapper = document.querySelector('.hero-scroll-wrapper');
    if (!wrapper) return;

    // Visual Stage layers
    const layerStudio = wrapper.querySelector('.stage-layer-studio');
    const layerBedroom = wrapper.querySelector('.stage-layer-bedroom');
    const layerExploded = wrapper.querySelector('.stage-layer-exploded');
    const viewport = wrapper.querySelector('.hero-layers-viewport');

    // Layer annotations
    const anno1 = document.querySelector('#anno-layer-1');
    const anno2 = document.querySelector('#anno-layer-2');
    const anno3 = document.querySelector('#anno-layer-3');
    const anno4 = document.querySelector('#anno-layer-4');
    const allAnnos = [anno1, anno2, anno3, anno4].filter(Boolean);

    // Dynamic Editorial Typography & CTAs
    const statusLabel = document.querySelector('#hero-chapter-status');
    const heroTitle = document.querySelector('#hero-dynamic-title');
    const heroCopy = document.querySelector('#hero-dynamic-copy');
    const btnPrimary = document.querySelector('#hero-btn-primary');
    const btnSecondary = document.querySelector('#hero-btn-secondary');

    // Navigation & HUD
    const chapterBtns = wrapper.querySelectorAll('.chapter-btn');
    const scrollFill = document.querySelector('#hero-scroll-fill');
    const scrollPct = document.querySelector('#hero-scroll-pct');
    const scrollTrack = wrapper.querySelector('.hero-scroll-track-wrap');

    const CHAPTERS = [
      {
        index: 0,
        milestone: 0.05,
        status: 'COMFORT STARTS HERE',
        title: 'Your best days begin <br class="mobile-break">with better nights.',
        copy: 'Discover comfort made for your home.',
        btnPrimaryText: 'Shop Mattresses',
        btnPrimaryHref: '#the-collection',
        btnSecondaryText: 'Help Me Choose'
      },
      {
        index: 1,
        milestone: 0.36,
        status: 'BUILD THE BEDROOM',
        title: 'Crafted for your <br class="mobile-break">bedroom sanctuary.',
        copy: 'A natural teak frame, breathable linens, and warm daylight complete your modern Kerala space.',
        btnPrimaryText: 'Shop Mattresses',
        btnPrimaryHref: '#the-collection',
        btnSecondaryText: 'Help Me Choose'
      },
      {
        index: 2,
        milestone: 0.66,
        status: 'DISCOVER WHAT’S INSIDE',
        title: 'Comfort, <br class="mobile-break">layer by layer.',
        copy: '100% Kerala Dunlop latex, 1,200+ pocket springs, and breathable micro-knit quilting.',
        btnPrimaryText: 'Shop Mattresses',
        btnPrimaryHref: '#the-collection',
        btnSecondaryText: 'Help Me Choose'
      },
      {
        index: 3,
        milestone: 0.92,
        status: 'BRING COMFORT HOME',
        title: 'Find your <br class="mobile-break">kind of comfort.',
        copy: 'Experience weightless spinal support with our 100-night home trial and 15-year warranty.',
        btnPrimaryText: 'Explore Mattresses',
        btnPrimaryHref: '#the-collection',
        btnSecondaryText: 'Help Me Choose'
      }
    ];

    let currentTargetProgress = 0;
    let smoothProgress = 0;
    let activeChapterIndex = -1;
    let forceStaticProgress = false;

    // Check query params immediately
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('scrollProgress')) {
      const paramP = parseFloat(urlParams.get('scrollProgress'));
      if (!isNaN(paramP)) {
        forceStaticProgress = true;
        currentTargetProgress = Math.max(0, Math.min(1, paramP));
        smoothProgress = currentTargetProgress;
      }
    }

    // Respect user's motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function calculateScrollProgress() {
      const rect = wrapper.getBoundingClientRect();
      const totalScroll = wrapper.offsetHeight - window.innerHeight;
      if (totalScroll <= 0) return 0;
      const scrolled = -rect.top;
      return Math.min(1, Math.max(0, scrolled / totalScroll));
    }

    function onScroll() {
      if (forceStaticProgress) return;
      currentTargetProgress = calculateScrollProgress();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    if (!forceStaticProgress) {
      currentTargetProgress = calculateScrollProgress();
      smoothProgress = currentTargetProgress;
    }

    function updateTypography(chapterIdx) {
      if (chapterIdx === activeChapterIndex) return;
      activeChapterIndex = chapterIdx;
      const chap = CHAPTERS[chapterIdx];

      if (statusLabel) {
        statusLabel.textContent = chap.status;
      }

      if (heroTitle) {
        heroTitle.innerHTML = chap.title;
        heroTitle.style.opacity = '1';
        heroTitle.style.transform = 'translateY(0)';
      }

      if (heroCopy) {
        heroCopy.innerHTML = chap.copy;
        heroCopy.style.opacity = '1';
        heroCopy.style.transform = 'translateY(0)';
      }

      if (btnPrimary) {
        btnPrimary.textContent = chap.btnPrimaryText;
        btnPrimary.setAttribute('href', chap.btnPrimaryHref);
      }

      // Update chapter buttons active state
      chapterBtns.forEach((btn, idx) => {
        if (idx === chapterIdx) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    function renderEngine() {
      if (prefersReducedMotion) {
        if (layerStudio) layerStudio.style.opacity = '1';
        if (layerBedroom) layerBedroom.style.opacity = '0';
        if (layerExploded) layerExploded.style.opacity = '0';
        updateTypography(0);
        return;
      }

      // Smooth lerp physics or deterministic preview
      if (forceStaticProgress) {
        smoothProgress = currentTargetProgress;
      } else {
        smoothProgress += (currentTargetProgress - smoothProgress) * 0.14;
      }
      const p = smoothProgress;

      // ----------------------------------------------------
      // 1. Layer Crossfades & Perspective Scaling
      // ----------------------------------------------------
      // Studio: Full at 0.00 - 0.20, fades out 0.20 - 0.32, returns at 0.80 - 0.90, full to 1.00
      let studioOpacity = 0;
      if (p < 0.20) {
        studioOpacity = 1;
      } else if (p < 0.32) {
        studioOpacity = (0.32 - p) / 0.12;
      } else if (p >= 0.80 && p < 0.90) {
        studioOpacity = (p - 0.80) / 0.10;
      } else if (p >= 0.90) {
        studioOpacity = 1;
      }

      // Bedroom: Fades in 0.20 - 0.32, full 0.32 - 0.48, fades out 0.48 - 0.58
      let bedroomOpacity = 0;
      if (p >= 0.20 && p < 0.32) {
        bedroomOpacity = (p - 0.20) / 0.12;
      } else if (p >= 0.32 && p <= 0.48) {
        bedroomOpacity = 1;
      } else if (p > 0.48 && p < 0.58) {
        bedroomOpacity = (0.58 - p) / 0.10;
      }

      // Exploded: Fades in 0.50 - 0.60, full 0.60 - 0.78, fades out 0.78 - 0.86
      let explodedOpacity = 0;
      if (p >= 0.50 && p < 0.60) {
        explodedOpacity = (p - 0.50) / 0.10;
      } else if (p >= 0.60 && p <= 0.78) {
        explodedOpacity = 1;
      } else if (p > 0.78 && p < 0.86) {
        explodedOpacity = (0.86 - p) / 0.08;
      }

      // Apply opacities
      if (layerStudio) layerStudio.style.opacity = Math.max(0, Math.min(1, studioOpacity)).toFixed(3);
      if (layerBedroom) layerBedroom.style.opacity = Math.max(0, Math.min(1, bedroomOpacity)).toFixed(3);
      if (layerExploded) layerExploded.style.opacity = Math.max(0, Math.min(1, explodedOpacity)).toFixed(3);

      // Camera draws gently closer during exploded anatomy reveal
      if (viewport) {
        let zoom = 1;
        if (p >= 0.48 && p <= 0.82) {
          const t = Math.sin(((p - 0.48) / 0.34) * Math.PI);
          zoom = 1 + (t * 0.045);
        }
        viewport.style.transform = `scale(${zoom.toFixed(4)})`;
      }

      // ----------------------------------------------------
      // 2. Sequential Layer Annotations (Phase 3: 0.54 - 0.82)
      // ----------------------------------------------------
      const inAnatomyPhase = p >= 0.54 && p <= 0.84;
      if (!inAnatomyPhase) {
        allAnnos.forEach(a => a.classList.remove('active'));
      } else {
        // Sequential reveal intervals
        const activeIdx = p < 0.61 ? 0 : p < 0.68 ? 1 : p < 0.75 ? 2 : 3;
        allAnnos.forEach((a, idx) => {
          if (idx === activeIdx) {
            a.classList.add('active');
          } else {
            a.classList.remove('active');
          }
        });
      }

      // ----------------------------------------------------
      // 3. Scroll Track & HUD Meter
      // ----------------------------------------------------
      if (scrollFill) {
        scrollFill.style.width = `${(p * 100).toFixed(1)}%`;
      }
      if (scrollPct) {
        scrollPct.textContent = `${Math.round(p * 100)}%`;
      }

      // ----------------------------------------------------
      // 4. Active Chapter Determination
      // ----------------------------------------------------
      let targetChapter = 0;
      if (p >= 0.24 && p < 0.52) {
        targetChapter = 1;
      } else if (p >= 0.52 && p < 0.82) {
        targetChapter = 2;
      } else if (p >= 0.82) {
        targetChapter = 3;
      }
      updateTypography(targetChapter);

      requestAnimationFrame(renderEngine);
    }

    requestAnimationFrame(renderEngine);

    // Chapter button click: Smoothly scrolls to chapter milestone
    chapterBtns.forEach((btn, idx) => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const milestone = CHAPTERS[idx].milestone;
        const totalScroll = wrapper.offsetHeight - window.innerHeight;
        const targetScrollTop = wrapper.offsetTop + (totalScroll * milestone);
        window.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
      });
    });

    // Track click to scrub directly
    if (scrollTrack) {
      scrollTrack.addEventListener('click', function (e) {
        const rect = this.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const totalScroll = wrapper.offsetHeight - window.innerHeight;
        window.scrollTo({
          top: wrapper.offsetTop + (totalScroll * fraction),
          behavior: 'smooth'
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContinuousHeroJourney);
  } else {
    initContinuousHeroJourney();
  }
})();
