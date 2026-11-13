(() => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
})();

/* v1.7 spatial interface: scroll reveal, parallax depth, pointer tilt. All optional; the site works without it. */
(() => {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  // Scroll reveal
  if (!reduce && 'IntersectionObserver' in window) {
    const sel = '.section-heading,.program-card,.story-card,.project-row,.person-card,.involve-card,.value-card,.milestone-grid>div,.mission-grid>div,.partner-list span,.intro-grid>*,.partners-inner>*,.contact-details,.contact-form,.detail-layout,.note-panel,.impact-band-inner,.join-cta .container,.field-marquee-head,.roster-tile,.profile';
    const els = [...document.querySelectorAll(sel)].filter(el => el.getBoundingClientRect().top > innerHeight * 0.92);
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target; io.unobserve(el); el.classList.add('in');
      setTimeout(() => el.classList.remove('reveal', 'in'), 1500); // hand control back to hover/tilt transitions
    }), { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    els.forEach(el => {
      const sibs = el.parentElement ? [...el.parentElement.children].filter(c => c.matches(sel)) : [];
      el.style.setProperty('--d', Math.min(sibs.indexOf(el), 5) * 0.07 + 's');
      el.classList.add('reveal'); io.observe(el);
    });
  }

  // Parallax depth (hero photo, page-hero glows)
  if (!reduce) {
    let ticking = false;
    const update = () => { root.style.setProperty('--sy', Math.min(scrollY, 900)); ticking = false; };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // Pointer tilt + light sheen on cards (mouse / pen only)
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.program-card,.story-card,.project-row,.person-card,.involve-card,.vision-card').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        el.style.transform = `perspective(1100px) rotateX(${((0.5 - y) * 4).toFixed(2)}deg) rotateY(${((x - 0.5) * 5).toFixed(2)}deg) translateY(-6px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }
})();

/* Admin: character counter + picture focal-point picker with live crop previews. */
(() => {
  document.querySelectorAll('textarea[data-count]').forEach(t => {
    const out = document.querySelector('[data-count-for="' + t.name + '"]'); if (!out) return;
    const upd = () => { out.textContent = t.value.length.toLocaleString('en-GB') + ' / ' + Number(t.maxLength).toLocaleString('en-GB') + ' characters'; };
    t.addEventListener('input', upd); upd();
  });

  const box = document.querySelector('[data-focus-picker]'); if (!box) return;
  const file = box.querySelector('[data-file]'), url = box.querySelector('[data-url]'), wrap = box.querySelector('[data-focus-wrap]');
  const stage = box.querySelector('[data-stage]'), stageImg = box.querySelector('[data-stage-img]'), dot = box.querySelector('[data-dot]');
  const prevs = box.querySelectorAll('[data-prev]'), pos = box.querySelector('[data-pos]');
  let blobUrl = null;
  const parse = () => { const m = /^(\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%$/.exec(pos.value); return m ? [+m[1], +m[2]] : [50, 50]; };
  const apply = () => {
    const [x, y] = parse(), p = x + '% ' + y + '%';
    dot.style.left = x + '%'; dot.style.top = y + '%';
    prevs.forEach(i => { i.style.objectPosition = p; });
  };
  const setSrc = src => {
    if (!src) { wrap.hidden = true; return; }
    stageImg.src = src; prevs.forEach(i => { i.src = src; }); wrap.hidden = false; apply();
  };
  const pick = e => {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)), y = Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100));
    pos.value = Math.round(x) + '% ' + Math.round(y) + '%'; apply();
  };
  let drag = false;
  stage.addEventListener('pointerdown', e => { drag = true; stage.setPointerCapture(e.pointerId); pick(e); });
  stage.addEventListener('pointermove', e => { if (drag) pick(e); });
  stage.addEventListener('pointerup', () => { drag = false; });
  file.addEventListener('change', () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    if (file.files && file.files[0]) { blobUrl = URL.createObjectURL(file.files[0]); pos.value = ''; setSrc(blobUrl); }
    else setSrc(url.value.trim());
  });
  url.addEventListener('change', () => { if (!(file.files && file.files[0])) setSrc(url.value.trim()); });
  setSrc(url.value.trim());
})();

