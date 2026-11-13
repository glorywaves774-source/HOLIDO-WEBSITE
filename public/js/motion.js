/* HOLIDO v1.9 motion layer. Optional: the site is complete without it, and nothing here runs
   when the visitor has asked their device for reduced motion. */
(() => {
  if (!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const header = document.querySelector('.site-header');
  const nav = document.querySelector('.main-nav');

  /* Headlines: split at each <br> into lines that rise out of a mask. */
  document.querySelectorAll('.hero h1, .page-hero h1').forEach(h => {
    if (h.classList.contains('split')) return;
    const label = h.textContent.replace(/\s+/g, ' ').trim();
    const lines = h.innerHTML.split(/<br\s*\/?>/i);
    h.setAttribute('aria-label', label);
    h.innerHTML = lines.map((l, i) => '<span class="ln" aria-hidden="true"><span class="ln-i" style="--i:' + i + '">' + l.trim() + '</span></span>').join('');
    h.classList.add('split');
  });

  /* Scroll progress bar + header that tucks away while reading downward. */
  const bar = document.createElement('div');
  bar.className = 'mo-progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  let lastY = scrollY, ticking = false;
  const frame = () => {
    ticking = false;
    const y = scrollY, d = y - lastY, max = root.scrollHeight - innerHeight;
    bar.style.setProperty('--p', max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
    if (header) {
      header.classList.toggle('is-stuck', y > 8);
      const busy = (nav && nav.classList.contains('open')) || header.querySelector('details[open]') || header.matches(':focus-within');
      if (y > 320 && d > 5 && !busy) header.classList.add('is-hidden');
      else if (d < -5 || y <= 320 || busy) header.classList.remove('is-hidden');
    }
    if (Math.abs(d) > 0) lastY = y;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
  if (header) header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  frame();

  /* Photographs unveil as they arrive (only those below the fold, so nothing flashes on load). */
  if ('IntersectionObserver' in window) {
    root.classList.add('mo');
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target); e.target.classList.add('in');
      setTimeout(() => e.target.classList.remove('unveil', 'in'), 1900); // hand back normal hover behaviour and shadows
    }), { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.intro-image img, .detail-figure img, .profile-photo, .gallery-masonry img').forEach(img => {
      if (img.getBoundingClientRect().top < innerHeight * 0.92) return;
      img.classList.add('unveil'); io.observe(img);
    });
  }

  if (fine) {
    /* Magnetic buttons: lean a few pixels toward the pointer. */
    document.querySelectorAll('.btn, .nav-cta').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.classList.add('is-magnet');
        el.style.setProperty('--tx', (dx * 12).toFixed(1) + 'px'); el.style.setProperty('--ty', (dy * 9).toFixed(1) + 'px');
      });
      el.addEventListener('pointerleave', () => {
        el.classList.remove('is-magnet'); el.style.removeProperty('--tx'); el.style.removeProperty('--ty');
      });
    });

    /* Light follows the pointer across the red bands. */
    document.querySelectorAll('.impact-band-inner, .join-cta .container, .page-hero').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--bx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
        el.style.setProperty('--by', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--bx', 0); el.style.setProperty('--by', 0); });
    });
  }

  /* Field marquee: scrolling the page speeds the strip up briefly, then it eases back to its own pace. */
  const track = document.querySelector('.marquee-track');
  if (track && track.getAnimations) {
    let rate = 1, boost = 0, py = scrollY, running = false;
    const step = () => {
      const anim = track.getAnimations()[0];
      boost *= 0.94; rate += ((1 + boost) - rate) * 0.12;
      if (anim) anim.playbackRate = rate;
      if (boost > 0.02 || rate > 1.01) requestAnimationFrame(step);
      else { if (anim) anim.playbackRate = 1; running = false; }
    };
    addEventListener('scroll', () => {
      const dy = Math.abs(scrollY - py); py = scrollY;
      boost = Math.min(5, Math.max(boost, dy / 6));
      if (!running) { running = true; requestAnimationFrame(step); }
    }, { passive: true });
  }
})();
