/**
 * LORA Mattress — Zero-G Spatial Science & Deconstructed Architecture Engine
 * 
 * New Concept Architecture:
 * - 3 Photorealistic 8K Studio Render Layers (Assembled Monolith, 4-Tier Deconstructed, SpineAlign Biometrics)
 * - Seamless background integration (#060913), zero text clashes
 * - Silky 60fps cross-fading & scale transitions with requestAnimationFrame
 * - Interactive phase buttons + smooth scrub progress
 * - Responsive mobile & desktop dual-driver
 */

(function () {
  'use strict';

  function initZeroGHero() {
    const wrapper = document.querySelector('.hero-scroll-wrapper');
    if (!wrapper) return;

    // Visual Stage layers
    const layerAssembled = wrapper.querySelector('.stage-layer-assembled');
    const layerExploded = wrapper.querySelector('.stage-layer-exploded');
    const layerSpine = wrapper.querySelector('.stage-layer-spine');
    const stageContainer = wrapper.querySelector('.hero-visual-stage');

    // Narrative Slides & Stage Controls
    const storySlides = wrapper.querySelectorAll('.hero-story-slide');
    const stagePill = document.querySelector('#hero-stage-pill');
    const phaseBtns = wrapper.querySelectorAll('.phase-btn');

    // Progress HUD elements
    const scrubFill = document.querySelector('#hero-scroll-hud-fill');
    const scrubPct = document.querySelector('#hero-scroll-pct');
    const scrubPrompt = document.querySelector('#hero-scroll-prompt');

    // Spatial Callouts & Telemetry
    const calloutQuilt = document.querySelector('#spatial-callout-quilt');
    const calloutLatex = document.querySelector('#spatial-callout-latex');
    const calloutCoils = document.querySelector('#spatial-callout-coils');
    const calloutBase = document.querySelector('#spatial-callout-base');
    const telemetryBadge = document.querySelector('#hero-telemetry-badge');
    const mobileTierContent = document.querySelector('#mobile-tier-content');

    const STAGE_META = [
      {
        index: 0,
        milestone: 0.08,
        label: '01 / ARCHITECTURAL ZERO-G SLEEP',
        hudText: '0% ASSEMBLED'
      },
      {
        index: 1,
        milestone: 0.50,
        label: '02 / 4-TIER ARCHITECTURAL ANATOMY',
        hudText: '50% DECONSTRUCTED'
      },
      {
        index: 2,
        milestone: 0.88,
        label: '03 / SPINEALIGN™ 7-ZONE BIOMETRICS',
        hudText: '100% SPINEALIGN'
      }
    ];

    let currentTargetProgress = 0;
    let smoothProgress = 0;
    let activeStageIndex = 0;
    let isUserScrubbing = false;

    // Desktop mouse parallax tilt
    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;

    function calculateScrollProgress() {
      const rect = wrapper.getBoundingClientRect();
      const totalScroll = wrapper.offsetHeight - window.innerHeight;
      if (totalScroll <= 0) return 0;
      const scrolled = -rect.top;
      return Math.min(1, Math.max(0, scrolled / totalScroll));
    }

    function onScrollUpdate() {
      if (isUserScrubbing) return;
      currentTargetProgress = calculateScrollProgress();
    }

    window.addEventListener('scroll', onScrollUpdate, { passive: true });
    window.addEventListener('resize', onScrollUpdate, { passive: true });

    // Initial progress sync
    currentTargetProgress = calculateScrollProgress();
    smoothProgress = currentTargetProgress;

    // Desktop Pointer Parallax Tilt
    window.addEventListener('mousemove', function (e) {
      if (window.innerWidth <= 991) return;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      targetTiltX = ((e.clientX - centerX) / centerX) * 4;
      targetTiltY = -((e.clientY - centerY) / centerY) * 3;
    }, { passive: true });

    // Render Engine (Runs at 60fps via rAF)
    function renderEngine(timestamp) {
      // Smooth dampening interpolation
      smoothProgress += (currentTargetProgress - smoothProgress) * 0.12;
      const p = Math.max(0, Math.min(1, smoothProgress));

      // ----------------------------------------------------------------------
      // 1. Image Layer Cross-Fade Physics
      // ----------------------------------------------------------------------
      // Stage 1 (Assembled): 1.0 from 0.0 to 0.28, fades out 0.28 to 0.45
      let o1 = 0;
      if (p <= 0.28) {
        o1 = 1;
      } else if (p < 0.45) {
        o1 = (0.45 - p) / 0.17;
      } else if (p >= 0.94) {
        o1 = (p - 0.94) / 0.06;
      }

      if (layerAssembled) {
        layerAssembled.style.opacity = Math.max(0, Math.min(1, o1)).toFixed(3);
        const scale1 = (1 + (Math.sin(p * Math.PI) * 0.02)).toFixed(3);
        layerAssembled.style.transform = `scale(${scale1})`;
      }

      // Stage 2 (4-Tier Deconstructed): Fades in 0.30 to 0.45, solid 0.45 to 0.65, fades out 0.65 to 0.78
      let o2 = 0;
      if (p >= 0.30 && p < 0.45) {
        o2 = (p - 0.30) / 0.15;
      } else if (p >= 0.45 && p <= 0.65) {
        o2 = 1;
      } else if (p > 0.65 && p < 0.78) {
        o2 = (0.78 - p) / 0.13;
      }

      if (layerExploded) {
        layerExploded.style.opacity = Math.max(0, Math.min(1, o2)).toFixed(3);
        const stage2LocalProgress = Math.max(0, Math.min(1, (p - 0.30) / 0.45));
        const explosionBounce = Math.sin(stage2LocalProgress * Math.PI);
        const scale2 = (0.98 + (explosionBounce * 0.03)).toFixed(3);
        layerExploded.style.transform = `scale(${scale2})`;
      }

      // Stage 3 (SpineAlign Biometrics): Fades in 0.68 to 0.78, solid 0.78 to 0.94
      let o3 = 0;
      if (p >= 0.68 && p < 0.78) {
        o3 = (p - 0.68) / 0.10;
      } else if (p >= 0.78 && p <= 0.94) {
        o3 = 1;
      } else if (p > 0.94) {
        o3 = (1.0 - p) / 0.06;
      }

      if (layerSpine) {
        layerSpine.style.opacity = Math.max(0, Math.min(1, o3)).toFixed(3);
        const scale3 = (0.99 + (Math.sin((p - 0.68) * Math.PI) * 0.02)).toFixed(3);
        layerSpine.style.transform = `scale(${scale3})`;
      }

      // ----------------------------------------------------------------------
      // 2. Spatial Badges & Telemetry
      // ----------------------------------------------------------------------
      const inDeconstruction = p >= 0.36 && p <= 0.68;
      if (calloutQuilt) calloutQuilt.classList.toggle('active', inDeconstruction && p >= 0.38 && p <= 0.52);
      if (calloutLatex) calloutLatex.classList.toggle('active', inDeconstruction && p >= 0.42 && p <= 0.58);
      if (calloutCoils) calloutCoils.classList.toggle('active', inDeconstruction && p >= 0.46 && p <= 0.64);
      if (calloutBase) calloutBase.classList.toggle('active', inDeconstruction && p >= 0.50 && p <= 0.68);

      if (telemetryBadge) {
        telemetryBadge.classList.toggle('active', p >= 0.72 && p <= 0.95);
      }

      // ----------------------------------------------------------------------
      // 3. Mobile Tier HUD Indicator
      // ----------------------------------------------------------------------
      if (mobileTierContent) {
        let mobileText = 'TIER 01–04 • Assembled Core Monolith';
        if (p >= 0.32 && p < 0.44) {
          mobileText = 'TIER 01 • Cloud-Quilted Organic Cashmere';
        } else if (p >= 0.44 && p < 0.56) {
          mobileText = 'TIER 02 • 100% Kerala Dunlop Latex';
        } else if (p >= 0.56 && p < 0.66) {
          mobileText = 'TIER 03 • 1,200+ Titanium Pocket Springs';
        } else if (p >= 0.66 && p < 0.76) {
          mobileText = 'TIER 04 • High-Density Acoustic Base';
        } else if (p >= 0.76) {
          mobileText = 'SPINEALIGN™ • Zero-Shear Ergonomic Neutrality';
        }
        if (mobileTierContent.textContent !== mobileText) {
          mobileTierContent.textContent = mobileText;
        }
      }

      // ----------------------------------------------------------------------
      // 4. Scrub Track HUD & Prompts
      // ----------------------------------------------------------------------
      if (scrubFill) {
        scrubFill.style.width = `${(p * 100).toFixed(1)}%`;
      }
      if (scrubPct) {
        const pct = Math.round(p * 100);
        if (pct >= 90) {
          scrubPct.textContent = '100% SPINEALIGN';
        } else if (pct >= 35) {
          scrubPct.textContent = `${pct}% DECONSTRUCTED`;
        } else {
          scrubPct.textContent = `${pct}% ASSEMBLED`;
        }
      }
      if (scrubPrompt) {
        scrubPrompt.style.opacity = p > 0.08 ? '0.35' : '1';
      }

      // ----------------------------------------------------------------------
      // 5. Active Stage Milestone & Narrative Deck
      // ----------------------------------------------------------------------
      let stageIdx = 0;
      if (p >= 0.35 && p < 0.70) {
        stageIdx = 1;
      } else if (p >= 0.70) {
        stageIdx = 2;
      }

      if (stageIdx !== activeStageIndex) {
        activeStageIndex = stageIdx;
        const currentMeta = STAGE_META[stageIdx];

        if (stagePill) {
          stagePill.textContent = currentMeta.label;
        }

        // Toggle story slides with smooth CSS transitions
        storySlides.forEach((slide) => {
          const slideStage = parseInt(slide.getAttribute('data-stage'), 10);
          slide.classList.toggle('active', slideStage === stageIdx);
        });

        // Update active phase pill button
        phaseBtns.forEach((btn, idx) => {
          const btnIdx = idx % STAGE_META.length;
          btn.classList.toggle('active', btnIdx === stageIdx);
          btn.setAttribute('aria-selected', btnIdx === stageIdx ? 'true' : 'false');
        });
      }

      // ----------------------------------------------------------------------
      // 6. Desktop Gyro Mouse Parallax Tilt
      // ----------------------------------------------------------------------
      if (window.innerWidth > 991 && stageContainer) {
        currentTiltX += (targetTiltX - currentTiltX) * 0.08;
        currentTiltY += (targetTiltY - currentTiltY) * 0.08;
        const subtleLevitate = Math.sin(timestamp * 0.0018) * 4;
        stageContainer.style.transform = `perspective(1200px) rotateX(${currentTiltY.toFixed(2)}deg) rotateY(${currentTiltX.toFixed(2)}deg) translateY(${subtleLevitate.toFixed(2)}px)`;
      }

      requestAnimationFrame(renderEngine);
    }

    requestAnimationFrame(renderEngine);

    // Interactive Phase Buttons: Smoothly animate to stage milestones
    phaseBtns.forEach((btn, idx) => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const stageIdx = idx % STAGE_META.length;
        const targetMeta = STAGE_META[stageIdx];
        const totalScroll = wrapper.offsetHeight - window.innerHeight;
        const wrapperTop = wrapper.getBoundingClientRect().top + window.scrollY;
        const targetScrollTop = wrapperTop + (totalScroll * targetMeta.milestone);

        // Immediate visual response
        currentTargetProgress = targetMeta.milestone;

        window.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initZeroGHero);
  } else {
    initZeroGHero();
  }
})();