/* v1.8 hero slideshow: autoplay with pause/play, prev/next, dots, swipe, arrow keys.
   Only the first photo is in the page markup; the others are fetched shortly after the page has loaded. */
(() => {
  const hero = document.querySelector('[data-hero]'); if (!hero) return;
  const slides = [...hero.querySelectorAll('.hero-slide')];
  const dots = [...hero.querySelectorAll('[data-hero-dot]')];
  const caption = hero.querySelector('[data-hero-caption]');
  const live = hero.querySelector('[data-hero-slides]');
  const toggle = hero.querySelector('[data-hero-toggle]');
  if (slides.length < 2) { const c = hero.querySelector('.hero-controls'); if (c) c.hidden = true; return; }
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DELAY = 6500;
  let index = 0, timer = null, userPaused = reduce, hovering = false, focusing = false, offscreen = false, hidden = document.hidden;

  const load = i => {
    const s = slides[(i + slides.length) % slides.length];
    s.querySelectorAll('img[data-src]').forEach(img => {
      if (img.dataset.srcset) { img.srcset = img.dataset.srcset; img.removeAttribute('data-srcset'); }
      img.src = img.dataset.src; img.removeAttribute('data-src');
    });
  };
  const show = (n, byUser) => {
    const next = (n + slides.length) % slides.length;
    if (next === index) return;
    load(next); load(next + 1);
    slides[index].classList.remove('is-active'); slides[index].setAttribute('aria-hidden', 'true');
    dots[index].classList.remove('is-active'); dots[index].removeAttribute('aria-current');
    index = next;
    slides[index].classList.add('is-active'); slides[index].removeAttribute('aria-hidden');
    dots[index].classList.add('is-active'); dots[index].setAttribute('aria-current', 'true');
    if (caption) caption.textContent = slides[index].dataset.caption || '';
    if (byUser) restart();
  };
  const running = () => !userPaused && !hovering && !focusing && !offscreen && !hidden;
  const stop = () => { clearTimeout(timer); timer = null; };
  const restart = () => { stop(); if (running()) timer = setTimeout(() => { show(index + 1); restart(); }, DELAY); };
  const sync = () => {
    live.setAttribute('aria-live', running() ? 'off' : 'polite');
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(userPaused));
      toggle.setAttribute('aria-label', userPaused ? 'Play slideshow' : 'Pause slideshow');
    }
    restart();
  };

  hero.querySelector('[data-hero-prev]').addEventListener('click', () => show(index - 1, true));
  hero.querySelector('[data-hero-next]').addEventListener('click', () => show(index + 1, true));
  dots.forEach((d, i) => d.addEventListener('click', () => show(i, true)));
  if (toggle) toggle.addEventListener('click', () => { userPaused = !userPaused; sync(); });

  hero.addEventListener('mouseenter', () => { hovering = true; sync(); });
  hero.addEventListener('mouseleave', () => { hovering = false; sync(); });
  hero.addEventListener('focusin', () => { focusing = true; sync(); });
  hero.addEventListener('focusout', e => { if (!hero.contains(e.relatedTarget)) { focusing = false; sync(); } });
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; sync(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { offscreen = !es[0].isIntersecting; sync(); }, { threshold: 0.25 }).observe(hero);

  hero.addEventListener('keydown', e => {
    if (e.target.closest && !e.target.closest('.hero-controls')) return;
    if (e.key === 'ArrowLeft') { show(index - 1, true); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { show(index + 1, true); e.preventDefault(); }
  });

  // Swipe on touch screens (horizontal movement only, so vertical scrolling is unaffected)
  let x0 = null, y0 = 0;
  hero.addEventListener('touchstart', e => { const t = e.changedTouches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
  hero.addEventListener('touchend', e => {
    if (x0 === null) return; const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) show(index + (dx < 0 ? 1 : -1), true);
  }, { passive: true });

  const warm = () => { load(1); setTimeout(() => slides.forEach((_, i) => load(i)), 2500); };
  if (document.readyState === 'complete') warm(); else addEventListener('load', warm, { once: true });
  sync();
})();
