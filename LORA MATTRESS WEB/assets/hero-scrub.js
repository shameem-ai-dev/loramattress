/**
 * LORA Mattress — The Zero-Gravity Deconstructed Architecture & Spine Resonance Engine
 * Unique Concept:
 * - Stage 1: Assembled Monolith Core floating in zero-gravity space
 * - Stage 2: 4-Tier Deconstructed Architectural Layers floating with 3D spatial depth
 * - Stage 3: SpineAlign™ Holographic Contour & 7-Zone Biometric Pressure Mapping
 * 
 * Features:
 * - Real-time scroll scrub + autonomous ambient loop
 * - Mouse / pointer dynamic 3D perspective gyroscope tilt
 * - Instant interactive state triggers (Assembled, Deconstructed, SpineAlign)
 * - Draggable / clickable timeline scrub controller
 * - Interactive layer callout inspection
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

    let isPlaying = true;
    let loopProgress = 0.05;
    let targetProgress = loopProgress;
    let lastScrollY = window.scrollY;
    let lastTimestamp = performance.now();

    // 3D Parallax Tilt state
    let mouseX = 0;
    let mouseY = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;

    const BASE_SPEED = 0.00025; // elegant ambient tempo

    const STAGES = [
      {
        progress: 0.12,
        label: '01 / ASSEMBLED CORE • ZERO-G SUSPENSION',
        title: 'Better nights.<br><span class="gradient-text">Better mornings.</span>',
        copy: 'Leave the day behind. The unified LORA core floats in zero-gravity suspension. Molecular comfort foam meets zoned titanium coils—scroll to deconstruct the engineering.',
        tag: 'ZERO-G SUSPENSION',
        m1Label: 'Core Architecture',
        m1Val: 'Multi-Tier Unified',
        m2Label: 'Surface Cooling',
        m2Val: 'Active Micro-Knit',
        callouts: [
          { top: '38%', left: '55%', text: 'Diamond Cooling Knit Top' },
          { top: '64%', left: '72%', text: 'Cyan Luminescence Edge Piping' }
        ]
      },
      {
        progress: 0.48,
        label: '02 / DECONSTRUCTED LAYERS • 4-TIER ANATOMY',
        title: 'Deconstructed.<br><span class="gradient-text">Zero Compromise.</span>',
        copy: 'Every tier serves an uncompromising biological purpose: 100% natural Dunlop latex for buoyant contouring, 1,200+ titanium pocket springs for motion isolation, and an anti-sag acoustic base.',
        tag: '4-TIER SPATIAL ANATOMY',
        m1Label: 'Pocket Spring Grid',
        m1Val: '1,200+ Independent Coils',
        m2Label: 'Latex Matrix',
        m2Val: '100% Dunlop Pin-Core',
        callouts: [
          { top: '24%', left: '60%', text: 'Tier 1: Phase-Change Quilt' },
          { top: '42%', left: '68%', text: 'Tier 2: 100% Organic Latex' },
          { top: '58%', left: '76%', text: 'Tier 3: Titanium Pocket Coils' },
          { top: '75%', left: '65%', text: 'Tier 4: Acoustic Anti-Sag Base' }
        ]
      },
      {
        progress: 0.84,
        label: '03 / SPINEALIGN™ RESONANCE • 7-ZONE BIOMETRICS',
        title: 'SpineAlign™.<br><span class="gradient-text">Zero Spinal Shear.</span>',
        copy: 'Inspired by the anatomical wave of our logo. 7 localized support zones contour dynamically to the cervical, thoracic, and lumbar vertebrae, eliminating back strain permanently.',
        tag: '7-ZONE BIOMETRICS',
        m1Label: 'Lumbar Lordosis Support',
        m1Val: '100% Neutral Fill',
        m2Label: 'Vertebral Shear Force',
        m2Val: '0.0 N (Zero-Shear)',
        callouts: [
          { top: '35%', left: '58%', text: 'Cervical Zero-Shear Zone' },
          { top: '50%', left: '66%', text: 'Active Lumbar Pushback' },
          { top: '65%', left: '52%', text: 'Bioluminescent Pressure Mesh' }
        ]
      }
    ];

    function updateCallouts(stageIndex) {
      if (!calloutOverlay) return;
      const stage = STAGES[stageIndex];
      if (!stage || !stage.callouts) {
        calloutOverlay.innerHTML = '';
        return;
      }

      calloutOverlay.innerHTML = stage.callouts.map(c => `
        <div class="hero-callout-pin" style="top: ${c.top}; left: ${c.left};">
          <span class="callout-dot"></span>
          <span class="callout-pill">${c.text}</span>
        </div>
      `).join('');
    }

    function applyStageProgress(prog) {
      const p = ((prog % 1) + 1) % 1;

      // 3-Way Crossfade between the 3 high-res 3D stages:
      // 0.00 - 0.33: Stage 1 Assembled dominates, Stage 2 Exploded begins to separate
      // 0.33 - 0.66: Stage 2 Exploded peaks with full layer separation
      // 0.66 - 1.00: Stage 3 SpineAlign Resonance peaks with glowing spine wave and pressure nodes
      let a1 = 0, a2 = 0, a3 = 0;

      if (p < 0.33) {
        const t = p / 0.33;
        a1 = 1 - (t * 0.5);
        a2 = t;
        a3 = 0;
      } else if (p < 0.66) {
        const t = (p - 0.33) / 0.33;
        a1 = Math.max(0, (1 - t) * 0.5);
        a2 = 1;
        a3 = t;
      } else {
        const t = (p - 0.66) / 0.34;
        a1 = t * 0.6; // smoothly wraps into stage 1
        a2 = 1 - t;
        a3 = 1 - (t * 0.4);
      }

      if (layerAssembled) layerAssembled.style.opacity = Math.max(0, Math.min(1, a1)).toFixed(3);
      if (layerExploded) layerExploded.style.opacity = Math.max(0, Math.min(1, a2)).toFixed(3);
      if (layerSpine) layerSpine.style.opacity = Math.max(0, Math.min(1, a3)).toFixed(3);

      // Scrub indicator thumb
      if (timelineThumb) {
        timelineThumb.style.width = `${(p * 100).toFixed(1)}%`;
      }

      // Determine active stage configuration
      let activeIndex = 0;
      if (p >= 0.28 && p < 0.62) {
        activeIndex = 1;
      } else if (p >= 0.62) {
        activeIndex = 2;
      }

      const activeStage = STAGES[activeIndex];
      if (statusLabel && statusLabel.textContent !== activeStage.label) {
        statusLabel.textContent = activeStage.label;
      }

      if (heroTitle && heroTitle.dataset.index !== String(activeIndex)) {
        heroTitle.dataset.index = String(activeIndex);
        heroTitle.innerHTML = activeStage.title;
        if (heroCopy) heroCopy.innerHTML = activeStage.copy;
        if (hudTag) hudTag.textContent = activeStage.tag;
        if (hudMetric1Label) hudMetric1Label.textContent = activeStage.m1Label;
        if (hudMetric1Val) hudMetric1Val.textContent = activeStage.m1Val;
        if (hudMetric2Label) hudMetric2Label.textContent = activeStage.m2Label;
        if (hudMetric2Val) hudMetric2Val.textContent = activeStage.m2Val;
        updateCallouts(activeIndex);
      }

      // Highlight corresponding phase button
      phaseBtns.forEach((btn, idx) => {
        if (idx === activeIndex) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    // Pointer Parallax / 3D Tilt Listener
    window.addEventListener('mousemove', function (e) {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      targetTiltX = ((e.clientX - centerX) / centerX) * 8; // -8deg to +8deg
      targetTiltY = -((e.clientY - centerY) / centerY) * 6; // -6deg to +6deg
    }, { passive: true });

    function renderEngine(timestamp) {
      const delta = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      // Smooth 3D tilt interpolation
      currentTiltX += (targetTiltX - currentTiltX) * 0.08;
      currentTiltY += (targetTiltY - currentTiltY) * 0.08;

      if (stageContainer) {
        // Subtle organic zero-gravity breathing levitation
        const levitation = Math.sin(timestamp * 0.0015) * 6;
        stageContainer.style.transform = `perspective(1400px) rotateX(${currentTiltY.toFixed(2)}deg) rotateY(${currentTiltX.toFixed(2)}deg) translateY(${levitation.toFixed(2)}px)`;
      }

      // Scroll scrub integration
      const currentScrollY = window.scrollY;
      const scrollDiff = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;

      const rect = wrapper.getBoundingClientRect();
      if (rect.top <= 0 && rect.bottom >= window.innerHeight) {
        // Accelerate scrub with scroll velocity
        targetProgress = (targetProgress + (scrollDiff * 0.0014)) % 1;
      }

      if (isPlaying) {
        targetProgress = (targetProgress + (BASE_SPEED * (delta / 16.67))) % 1;
      }

      // Liquid lerp for smooth transitions
      loopProgress += (targetProgress - loopProgress) * 0.12;
      applyStageProgress(loopProgress);

      requestAnimationFrame(renderEngine);
    }

    requestAnimationFrame(renderEngine);

    // Play / Pause Toggle
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', function () {
        isPlaying = !isPlaying;
        this.innerHTML = isPlaying
          ? '<span>⏸ Pause Ambient Float</span>'
          : '<span>▶ Resume Ambient Float</span>';
      });
    }

    // Phase Buttons Click
    phaseBtns.forEach((btn, idx) => {
      btn.addEventListener('click', function () {
        const stage = STAGES[idx];
        if (stage) {
          targetProgress = stage.progress;
          loopProgress = stage.progress;
          applyStageProgress(loopProgress);
        }
      });
    });

    // Timeline Track Click & Scrub
    if (timelineWrapper) {
      timelineWrapper.addEventListener('click', function (e) {
        const rect = this.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const fraction = Math.max(0, Math.min(1, clickX / rect.width));
        targetProgress = fraction;
        loopProgress = fraction;
        applyStageProgress(loopProgress);
      });
    }

    // Initial callout setup
    updateCallouts(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDeconstructedHeroEngine);
  } else {
    initDeconstructedHeroEngine();
  }
})();
