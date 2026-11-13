/* HOLIDO site behaviour — navigation, hero slider, field-photo marquee, reveal-on-scroll.
   Everything here is progressive enhancement: without JS the page is fully readable,
   the first hero slide shows, and the photo marquee is a swipeable strip. */
(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const mq = (q) => (window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener() {} });
  const reducedMotion = mq('(prefers-reduced-motion: reduce)').matches;
  const canHover = mq('(hover: hover)').matches;
  const onReady = (fn) => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn());

  /* ------------------------------------------------------------------ navigation */
  function initNav() {
    const header = $('.site-header');
    const toggle = $('.menu-toggle');
    const nav = $('.main-nav');
    const dropdowns = $$('.nav-dropdown');

    const setMenu = (open) => {
      if (!toggle || !nav) return;
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      toggle.textContent = open ? '✕' : '☰';
    };
    const closeDropdowns = (except) => dropdowns.forEach((d) => { if (d !== except) d.removeAttribute('open'); });

    if (toggle && nav) toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));

    dropdowns.forEach((d) => d.addEventListener('toggle', () => { if (d.open) closeDropdowns(d); }));

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-dropdown')) closeDropdowns();
      if (nav && nav.classList.contains('open') && !e.target.closest('.main-nav') && !e.target.closest('.menu-toggle')) setMenu(false);
      if (e.target.closest('.main-nav a')) { closeDropdowns(); setMenu(false); }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const openDrop = dropdowns.find((d) => d.open);
      if (openDrop) { openDrop.removeAttribute('open'); const s = $('summary', openDrop); if (s) s.focus(); }
      if (nav && nav.classList.contains('open')) { setMenu(false); if (toggle) toggle.focus(); }
    });

    if (header) {
      let ticking = false;
      const update = () => { header.classList.toggle('is-scrolled', window.scrollY > 8); ticking = false; };
      window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
      update();
    }
  }

  /* ------------------------------------------------------------------ hero slider */
  function initHero() {
    const hero = $('[data-hero]');
    if (!hero) return;
    const slides = $$('.hero-slide', hero);
    if (slides.length < 2) return;
    const dots = $$('.hero-dot', hero);
    const fills = dots.map((d) => $('.hero-dot-fill', d));
    const live = $('.hero-slides', hero);
    const toggle = $('.hero-toggle', hero);
    const prevBtn = $('.hero-prev', hero);
    const nextBtn = $('.hero-next', hero);

    const DURATION = 7000; // ms each slide stays up
    const SWIPE_MIN = 48;  // px

    let index = Math.max(0, slides.findIndex((s) => s.classList.contains('is-active')));
    let elapsed = 0;
    let lastTs = 0;
    let raf = 0;
    const hold = { user: reducedMotion, hover: false, focus: false, hidden: document.hidden, offscreen: false, drag: false };

    const playing = () => !Object.values(hold).some(Boolean);

    function paint(p) {
      const f = fills[index];
      if (f) f.style.transform = 'scaleX(' + Math.min(1, Math.max(0, p)).toFixed(4) + ')';
    }

    function show(next) {
      const n = slides.length;
      next = ((next % n) + n) % n;
      slides[index].classList.remove('is-active');
      dots[index].classList.remove('is-active');
      dots[index].removeAttribute('aria-current');
      index = next;
      slides[index].classList.add('is-active');
      dots[index].classList.add('is-active');
      dots[index].setAttribute('aria-current', 'true');
      dots.forEach((d, i) => {
        d.classList.toggle('is-done', i < index);
        if (i !== index) fills[i].style.transform = '';
      });
      elapsed = 0;
      paint(0);
    }

    function frame(ts) {
      raf = 0;
      if (!playing()) { lastTs = 0; return; }
      if (!lastTs) lastTs = ts;
      elapsed += Math.min(ts - lastTs, 100); // clamp so a stalled tab never skips ahead
      lastTs = ts;
      if (elapsed >= DURATION) show(index + 1); else paint(elapsed / DURATION);
      raf = requestAnimationFrame(frame);
    }

    function sync() {
      const run = playing();
      if (live) live.setAttribute('aria-live', run ? 'off' : 'polite');
      if (run && !raf) { lastTs = 0; raf = requestAnimationFrame(frame); }
      if (!run && raf) { cancelAnimationFrame(raf); raf = 0; lastTs = 0; }
      if (toggle) {
        toggle.classList.toggle('is-paused', hold.user);
        toggle.setAttribute('aria-label', hold.user ? 'Play slideshow' : 'Pause slideshow');
      }
    }

    const go = (i) => { show(i); sync(); };

    // initial state
    dots.forEach((d, i) => d.classList.toggle('is-done', i < index));
    paint(0);

    if (prevBtn) prevBtn.addEventListener('click', () => go(index - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => go(index + 1));
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    if (toggle) toggle.addEventListener('click', () => { hold.user = !hold.user; sync(); });

    // pause while the visitor is interacting
    if (canHover) {
      hero.addEventListener('mouseenter', () => { hold.hover = true; sync(); });
      hero.addEventListener('mouseleave', () => { hold.hover = false; sync(); });
    }
    hero.addEventListener('focusin', (e) => { if (e.target.matches && e.target.matches(':focus-visible')) { hold.focus = true; sync(); } });
    hero.addEventListener('focusout', (e) => { if (!hero.contains(e.relatedTarget)) { hold.focus = false; sync(); } });
    document.addEventListener('visibilitychange', () => { hold.hidden = document.hidden; sync(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { hold.offscreen = !entries[entries.length - 1].isIntersecting; sync(); }, { threshold: 0.3 }).observe(hero);
    }

    // keyboard: ← / → while focus is inside the hero
    hero.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    });

    // swipe / drag (touch-action: pan-y keeps vertical scrolling native)
    let sx = 0, sy = 0, tracking = false, swiped = false;
    hero.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.hero-controls')) return;
      tracking = true; swiped = false; sx = e.clientX; sy = e.clientY; hold.drag = true; sync();
    });
    const end = (e) => {
      if (!tracking) return;
      tracking = false; hold.drag = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (e.type === 'pointerup' && Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.3) {
        swiped = true;
        show(index + (dx < 0 ? 1 : -1));
      }
      sync();
    };
    hero.addEventListener('pointerup', end);
    hero.addEventListener('pointercancel', end);
    // a swipe that began on a link must not also follow the link
    hero.addEventListener('click', (e) => { if (swiped) { e.preventDefault(); e.stopPropagation(); swiped = false; } }, true);

    sync();
  }

  /* ------------------------------------------------------------------ photo marquee */
  function initMarquee() {
    const root = $('[data-marquee]');
    if (!root) return;
    const section = root.closest('.field-marquee') || document;
    const toggle = $('.marquee-toggle', section);
    const set = $('.marquee-set', root);
    if (!set) return;

    // Reduced motion: keep the manual, swipeable strip and drop the pause button.
    if (reducedMotion) { if (toggle) toggle.hidden = true; return; }

    const SPEED = 44; // px per second, identical on every screen size
    const track = document.createElement('div');
    track.className = 'marquee-track';
    root.insertBefore(track, set);
    track.appendChild(set);

    let clones = [];
    let lastKey = '';

    function build() {
      const setW = set.getBoundingClientRect().width;
      const viewW = root.clientWidth;
      if (!setW || !viewW) return;
      // enough copies that the track is always wider than viewport + one set → never a gap
      const copies = Math.ceil(viewW / setW) + 1;
      const key = Math.round(setW) + ':' + copies;
      if (key === lastKey) return;
      lastKey = key;

      clones.forEach((c) => c.remove());
      clones = [];
      for (let i = 1; i < copies; i++) {
        const c = set.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        $$('img', c).forEach((im) => { im.alt = ''; });
        track.appendChild(c);
        clones.push(c);
      }
      root.style.setProperty('--dist', setW + 'px');
      root.style.setProperty('--dur', (setW / SPEED).toFixed(2) + 's');
      root.classList.add('is-running');
    }

    build();
    window.addEventListener('load', build);
    let t = 0;
    const resize = () => { clearTimeout(t); t = setTimeout(build, 120); };
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(root); else window.addEventListener('resize', resize);

    if (toggle) {
      const label = $('.marquee-toggle-text', toggle);
      toggle.addEventListener('click', () => {
        const paused = root.classList.toggle('is-paused');
        toggle.classList.toggle('is-paused', paused);
        toggle.setAttribute('aria-label', paused ? 'Play photo scroll' : 'Pause photo scroll');
        if (label) label.textContent = paused ? 'Play' : 'Pause';
      });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        root.classList.toggle('is-offscreen', !entries[entries.length - 1].isIntersecting);
      }).observe(root);
    }
  }

  /* ------------------------------------------------------------------ reveal on scroll */
  function initReveal() {
    if (reducedMotion || !('IntersectionObserver' in window)) return;
    const vh = window.innerHeight || 800;
    const groups = new Map();
    $$('.program-card, .story-card, .person-card, .involve-card, .value-card, .project-row, .vision-card, .milestone-grid > div').forEach((el) => {
      if (el.getBoundingClientRect().top < vh * 0.92) return; // already in view: never hide it
      const parent = el.parentElement;
      const n = groups.get(parent) || 0;
      groups.set(parent, n + 1);
      el.style.setProperty('--d', Math.min(n, 5) * 0.08 + 's');
      el.classList.add('reveal');
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        io.unobserve(el);
        el.classList.add('is-in');
        // hand the element back to its normal hover transitions
        setTimeout(() => { el.classList.remove('reveal', 'is-in'); el.style.removeProperty('--d'); }, 1100);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    $$('.reveal').forEach((el) => io.observe(el));
  }

  onReady(() => { initNav(); initHero(); initMarquee(); initReveal(); });
})();
