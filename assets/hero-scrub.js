/**
 * LORA Mattress — Biometric Zero-G & Kinetic Laser Deconstruction Engine
 * 
 * Aesthetics:
 * Deep luxury midnight cosmic (#060913 to #0B132B), radiant cyan/electric blue (#00F2FE / #38BDF8),
 * seamless non-boxy visual blending, floating glassmorphic telemetry, and tactile 60fps physics.
 */

(function () {
  'use strict';

  function initScrollDeconstructedHero() {
    const wrapper = document.querySelector('.hero-scroll-wrapper');
    if (!wrapper) return;

    // Visual Stage layers
    const layerAssembled = wrapper.querySelector('.stage-layer-assembled');
    const layerExploded = wrapper.querySelector('.stage-layer-exploded');
    const layerSpine = wrapper.querySelector('.stage-layer-spine');
    const stageContainer = wrapper.querySelector('.hero-visual-stage');
    const scannerBeam = document.querySelector('#hero-scanner-beam');
    const scannerDepth = document.querySelector('#scanner-depth-readout');

    // Controls & Navigation
    const timelineThumb = wrapper.querySelector('.timeline-thumb');
    const statusLabel = wrapper.querySelector('.scrub-status-label');
    const playPauseBtn = wrapper.querySelector('.hero-loop-toggle');
    const phaseBtns = wrapper.querySelectorAll('.phase-btn');
    const timelineWrapper = wrapper.querySelector('.timeline-track-wrapper');
    const heroTitle = wrapper.querySelector('.hero-title-dynamic');
    const heroCopy = wrapper.querySelector('.hero-copy-dynamic');
    const btnActionPrimary = document.querySelector('#hero-action-primary');
    const btnActionSecondary = document.querySelector('#hero-action-secondary');

    // Live Telemetry HUD elements
    const hudMetric1Label = document.querySelector('#hud-m1-label');
    const hudMetric1Val = document.querySelector('#hud-m1-val');
    const hudMetric2Label = document.querySelector('#hud-m2-label');
    const hudMetric2Val = document.querySelector('#hud-m2-val');
    const hudTag = document.querySelector('#hud-status-tag');
    const spinePath = document.querySelector('#hero-spine-path');
    const spineDots = [
      document.querySelector('#spine-dot-1'),
      document.querySelector('#spine-dot-2'),
      document.querySelector('#spine-dot-3'),
      document.querySelector('#spine-dot-4')
    ].filter(Boolean);

    // Spatial Callouts
    const calloutQuilt = document.querySelector('#spatial-callout-quilt');
    const calloutLatex = document.querySelector('#spatial-callout-latex');
    const calloutCoils = document.querySelector('#spatial-callout-coils');
    const calloutBase = document.querySelector('#spatial-callout-base');
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
        copy: 'Leave gravity behind. 100% natural Kerala Dunlop latex meets zoned titanium coils. Scroll down to activate biometric laser deconstruction.',
        tag: 'ZERO-G SUSPENSION',
        m1Label: 'Core Architecture',
        m1Val: 'Multi-Tier Unified',
        m2Label: 'Surface Cooling',
        m2Val: 'Active Micro-Knit',
        btnPrimaryText: 'Explore The 8 Models ↓',
        btnPrimaryHref: '#the-collection'
      },
      {
        index: 1,
        milestone: 0.45,
        label: '02 / 4-TIER DECONSTRUCTED ANATOMY',
        title: 'Deconstructed.<br><span class="gradient-text hero-shimmer-title">Zero Compromise.</span>',
        copy: 'Biometric laser cross-section reveals 4 precision-engineered tiers: cloud-quilted cooling top, 100% Dunlop latex, 1,200+ pocket springs, and acoustic base.',
        tag: '4-TIER SPATIAL ANATOMY',
        m1Label: 'Pocket Spring Grid',
        m1Val: '1,200+ Titanium Coils',
        m2Label: 'Latex Matrix',
        m2Val: '100% Dunlop Pin-Core',
        btnPrimaryText: 'Inspect Technical Specs ↓',
        btnPrimaryHref: '#the-collection'
      },
      {
        index: 2,
        milestone: 0.80,
        label: '03 / SPINEALIGN™ 7-ZONE BIOMETRICS',
        title: 'SpineAlign™.<br><span class="gradient-text hero-shimmer-title">Zero Spinal Shear.</span>',
        copy: 'Dynamic 7 localized support zones contour dynamically to cervical, thoracic, and lumbar vertebrae, eliminating back strain and pressure points permanently.',
        tag: '7-ZONE BIOMETRICS',
        m1Label: 'Lumbar Lordosis Support',
        m1Val: '100% Neutral Fill',
        m2Label: 'Vertebral Shear Force',
        m2Val: '0.0 N (Zero-Shear)',
        btnPrimaryText: 'Explore The 8 Models ↓',
        btnPrimaryHref: '#the-collection'
      }
    ];

    let currentTargetProgress = 0;
    let smoothProgress = 0;
    let activeStageIndex = 0;
    let forceStaticProgress = false;

    // Support instant visual previewing via ?scrollProgress=0.xx
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('scrollProgress')) {
      const paramP = parseFloat(urlParams.get('scrollProgress'));
      if (!isNaN(paramP)) {
        forceStaticProgress = true;
        currentTargetProgress = Math.max(0, Math.min(1, paramP));
        smoothProgress = currentTargetProgress;
      }
    }

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

    function onScrollUpdate() {
      if (forceStaticProgress) return;
      currentTargetProgress = calculateScrollProgress();
    }

    window.addEventListener('scroll', onScrollUpdate, { passive: true });
    window.addEventListener('resize', onScrollUpdate, { passive: true });
    window.addEventListener('load', onScrollUpdate, { passive: true });

    if (!forceStaticProgress) {
      currentTargetProgress = calculateScrollProgress();
      smoothProgress = currentTargetProgress;
    }

    // Desktop Pointer Tilt
    window.addEventListener('mousemove', function (e) {
      if (window.innerWidth <= 768) return;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      targetTiltX = ((e.clientX - centerX) / centerX) * 5;
      targetTiltY = -((e.clientY - centerY) / centerY) * 3.5;
    }, { passive: true });

    // Dynamic SVG Spine Waveform Generator
    function updateSpineWaveform(p, timestamp) {
      if (!spinePath) return;

      // When p approaches Stage 3 (0.65 - 0.85), curve levels out into zero-shear straight ergonomic alignment
      const alignFactor = Math.max(0, Math.min(1, (p - 0.60) / 0.18));
      const neutralY = 30;

      // Base undulating frequency & amplitude
      const t = timestamp * 0.003;
      const amp = (1 - alignFactor * 0.85) * 8; // Flatten to ~1px in Spine stage

      const y1 = neutralY - Math.sin(t + 0.5) * amp;
      const y2 = neutralY + Math.cos(t + 1.2) * amp * 0.8;
      const y3 = neutralY - Math.sin(t + 2.0) * amp * 1.1;
      const y4 = neutralY + Math.cos(t + 2.8) * amp * 0.7;

      const d = `M 10 30 Q 45 ${y1.toFixed(1)}, 90 ${y2.toFixed(1)} T 160 ${y3.toFixed(1)} T 240 ${y4.toFixed(1)} T 310 30`;
      spinePath.setAttribute('d', d);

      if (spineDots[0]) spineDots[0].setAttribute('cy', y1.toFixed(1));
      if (spineDots[1]) spineDots[1].setAttribute('cy', y2.toFixed(1));
      if (spineDots[2]) spineDots[2].setAttribute('cy', y3.toFixed(1));
      if (spineDots[3]) spineDots[3].setAttribute('cy', y4.toFixed(1));
    }

    function renderEngine(timestamp) {
      // Liquid lerp interpolation for silky scroll physics
      if (forceStaticProgress) {
        smoothProgress = currentTargetProgress;
      } else {
        smoothProgress += (currentTargetProgress - smoothProgress) * 0.14;
      }
      const p = smoothProgress;

      // ----------------------------------------------------------------------
      // 1. Layer Crossfades & Perspective Scaling
      // ----------------------------------------------------------------------
      // Assembled Monolith: Full 0.00-0.20, fades out 0.20-0.34, returns 0.82-0.92, full 0.92-1.00
      let o1 = 0;
      if (p <= 0.20) {
        o1 = 1;
      } else if (p < 0.34) {
        o1 = (0.34 - p) / 0.14;
      } else if (p >= 0.82 && p < 0.92) {
        o1 = (p - 0.82) / 0.10;
      } else if (p >= 0.92) {
        o1 = 1;
      }

      if (layerAssembled) {
        layerAssembled.style.opacity = Math.max(0, Math.min(1, o1)).toFixed(3);
        const scale1 = (1 + (Math.sin(p * Math.PI) * 0.04)).toFixed(3);
        layerAssembled.style.transform = `scale(${scale1})`;
      }

      // Exploded Anatomy: Fades in 0.22-0.34, full 0.34-0.62, fades out 0.62-0.72
      let o2 = 0;
      if (p >= 0.22 && p < 0.34) {
        o2 = (p - 0.22) / 0.12;
      } else if (p >= 0.34 && p <= 0.62) {
        o2 = 1;
      } else if (p > 0.62 && p < 0.72) {
        o2 = (0.72 - p) / 0.10;
      }

      if (layerExploded) {
        layerExploded.style.opacity = Math.max(0, Math.min(1, o2)).toFixed(3);
        const progressInStage2 = Math.max(0, Math.min(1, (p - 0.22) / 0.45));
        const explosionFactor = Math.sin(progressInStage2 * Math.PI);
        const scale2 = (0.97 + (explosionFactor * 0.04)).toFixed(3);
        const y2 = (explosionFactor * -8).toFixed(1);
        layerExploded.style.transform = `scale(${scale2}) translateY(${y2}px)`;
      }

      // SpineAlign Biometrics: Fades in 0.64-0.74, full 0.74-0.84, fades out 0.84-0.92
      let o3 = 0;
      if (p >= 0.64 && p < 0.74) {
        o3 = (p - 0.64) / 0.10;
      } else if (p >= 0.74 && p <= 0.84) {
        o3 = 1;
      } else if (p > 0.84 && p < 0.92) {
        o3 = (0.92 - p) / 0.08;
      }

      if (layerSpine) {
        layerSpine.style.opacity = Math.max(0, Math.min(1, o3)).toFixed(3);
        const scale3 = (0.98 + (Math.min(1, (p - 0.64) / 0.25) * 0.02)).toFixed(3);
        layerSpine.style.transform = `scale(${scale3})`;
      }

      // ----------------------------------------------------------------------
      // 2. High-Precision Biometric Laser Scanner Beam
      // ----------------------------------------------------------------------
      if (scannerBeam) {
        // Active during initial deconstruction sweep (0.16 to 0.58)
        if (p >= 0.16 && p <= 0.58) {
          scannerBeam.classList.add('active');
          const scanFraction = (p - 0.16) / 0.42;
          const beamTopPercent = 20 + (scanFraction * 60); // sweeps from 20% to 80%
          scannerBeam.style.top = `${beamTopPercent.toFixed(1)}%`;

          if (scannerDepth) {
            const currentDepthMM = (scanFraction * 280).toFixed(1);
            scannerDepth.textContent = `${currentDepthMM} mm`;
          }
        } else {
          scannerBeam.classList.remove('active');
        }
      }

      // ----------------------------------------------------------------------
      // 3. Sequential Layer Beacons & Spatial Callouts
      // ----------------------------------------------------------------------
      const inAnatomyStage = p >= 0.26 && p <= 0.66;
      if (calloutQuilt) {
        calloutQuilt.classList.toggle('active', inAnatomyStage && p >= 0.28 && p <= 0.45);
      }
      if (calloutLatex) {
        calloutLatex.classList.toggle('active', inAnatomyStage && p >= 0.33 && p <= 0.52);
      }
      if (calloutCoils) {
        calloutCoils.classList.toggle('active', inAnatomyStage && p >= 0.40 && p <= 0.60);
      }
      if (calloutBase) {
        calloutBase.classList.toggle('active', inAnatomyStage && p >= 0.48 && p <= 0.66);
      }
      if (calloutSpine) {
        calloutSpine.classList.toggle('active', p >= 0.68 && p <= 0.86);
      }

      // ----------------------------------------------------------------------
      // 4. Update Real-Time Progress HUD Strip & Controller Thumb
      // ----------------------------------------------------------------------
      if (scrollHudFill) {
        scrollHudFill.style.width = `${(p * 100).toFixed(1)}%`;
      }
      if (scrollHudPct) {
        const pct = Math.round(p * 100);
        if (pct >= 95) {
          scrollHudPct.textContent = '100% ASSEMBLED';
        } else {
          scrollHudPct.textContent = `${pct}% DECONSTRUCTED`;
        }
      }
      if (scrollHudPrompt) {
        scrollHudPrompt.style.opacity = p > 0.08 ? '0' : '1';
      }
      if (timelineThumb) {
        timelineThumb.style.width = `${(p * 100).toFixed(1)}%`;
      }

      // ----------------------------------------------------------------------
      // 5. Active Stage Milestone Determination
      // ----------------------------------------------------------------------
      let stageIdx = 0;
      if (p >= 0.28 && p < 0.65) {
        stageIdx = 1;
      } else if (p >= 0.65) {
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

        if (btnActionPrimary && stage.btnPrimaryText) {
          btnActionPrimary.textContent = stage.btnPrimaryText;
          btnActionPrimary.setAttribute('href', stage.btnPrimaryHref);
        }

        // Highlight active phase pill
        phaseBtns.forEach((btn, idx) => {
          const btnStage = idx % STAGES.length;
          if (btnStage === stageIdx) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
      }

      // ----------------------------------------------------------------------
      // 6. Dynamic Spine Waveform Real-Time Update
      // ----------------------------------------------------------------------
      updateSpineWaveform(p, timestamp);

      // ----------------------------------------------------------------------
      // 7. Desktop Gyro Parallax Tilt & Levitation
      // ----------------------------------------------------------------------
      if (window.innerWidth > 768 && stageContainer) {
        currentTiltX += (targetTiltX - currentTiltX) * 0.08;
        currentTiltY += (targetTiltY - currentTiltY) * 0.08;
        const subtleFloat = Math.sin(timestamp * 0.0018) * 4.5;
        stageContainer.style.transform = `perspective(1400px) rotateX(${currentTiltY.toFixed(2)}deg) rotateY(${currentTiltX.toFixed(2)}deg) translateY(${subtleFloat.toFixed(2)}px)`;
      }

      requestAnimationFrame(renderEngine);
    }

    requestAnimationFrame(renderEngine);

    // Interactive Phase Buttons: Smoothly scroll to story milestones
    phaseBtns.forEach((btn, idx) => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const stageIdx = idx % STAGES.length;
        const stage = STAGES[stageIdx];
        const totalScroll = wrapper.offsetHeight - window.innerHeight;
        const wrapperTop = wrapper.getBoundingClientRect().top + window.scrollY;
        const targetScrollTop = wrapperTop + (totalScroll * stage.milestone);
        window.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
      });
    });

    // Timeline Track Direct Scrubbing
    if (timelineWrapper) {
      timelineWrapper.addEventListener('click', function (e) {
        const rect = this.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const fraction = Math.max(0, Math.min(1, clickX / rect.width));
        const totalScroll = wrapper.offsetHeight - window.innerHeight;
        const wrapperTop = wrapper.getBoundingClientRect().top + window.scrollY;
        const targetScrollTop = wrapperTop + (totalScroll * fraction);
        window.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
      });
    }

    // Auto-Tour Demonstration Mode
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
