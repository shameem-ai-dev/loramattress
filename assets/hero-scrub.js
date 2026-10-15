/**
 * LORA Mattress — The Zero-Gravity Cinematic Scroll-Driven Deconstruction Engine
 * 
 * Concept:
 * - Truly pinned scroll-driven storytelling (240vh mobile / 280vh desktop)
 * - Stage 1 (0% - 28%): Monolith Core floating in Zero-G
 * - Stage 2 (28% - 66%): 4-Tier Exploded Architecture with Floating Spatial Callouts
 * - Stage 3 (66% - 100%): SpineAlign™ 7-Zone Biometric X-Ray Contour & Zero Spinal Shear
 * - Liquid-smooth 60fps lerp interpolation
 * - Interactive chapter buttons that smoothly scroll to each story milestone
 * - Real-time deconstruction percentage meter & progress HUD
 */

(function () {
  'use strict';

  function initScrollDeconstructedHero() {
    const wrapper = document.querySelector('.hero-scroll-wrapper');
    if (!wrapper) return;

    const layerAssembled = wrapper.querySelector('.stage-layer-assembled');
    const layerExploded = wrapper.querySelector('.stage-layer-exploded');
    const layerSpine = wrapper.querySelector('.stage-layer-spine');
    const stageContainer = wrapper.querySelector('.hero-visual-stage');
    const timelineThumb = wrapper.querySelector('.timeline-thumb');
    const statusLabel = wrapper.querySelector('.scrub-status-label');
    const playPauseBtn = wrapper.querySelector('.hero-loop-toggle');
    const phaseBtns = wrapper.querySelectorAll('.phase-btn');
    const timelineWrapper = wrapper.querySelector('.timeline-track-wrapper');
    const heroTitle = wrapper.querySelector('.hero-title-dynamic');
    const heroCopy = wrapper.querySelector('.hero-copy-dynamic');
    const hudMetric1Label = document.querySelector('#hud-m1-label');
    const hudMetric1Val = document.querySelector('#hud-m1-val');
    const hudMetric2Label = document.querySelector('#hud-m2-label');
    const hudMetric2Val = document.querySelector('#hud-m2-val');
    const hudTag = document.querySelector('#hud-status-tag');

    // Spatial Callouts
    const calloutLatex = document.querySelector('#spatial-callout-latex');
    const calloutCoils = document.querySelector('#spatial-callout-coils');
    const calloutSpine = document.querySelector('#spatial-callout-spine');

    // Scroll Progress HUD elements
    const scrollHudFill = document.querySelector('#hero-scroll-hud-fill');
    const scrollHudPct = document.querySelector('#hero-scroll-pct');
    const scrollHudPrompt = document.querySelector('#hero-scroll-prompt');

    const STAGES = [
      {
        index: 0,
        milestone: 0.05,
        label: '01 / ARCHITECTURAL ZERO-G SLEEP',
        title: 'Sculpted for<br><span class="gradient-text hero-shimmer-title">Weightless Sleep.</span>',
        copy: 'Leave gravity behind. 100% natural Kerala Dunlop latex meets zoned titanium coils. Scroll down to deconstruct the interior.',
        tag: 'ZERO-G SUSPENSION',
        m1Label: 'Core Architecture',
        m1Val: 'Multi-Tier Unified',
        m2Label: 'Surface Cooling',
        m2Val: 'Active Micro-Knit'
      },
      {
        index: 1,
        milestone: 0.48,
        label: '02 / 4-TIER DECONSTRUCTED ANATOMY',
        title: 'Deconstructed.<br><span class="gradient-text hero-shimmer-title">Zero Compromise.</span>',
        copy: 'Every tier serves an uncompromising biological purpose: 100% natural Dunlop latex for buoyant contouring, 1,200+ titanium pocket springs for motion isolation.',
        tag: '4-TIER SPATIAL ANATOMY',
        m1Label: 'Pocket Spring Grid',
        m1Val: '1,200+ Independent Coils',
        m2Label: 'Latex Matrix',
        m2Val: '100% Dunlop Pin-Core'
      },
      {
        index: 2,
        milestone: 0.85,
        label: '03 / SPINEALIGN™ 7-ZONE BIOMETRICS',
        title: 'SpineAlign™.<br><span class="gradient-text hero-shimmer-title">Zero Spinal Shear.</span>',
        copy: 'Dynamic 7 localized support zones contour dynamically to cervical, thoracic, and lumbar vertebrae, eliminating back strain and pressure points permanently.',
        tag: '7-ZONE BIOMETRICS',
        m1Label: 'Lumbar Lordosis Support',
        m1Val: '100% Neutral Fill',
        m2Label: 'Vertebral Shear Force',
        m2Val: '0.0 N (Zero-Shear)'
      }
    ];

    let currentTargetProgress = 0;
    let smoothProgress = 0;
    let activeStageIndex = 0;

    // Desktop Parallax Tilt state
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

    // Scroll listener updates target
    function onScrollUpdate() {
      currentTargetProgress = calculateScrollProgress();
    }

    window.addEventListener('scroll', onScrollUpdate, { passive: true });
    window.addEventListener('resize', onScrollUpdate, { passive: true });
    currentTargetProgress = calculateScrollProgress();
    smoothProgress = currentTargetProgress;

    // Desktop Pointer Tilt
    window.addEventListener('mousemove', function (e) {
      if (window.innerWidth <= 768) return;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      targetTiltX = ((e.clientX - centerX) / centerX) * 6;
      targetTiltY = -((e.clientY - centerY) / centerY) * 4;
    }, { passive: true });

    function renderEngine(timestamp) {
      // Liquid lerp interpolation for silky scroll physics
      smoothProgress += (currentTargetProgress - smoothProgress) * 0.14;
      const p = smoothProgress;

      // 1. Layer Opacities & Spatial Depth Transforms
      // Stage 1: Assembled Core (0.00 - 0.32)
      let o1 = 0;
      if (p <= 0.20) {
        o1 = 1;
      } else if (p < 0.32) {
        o1 = (0.32 - p) / 0.12;
      }
      if (layerAssembled) {
        layerAssembled.style.opacity = Math.max(0, Math.min(1, o1)).toFixed(3);
        const scale1 = (1 + (p * 0.08)).toFixed(3);
        const y1 = (p * -12).toFixed(1);
        layerAssembled.style.transform = `scale(${scale1}) translateY(${y1}px)`;
      }

      // Stage 2: Exploded Anatomy (0.22 - 0.68)
      let o2 = 0;
      if (p >= 0.22 && p < 0.34) {
        o2 = (p - 0.22) / 0.12;
      } else if (p >= 0.34 && p <= 0.58) {
        o2 = 1;
      } else if (p > 0.58 && p < 0.68) {
        o2 = (0.68 - p) / 0.10;
      }
      if (layerExploded) {
        layerExploded.style.opacity = Math.max(0, Math.min(1, o2)).toFixed(3);
        // Peak spatial explosion at 0.46
        const progressInStage2 = Math.max(0, Math.min(1, (p - 0.22) / 0.46));
        const explosionFactor = Math.sin(progressInStage2 * Math.PI);
        const scale2 = (0.97 + (explosionFactor * 0.05)).toFixed(3);
        const y2 = (explosionFactor * -8).toFixed(1);
        layerExploded.style.transform = `scale(${scale2}) translateY(${y2}px)`;
      }

      // Stage 3: SpineAlign Biometrics (0.60 - 1.00)
      let o3 = 0;
      if (p >= 0.60 && p < 0.72) {
        o3 = (p - 0.60) / 0.12;
      } else if (p >= 0.72) {
        o3 = 1;
      }
      if (layerSpine) {
        layerSpine.style.opacity = Math.max(0, Math.min(1, o3)).toFixed(3);
        const scale3 = (0.98 + (Math.min(1, (p - 0.60) / 0.40) * 0.02)).toFixed(3);
        layerSpine.style.transform = `scale(${scale3})`;
      }

      // 2. Holographic Spatial Callouts Active States
      if (calloutLatex) {
        if (p >= 0.28 && p <= 0.62) {
          calloutLatex.classList.add('active');
        } else {
          calloutLatex.classList.remove('active');
        }
      }
      if (calloutCoils) {
        if (p >= 0.32 && p <= 0.64) {
          calloutCoils.classList.add('active');
        } else {
          calloutCoils.classList.remove('active');
        }
      }
      if (calloutSpine) {
        if (p >= 0.68 && p <= 0.98) {
          calloutSpine.classList.add('active');
        } else {
          calloutSpine.classList.remove('active');
        }
      }

      // 3. Update Progress HUD
      if (scrollHudFill) {
        scrollHudFill.style.width = `${(p * 100).toFixed(1)}%`;
      }
      if (scrollHudPct) {
        const pct = Math.round(p * 100);
        if (pct >= 95) {
          scrollHudPct.textContent = '100% COMPLETE';
        } else {
          scrollHudPct.textContent = `${pct}% DECONSTRUCTED`;
        }
      }
      if (scrollHudPrompt) {
        scrollHudPrompt.style.opacity = p > 0.06 ? '0' : '1';
      }

      // 4. Update Desktop Controller timeline thumb
      if (timelineThumb) {
        timelineThumb.style.width = `${(p * 100).toFixed(1)}%`;
      }

      // 5. Active Stage milestone determination
      let stageIdx = 0;
      if (p >= 0.28 && p < 0.64) {
        stageIdx = 1;
      } else if (p >= 0.64) {
        stageIdx = 2;
      }

      if (stageIdx !== activeStageIndex) {
        activeStageIndex = stageIdx;
        const stage = STAGES[stageIdx];

        if (statusLabel) statusLabel.textContent = stage.label;
        if (heroTitle) {
          heroTitle.dataset.index = String(stageIdx);
          heroTitle.innerHTML = stage.title;
        }
        if (heroCopy) heroCopy.innerHTML = stage.copy;
        if (hudTag) hudTag.textContent = stage.tag;
        if (hudMetric1Label) hudMetric1Label.textContent = stage.m1Label;
        if (hudMetric1Val) hudMetric1Val.textContent = stage.m1Val;
        if (hudMetric2Label) hudMetric2Label.textContent = stage.m2Label;
        if (hudMetric2Val) hudMetric2Val.textContent = stage.m2Val;

        // Update button highlight
        phaseBtns.forEach((btn, idx) => {
          const btnStage = idx % STAGES.length;
          if (btnStage === stageIdx) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
      }

      // 6. Desktop gyro parallax tilt
      if (window.innerWidth > 768 && stageContainer) {
        currentTiltX += (targetTiltX - currentTiltX) * 0.08;
        currentTiltY += (targetTiltY - currentTiltY) * 0.08;
        const subtleFloat = Math.sin(timestamp * 0.0015) * 5;
        stageContainer.style.transform = `perspective(1400px) rotateX(${currentTiltY.toFixed(2)}deg) rotateY(${currentTiltX.toFixed(2)}deg) translateY(${subtleFloat.toFixed(2)}px)`;
      }

      requestAnimationFrame(renderEngine);
    }

    requestAnimationFrame(renderEngine);

    // Interactive Phase Buttons: Smoothly scroll to that section of the story!
    phaseBtns.forEach((btn, idx) => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const stageIdx = idx % STAGES.length;
        const stage = STAGES[stageIdx];
        const totalScroll = wrapper.offsetHeight - window.innerHeight;
        const targetScrollTop = wrapper.offsetTop + (totalScroll * stage.milestone);
        window.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
      });
    });

    // Timeline Track Click
    if (timelineWrapper) {
      timelineWrapper.addEventListener('click', function (e) {
        const rect = this.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const fraction = Math.max(0, Math.min(1, clickX / rect.width));
        const totalScroll = wrapper.offsetHeight - window.innerHeight;
        const targetScrollTop = wrapper.offsetTop + (totalScroll * fraction);
        window.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
      });
    }

    // Loop toggle acts as an auto-tour demo
    let autoTourTimer = null;
    if (playPauseBtn) {
      let isAutoTouring = false;
      playPauseBtn.addEventListener('click', function () {
        isAutoTouring = !isAutoTouring;
        if (isAutoTouring) {
          this.innerHTML = '<span>⏸ Stop Auto Tour</span>';
          let tourStep = 0;
          autoTourTimer = setInterval(() => {
            tourStep = (tourStep + 1) % STAGES.length;
            const totalScroll = wrapper.offsetHeight - window.innerHeight;
            const targetScrollTop = wrapper.offsetTop + (totalScroll * STAGES[tourStep].milestone);
            window.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
          }, 3500);
        } else {
          this.innerHTML = '<span>▶ Resume Auto Tour</span>';
          clearInterval(autoTourTimer);
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollDeconstructedHero);
  } else {
    initScrollDeconstructedHero();
  }
})();
