/* ============================================================
   KickrIQ. Scroll motion engine
   - IntersectionObserver: data-reveal → .is-in
   - Stagger via [data-stagger] children get auto --i
   - Hero parallax: --hero-y on .hero
   - Count-up: data-count="2500" data-suffix="+"
   - Section eyebrow numbering: data-section-num
   - Headline words: data-words on a heading
   - Scroll progress: .kx-progress (auto-injected)
   ============================================================ */
(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. Boot when DOM ready (and re-run on React mount) ---------- */
  function boot() {
    setupReveals();
    setupStagger();
    setupWordHeadlines();
    setupCountUps();
    setupSectionEyebrows();
    setupProgressBar();
    setupHeroParallax();
  }

  // Run now + after a short delay to catch React-rendered DOM
  function safeBoot() {
    boot();
    setTimeout(boot, 60);
    setTimeout(boot, 300);
    setTimeout(boot, 900);

    // Safety nets: catch above-the-fold content the IO may have missed,
    // and as a last resort, reveal anything within scroll-distance.
    setTimeout(forceRevealVisible, 200);
    setTimeout(forceRevealVisible, 800);

    // Also force-reveal on any scroll event (handles cases where IO is broken)
    let scrollSafety = 0;
    const onScrollSafety = () => {
      if (scrollSafety) return;
      scrollSafety = requestAnimationFrame(() => {
        scrollSafety = 0;
        forceRevealVisible();
      });
    };
    window.addEventListener('scroll', onScrollSafety, { passive: true });

    // Final hard fallback after 2s. IO clearly isn't firing. Reveal all
    // already-visible-or-near content so nothing stays invisible.
    setTimeout(() => {
      const stillHidden = document.querySelectorAll('[data-reveal]:not(.is-in)').length;
      if (stillHidden > 0) {
        // Reveal everything in the document. animations are nice-to-have,
        // but content visibility is a hard requirement.
        document.querySelectorAll('[data-reveal], .kx-rule, .kx-words').forEach((el) => {
          el.classList.add('is-in');
        });
      }
    }, 2000);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeBoot);
  } else {
    safeBoot();
  }

  /* ---------- 2. Reveal observer (single shared instance) ---------- */
  let revealObserver = null;
  function getRevealObserver() {
    if (revealObserver) return revealObserver;
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    return revealObserver;
  }

  // Manually check: is this element actually visible in the viewport right now?
  function inViewport(el, slack = 0) {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth  || document.documentElement.clientWidth;
    return (
      r.bottom >= -slack &&
      r.right  >= -slack &&
      r.top    <= vh + slack &&
      r.left   <= vw + slack &&
      r.width > 0 && r.height > 0
    );
  }

  // Safety: if the observer never fires for some reason (preview iframes
  // sometimes have flaky IO), force-reveal any element above the fold.
  function forceRevealVisible() {
    document.querySelectorAll('[data-reveal]:not(.is-in), .kx-rule:not(.is-in), .kx-words:not(.is-in)').forEach((el) => {
      if (inViewport(el, 200)) el.classList.add('is-in');
    });
  }

  // Last-ditch fallback: after 1.8s, reveal EVERYTHING regardless. Better
  // to lose the animation than to leave content invisible.
  function forceRevealAll() {
    document.querySelectorAll('[data-reveal]:not(.is-in), .kx-rule:not(.is-in), .kx-words:not(.is-in)').forEach((el) => {
      if (inViewport(el, window.innerHeight)) el.classList.add('is-in');
    });
  }

  function setupReveals() {
    const obs = getRevealObserver();
    document.querySelectorAll('[data-reveal]:not([data-reveal-bound])').forEach((el) => {
      el.setAttribute('data-reveal-bound', '1');
      if (reduce) { el.classList.add('is-in'); return; }
      obs.observe(el);
    });
    // Also bind .kx-rule and .kx-words
    document.querySelectorAll('.kx-rule:not([data-reveal-bound]), .kx-words:not([data-reveal-bound])').forEach((el) => {
      el.setAttribute('data-reveal-bound', '1');
      if (reduce) { el.classList.add('is-in'); return; }
      obs.observe(el);
    });
  }

  /* ---------- 3. Auto-stagger children of [data-stagger] ---------- */
  function setupStagger() {
    document.querySelectorAll('[data-stagger]:not([data-stagger-bound])').forEach((wrap) => {
      wrap.setAttribute('data-stagger-bound', '1');
      const kids = Array.from(wrap.children);
      kids.forEach((kid, i) => {
        if (!kid.hasAttribute('data-reveal')) kid.setAttribute('data-reveal', wrap.dataset.stagger || 'up');
        kid.style.setProperty('--i', i);
      });
      // Re-bind reveals so the new children get observed
      setupReveals();
    });
  }

  /* ---------- 4. Word-by-word headline reveal ---------- */
  function setupWordHeadlines() {
    document.querySelectorAll('[data-words]:not([data-words-bound])').forEach((el) => {
      el.setAttribute('data-words-bound', '1');
      // Walk text nodes only; preserve nested span styling for accent etc.
      wrapWords(el);
      el.classList.add('kx-words');
      getRevealObserver().observe(el);
    });
  }

  function wrapWords(root) {
    let wordIdx = 0;
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentNode;
        const parts = node.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((p) => {
          if (p.trim() === '') {
            frag.appendChild(document.createTextNode(p));
          } else {
            const wrap = document.createElement('span');
            wrap.className = 'kx-word';
            const inner = document.createElement('span');
            inner.style.setProperty('--wi', wordIdx++);
            inner.textContent = p;
            wrap.appendChild(inner);
            frag.appendChild(wrap);
          }
        });
        parent.replaceChild(frag, node);
      } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('kx-word')) {
        Array.from(node.childNodes).forEach(walk);
      }
    };
    Array.from(root.childNodes).forEach(walk);
  }

  /* ---------- 5. Stat count-ups ---------- */
  function setupCountUps() {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        runCount(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.4 });

    document.querySelectorAll('[data-count]:not([data-count-bound])').forEach((el) => {
      el.setAttribute('data-count-bound', '1');
      // Cache target value, blank the display
      const target = parseFloat(el.getAttribute('data-count'));
      el.dataset.countTarget = String(target);
      if (!reduce) el.textContent = '0';
      obs.observe(el);
    });
  }

  function runCount(el) {
    if (reduce) {
      el.textContent = formatNum(parseFloat(el.dataset.countTarget), el);
      return;
    }
    const target = parseFloat(el.dataset.countTarget);
    const dur = parseInt(el.dataset.countDur || '1400', 10);
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = target * eased;
      el.textContent = formatNum(v, el);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = formatNum(target, el);
    };
    requestAnimationFrame(tick);
  }

  function formatNum(n, el) {
    const decimals = parseInt(el.dataset.countDecimals || '0', 10);
    const fixed = n.toFixed(decimals);
    // Add thousands separators if target was >= 1000
    const target = parseFloat(el.dataset.countTarget);
    if (target >= 1000) {
      const [whole, dec] = fixed.split('.');
      const w = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return dec ? `${w}.${dec}` : w;
    }
    return fixed;
  }

  /* ---------- 6. Section number eyebrow auto-stamping ---------- */
  function setupSectionEyebrows() {
    document.querySelectorAll('[data-section-num]:not([data-section-num-bound])').forEach((el, i) => {
      el.setAttribute('data-section-num-bound', '1');
    });
  }

  /* ---------- 7. Scroll progress bar ---------- */
  function setupProgressBar() {
    if (document.querySelector('.kx-progress')) return;
    const bar = document.createElement('div');
    bar.className = 'kx-progress';
    document.body.appendChild(bar);

    const update = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const p = max > 0 ? (h.scrollTop / max) * 100 : 0;
      bar.style.setProperty('--p', p + '%');
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ---------- 8. Hero parallax ---------- */
  function setupHeroParallax() {
    if (reduce) return;
    const hero = document.querySelector('.hero');
    if (!hero || hero.dataset.parallaxBound) return;
    hero.dataset.parallaxBound = '1';

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = hero.getBoundingClientRect();
      // y goes from 0 (hero top at viewport top) to negative as we scroll
      const scrolled = -rect.top;
      const visible = Math.max(0, Math.min(rect.height, window.innerHeight + scrolled));
      const t = Math.min(1, Math.max(0, scrolled / rect.height));
      // Push video down by up to 80px as we scroll (for that "drift" feel)
      const yPx = t * 80;
      hero.style.setProperty('--hero-y', yPx + 'px');
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
  }

  // Expose for manual re-binding after DOM mutations
  window.__kickrMotionRefresh = boot;
})();
