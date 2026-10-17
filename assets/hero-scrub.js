/**
 * LORA ATELIER DE SOMMEIL — SCROLL-DRIVEN MATTRESS DECONSTRUCTION ENGINE
 * 
 * Clean, Human-Crafted Luxury Editorial:
 * 1. 6-Stage Smooth Scroll Runway (Sticky 100vh stage across 280vh runway)
 * 2. Seamless Deconstruction (Assembled Flagship -> 4 Exploded Layers -> SpineAlign)
 * 3. Minimalist Editorial Layer Strip & Feature Navigation (Zero Dotted Points)
 * 4. Inside The Comfort Craftsmanship Deck (Lower Section)
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. ATELIER SCROLL RUNWAY & LAYER DECONSTRUCTION ENGINE
  // =========================================================================
  function initAtelierScrollRunway() {
    const heroSection = document.getElementById('signature-hero');
    if (!heroSection) return;

    // Visual Elements
    const imgAssembled = document.getElementById('atelier-img-assembled');
    const imgExploded = document.getElementById('atelier-img-exploded');
    const imgSpine = document.getElementById('atelier-img-spine');

    // Editorial & Feature Navigation
    const featureButtons = heroSection.querySelectorAll('.afr-item');
    const layerTabs = heroSection.querySelectorAll('.als-tab, .as-step');

    // Narrative Elements
    const narrativeDeck = document.getElementById('atelier-narrative-deck');
    const anHeading = document.getElementById('an-heading');
    const anMetrics = document.getElementById('an-metrics');

    // 6 Distinct Layer Stages (Clean Luxury Editorial - Zero Bullets/Dots)
    const STAGES = [
      {
        id: 0,
        heading: 'The Handcrafted LORA Flagship',
        render: 'assembled',
        featureIndex: 0,
        metrics: ['300mm Profile', 'Zero Motion Transfer', '15-Year Mastercraft Warranty']
      },
      {
        id: 1,
        heading: 'Belgian Linen & Gossamer Cashmere Quilt',
        render: 'exploded',
        featureIndex: 4,
        metrics: ['Hand-Tufted Breathable Canopy', 'Natural Thermal Neutrality', '99.2% Airflow']
      },
      {
        id: 2,
        heading: 'Cooling Molecular Open-Cell Memory Foam',
        render: 'exploded',
        featureIndex: 1,
        metrics: ['Adaptive Floating Suspension', '0.0 mmHg Hotspots', 'CertiPUR-US® Certified']
      },
      {
        id: 3,
        heading: '100% Pure Botanical Dunlop Latex',
        render: 'exploded',
        featureIndex: 2,
        metrics: ['Sustainably Harvested Tree Milk', 'Instant 0.06s Lift', 'GOLS Organic Certified']
      },
      {
        id: 4,
        heading: '7-Zone Calico Wrapped Pocket Springs',
        render: 'exploded',
        featureIndex: 0,
        metrics: ['1,420 Independent Coils', '7 Ergonomic Zones', 'Zero Motion Transfer']
      },
      {
        id: 5,
        heading: 'SpineAlign Vertebral Suspension',
        render: 'spine',
        featureIndex: 3,
        metrics: ['Clinical Orthopedic Alignment', 'Zero Vertebral Shear', 'Deep Restorative Sleep']
      }
    ];

    let currentStageIndex = -1;
    let isTicking = false;

    // Feature index to Stage index mapping for direct click navigation
    const FEATURE_TO_STAGE = {
      0: 0, // Orthopedic Support -> Assembled (or 4 Coils)
      1: 2, // Cooling Technology -> Memory Foam
      2: 3, // Natural Latex -> Botanical Latex
      3: 5, // 15-Year Warranty -> SpineAlign / Durability
      4: 1  // Breathable Fabric -> Linen Quilt
    };

    function updateNarrativeDeck(stage) {
      if (!narrativeDeck) return;

      narrativeDeck.style.opacity = '0.35';
      narrativeDeck.style.transform = 'translateY(3px)';

      setTimeout(() => {
        if (anHeading) anHeading.textContent = stage.heading;
        if (anMetrics) anMetrics.textContent = stage.metrics.join('  ·  ');

        narrativeDeck.style.opacity = '1';
        narrativeDeck.style.transform = 'translateY(0)';
      }, 80);
    }

    function applyStage(index) {
      if (index === currentStageIndex) return;
      if (index < 0 || index >= STAGES.length) return;

      currentStageIndex = index;
      const stage = STAGES[index];

      // 1. Cross-fade Mattress Renders
      if (imgAssembled) imgAssembled.classList.toggle('active', stage.render === 'assembled');
      if (imgExploded) imgExploded.classList.toggle('active', stage.render === 'exploded');
      if (imgSpine) imgSpine.classList.toggle('active', stage.render === 'spine');

      // 2. Highlight Matching Top Feature Button
      featureButtons.forEach((btn) => {
        const fIdx = parseInt(btn.getAttribute('data-feature'), 10);
        const isMatch = fIdx === stage.featureIndex;
        btn.classList.toggle('active', isMatch);
        btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
      });

      // 3. Update Editorial Layer Tabs
      layerTabs.forEach((tab) => {
        const sIdx = parseInt(tab.getAttribute('data-step'), 10);
        const isMatch = sIdx === index;
        tab.classList.toggle('active', isMatch);
        tab.setAttribute('aria-selected', isMatch ? 'true' : 'false');
      });

      // 4. Update Narrative Text & Metrics
      updateNarrativeDeck(stage);
    }

    // Smooth Scroll to a given stage (0 to 5)
    function scrollToStage(stageIndex) {
      const rect = heroSection.getBoundingClientRect();
      const heroTop = rect.top + window.pageYOffset;
      const scrollableDist = heroSection.offsetHeight - window.innerHeight;
      if (scrollableDist <= 0) return;

      const stageProgress = (stageIndex + 0.3) / STAGES.length;
      const targetScrollY = heroTop + (stageProgress * scrollableDist);

      window.scrollTo({
        top: targetScrollY,
        behavior: 'smooth'
      });
    }

    // Scroll Handler
    function onScroll() {
      const rect = heroSection.getBoundingClientRect();
      const scrollableDist = heroSection.offsetHeight - window.innerHeight;

      if (scrollableDist <= 0) return;

      const currentScroll = -rect.top;
      const rawProgress = Math.min(1, Math.max(0, currentScroll / scrollableDist));

      // Map progress to stage index (0 to 5)
      const mappedStage = Math.min(
        STAGES.length - 1,
        Math.floor(rawProgress * STAGES.length)
      );

      applyStage(mappedStage);
    }

    function requestTick() {
      if (!isTicking) {
        requestAnimationFrame(() => {
          onScroll();
          isTicking = false;
        });
        isTicking = true;
      }
    }

    window.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('resize', requestTick, { passive: true });

    // Interactive Editorial Layer Tabs Click
    layerTabs.forEach((tab) => {
      tab.addEventListener('click', function (e) {
        e.preventDefault();
        const stepIdx = parseInt(this.getAttribute('data-step'), 10);
        if (!isNaN(stepIdx)) {
          scrollToStage(stepIdx);
        }
      });
    });

    // Top Feature Row Click
    featureButtons.forEach((btn) => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const fIdx = parseInt(this.getAttribute('data-feature'), 10);
        if (fIdx in FEATURE_TO_STAGE) {
          scrollToStage(FEATURE_TO_STAGE[fIdx]);
        }
      });
    });

    // Initialize with Stage 0
    applyStage(0);
    onScroll();
  }

  // =========================================================================
  // 2. INSIDE THE COMFORT CRAFTSMANSHIP DECK
  // =========================================================================
  function initComfortSection() {
    const comfortSection = document.querySelector('#inside-comfort');
    if (!comfortSection) return;

    const layerCards = comfortSection.querySelectorAll('.comfort-layer-card');
    const stageImg = document.querySelector('#comfort-stage-img');
    const badgeText = document.querySelector('#comfort-badge-text');

    const TIER_ASSETS = {
      '1': {
        img: 'assets/material-cashmere-linen.jpg',
        alt: 'Belgian Linen & Organic Cashmere Surface Quilt'
      },
      '2': {
        img: 'assets/material-natural-latex.jpg',
        alt: '100% Pure Natural Botanical Dunlop Latex Matrix'
      },
      '3': {
        img: 'assets/material-pocket-springs.jpg',
        alt: 'Calico Cotton-Wrapped Pocket Springs'
      },
      '4': {
        img: 'assets/sanctuary-layers.jpg',
        alt: 'Handcrafted Organic Botanical Foundation'
      }
    };

    function setActiveTier(tierNum, title) {
      layerCards.forEach((card) => {
        const isMatch = card.getAttribute('data-tier') === String(tierNum);
        card.classList.toggle('active', isMatch);
      });

      if (badgeText && title) {
        badgeText.textContent = title;
      }

      if (stageImg && TIER_ASSETS[tierNum]) {
        const target = TIER_ASSETS[tierNum];
        stageImg.style.opacity = '0.3';
        stageImg.style.transform = 'scale(0.97)';
        setTimeout(() => {
          stageImg.src = target.img;
          stageImg.alt = target.alt;
          stageImg.style.opacity = '1';
          stageImg.style.transform = 'scale(1)';
        }, 160);
      }
    }

    layerCards.forEach((card) => {
      card.addEventListener('click', function () {
        const tierNum = this.getAttribute('data-tier');
        const title = this.getAttribute('data-title');
        setActiveTier(tierNum, title);
      });

      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const tierNum = this.getAttribute('data-tier');
          const title = this.getAttribute('data-title');
          setActiveTier(tierNum, title);
        }
      });
    });
  }

  function initAll() {
    initAtelierScrollRunway();
    initComfortSection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
