/**
 * LORA Mattress — The Zero-Gravity Flagship Architectural Showcase
 * 
 * Features:
 * - 3 Flagship Master Stages:
 *     Stage 0: 01. Core (Assembled Monolith in Zero-G suspension)
 *     Stage 1: 02. Anatomy (4-Tier Deconstructed Architecture)
 *     Stage 2: 03. SpineAlign™ (7-Zone Biometric Ergonomic Alignment)
 * - Silk discrete crossfade transitions (zero ghosting, zero label bleed)
 * - 4.5s steady hold per stage with smooth auto-progression
 * - Interactive pause lock: User taps hold stage for 8.5s without jumping
 * - Pointer 3D perspective parallax for desktop
 * - Zero boxy artifacts, pure luxury sleep science presentation
 */

(function () {
  'use strict';

  function initDeconstructedHeroEngine() {
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
    const calloutOverlay = wrapper.querySelector('.hero-callout-overlay');

    if (calloutOverlay) {
      calloutOverlay.innerHTML = '';
    }

    const STAGES = [
      {
        index: 0,
        label: '01 / ARCHITECTURAL ZERO-G SLEEP',
        title: 'Sculpted for<br><span class="gradient-text hero-shimmer-title">Weightless Sleep.</span>',
        copy: 'Leave gravity behind. The unified LORA core floats in zero-gravity suspension. 100% natural Dunlop latex meets zoned titanium coils.',
        tag: 'ZERO-G SUSPENSION',
        m1Label: 'Core Architecture',
        m1Val: 'Multi-Tier Unified',
        m2Label: 'Surface Cooling',
        m2Val: 'Active Micro-Knit'
      },
      {
        index: 1,
        label: '02 / DECONSTRUCTED 4-TIER ANATOMY',
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

    let currentStageIndex = 0;
    let isPlaying = true;
    let lastStageSwitch = Date.now();
    let userPauseUntil = 0;
    const STAGE_DURATION_MS = 4500; // 4.5s hold per stage

    // 3D Parallax Tilt state (Desktop)
    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;

    function setStage(index, isUserAction = false) {
      currentStageIndex = ((index % STAGES.length) + STAGES.length) % STAGES.length;
      const stage = STAGES[currentStageIndex];

      // Discrete opacities: only the active stage is 1, others are 0.
      // CSS handles the smooth 450ms crossfade transition without ghosting.
      if (layerAssembled) layerAssembled.style.opacity = currentStageIndex === 0 ? '1' : '0';
      if (layerExploded) layerExploded.style.opacity = currentStageIndex === 1 ? '1' : '0';
      if (layerSpine) layerSpine.style.opacity = currentStageIndex === 2 ? '1' : '0';

      // Status pill label
      if (statusLabel) {
        statusLabel.textContent = stage.label;
      }

      // Dynamic text updates
      if (heroTitle && heroTitle.dataset.index !== String(currentStageIndex)) {
        heroTitle.dataset.index = String(currentStageIndex);
        heroTitle.innerHTML = stage.title;
        if (heroCopy) heroCopy.innerHTML = stage.copy;
        if (hudTag) hudTag.textContent = stage.tag;
        if (hudMetric1Label) hudMetric1Label.textContent = stage.m1Label;
        if (hudMetric1Val) hudMetric1Val.textContent = stage.m1Val;
        if (hudMetric2Label) hudMetric2Label.textContent = stage.m2Label;
        if (hudMetric2Val) hudMetric2Val.textContent = stage.m2Val;
      }

      // Update Phase Buttons active states (mobile & desktop)
      phaseBtns.forEach((btn, idx) => {
        const stageIdx = idx % STAGES.length;
        if (stageIdx === currentStageIndex) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Update Timeline Thumb
      if (timelineThumb) {
        const pct = ((currentStageIndex + 1) / STAGES.length) * 100;
        timelineThumb.style.width = `${pct}%`;
      }

      lastStageSwitch = Date.now();

      // If user tapped a button or scrubbed, lock auto-cycle for 8.5 seconds
      if (isUserAction) {
        userPauseUntil = Date.now() + 8500;
      }
    }

    // Initialize with Stage 0
    setStage(0, false);

    // Desktop Pointer Parallax Listener
    window.addEventListener('mousemove', function (e) {
      if (window.innerWidth <= 768) return;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      targetTiltX = ((e.clientX - centerX) / centerX) * 7;
      targetTiltY = -((e.clientY - centerY) / centerY) * 5;
    }, { passive: true });

    // Animation & Timing Loop
    function renderLoop(timestamp) {
      // Desktop subtle gyro tilt
      if (window.innerWidth > 768 && stageContainer) {
        currentTiltX += (targetTiltX - currentTiltX) * 0.08;
        currentTiltY += (targetTiltY - currentTiltY) * 0.08;
        const levitation = Math.sin(timestamp * 0.0015) * 6;
        stageContainer.style.transform = `perspective(1400px) rotateX(${currentTiltY.toFixed(2)}deg) rotateY(${currentTiltX.toFixed(2)}deg) translateY(${levitation.toFixed(2)}px)`;
      }

      // Auto-cycle progression
      const now = Date.now();
      if (isPlaying && now > userPauseUntil) {
        if (now - lastStageSwitch >= STAGE_DURATION_MS) {
          setStage(currentStageIndex + 1, false);
        }
      }

      requestAnimationFrame(renderLoop);
    }

    requestAnimationFrame(renderLoop);

    // Play / Pause Ambient Float Toggle
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', function () {
        isPlaying = !isPlaying;
        this.innerHTML = isPlaying
          ? '<span>⏸ Pause Ambient Float</span>'
          : '<span>▶ Resume Ambient Float</span>';
        if (isPlaying) {
          lastStageSwitch = Date.now();
          userPauseUntil = 0;
        }
      });
    }

    // Phase Buttons Click Listeners (both desktop & mobile)
    phaseBtns.forEach((btn, idx) => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const stageIndex = idx % STAGES.length;
        setStage(stageIndex, true);
      });
    });

    // Timeline Track Click & Scrub
    if (timelineWrapper) {
      timelineWrapper.addEventListener('click', function (e) {
        const rect = this.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const fraction = Math.max(0, Math.min(0.999, clickX / rect.width));
        const stageIndex = Math.floor(fraction * STAGES.length);
        setStage(stageIndex, true);
      });
    }

    // Beacon clicks if present
    const specBeacons = wrapper.querySelectorAll('.hero-spec-beacon');
    specBeacons.forEach(beacon => {
      beacon.addEventListener('click', function () {
        if (this.dataset.stageTarget !== undefined) {
          const target = parseInt(this.dataset.stageTarget, 10);
          setStage(target, true);
        } else if (this.dataset.scrollTarget) {
          const targetEl = document.querySelector(this.dataset.scrollTarget);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDeconstructedHeroEngine);
  } else {
    initDeconstructedHeroEngine();
  }
})();
