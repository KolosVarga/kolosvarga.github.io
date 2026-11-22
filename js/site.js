/* Shared by every room except the pond: magnetic bar, Lenis, headline split, scroll reveals,
   and a helper that only runs a canvas loop while it is on screen. */
export const gsap = window.gsap || null;
export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const root = document.documentElement;
root.classList.add(gsap && !reduceMotion ? 'motion' : 'static');

/* ---------- magnetic bar buttons (React Bits "Magnet", in GSAP), as on the pond ---------- */
if (gsap && finePointer && !reduceMotion) {
  // a gentle lean toward the cursor (kept small so the bar stays calm), settling back without a bounce
  document.querySelectorAll('.bar .link, .bar .mark').forEach(el => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3' });
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * 0.08); yTo((e.clientY - r.top - r.height / 2) * 0.1); });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.35, ease: 'power3.out' }));
  });
}

/* ---------- smooth scroll ---------- */
export let lenis = null;
if (gsap && window.Lenis && !reduceMotion) {
  lenis = new window.Lenis({ lerp: 0.11 });
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -96, duration: 1.3 });
    history.replaceState(null, '', id);
  }));
}

/* ---------- headlines rise letter by letter, like the name on the pond ---------- */
export function splitChars(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text.trim());
  el.textContent = '';
  text.trim().split(/\s+/).forEach((word, i, all) => {
    const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
    for (const c of word) { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; w.appendChild(s); }
    el.appendChild(w);
    if (i < all.length - 1) el.appendChild(document.createTextNode(' '));
  });
  el.classList.add('split');
  return [...el.querySelectorAll('.ch')];
}
document.querySelectorAll('[data-split]').forEach(el => {
  const chars = splitChars(el);
  if (gsap && !reduceMotion) gsap.fromTo(chars, { yPercent: 55, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.035, delay: 0.15 });
});

/* ---------- reveals: things surface as they scroll into view ---------- */
const revealHandlers = new Map(); // element -> callback, for page scripts that want to draw something on entry
export function onReveal(el, fn) { revealHandlers.set(el, fn); }
function reveal(el) {
  el.classList.add('in');
  if (gsap && !reduceMotion) {
    const d = parseFloat(el.dataset.revealDelay || 0);
    gsap.fromTo(el, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: d, clearProps: 'transform' });
  } else el.style.opacity = 1;
  const fn = revealHandlers.get(el); if (fn) fn();
}
// page scripts register their handlers synchronously after importing; start observing on the next tick
setTimeout(() => {
  const els = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) { els.forEach(reveal); return; }
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    io.unobserve(en.target); reveal(en.target);
  }), { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
  els.forEach(el => io.observe(el));
}, 0);

/* ---------- draw an SVG sketch's strokes in (hand-drawn engineering marks) ---------- */
export function drawIn(svg, { duration = 1.4, stagger = 0.08, delay = 0 } = {}) {
  const strokes = [...svg.querySelectorAll('.draw')];
  const labels = [...svg.querySelectorAll('.label')];
  if (!gsap || reduceMotion) return;
  strokes.forEach(p => { const L = p.getTotalLength ? p.getTotalLength() : 400; p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
  gsap.set(labels, { opacity: 0 });
  gsap.to(strokes, { strokeDashoffset: 0, duration, ease: 'power2.inOut', stagger, delay });
  gsap.to(labels, { opacity: 1, duration: 0.6, stagger: 0.12, delay: delay + duration * 0.7 });
}
export function primeDraw(svg) { // hide strokes before they are revealed
  if (!gsap || reduceMotion) return;
  svg.querySelectorAll('.draw').forEach(p => { const L = p.getTotalLength ? p.getTotalLength() : 400; p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
  svg.querySelectorAll('.label').forEach(l => { l.style.opacity = 0; });
}

/* ---------- run a canvas loop only while it is visible and the tab is open ---------- */
export function visibleLoop(el, step, { fps = 60 } = {}) {
  let onScreen = false, raf = 0, last = 0, acc = 0;
  const minDt = 1 / fps;
  const tick = now => {
    raf = 0;
    if (!onScreen || document.hidden) return;
    const t = now / 1000;
    const dt = last ? Math.min(0.05, t - last) : 1 / 60;
    last = t; acc += dt;
    if (acc >= minDt * 0.95) { step(t, acc); acc = 0; }
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!raf && onScreen && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } };
  new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; start(); }).observe(el);
  document.addEventListener('visibilitychange', start);
}
