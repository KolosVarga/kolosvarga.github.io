/* Scroll choreography with GSAP ScrollTrigger + Lenis smooth scrolling.
   Text and button micro-interactions are rebuilt from React Bits ideas (SplitText, Magnet) in plain GSAP. */
import { start, reduceMotion, isTouch } from './core.js';
import { createBar } from './bar.js';
import { createGears, createPcb } from './panels.js';
import { createStroke } from './stroke.js';
import { createForest } from './forest.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);
const $ = id => document.getElementById(id);
$('year').textContent = new Date().getFullYear();

/* ---------- Lenis smooth scroll, synced to GSAP's ticker ---------- */
let lenis = null;
if (!reduceMotion && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollToTarget = target => {
  if (lenis) lenis.scrollTo(target, { duration: 1.6, offset: target === 0 ? 0 : -8 });
  else if (target === 0) window.scrollTo({ top: 0, behavior: 'smooth' });
  else target.scrollIntoView({ behavior: 'smooth' });
};
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href');
  const el = id === '#top' ? 0 : document.querySelector(id);
  if (el === null) return;
  e.preventDefault();
  scrollToTarget(el);
}));

/* ---------- nav ---------- */
const nav = $('nav'), toggle = $('nav-toggle'), links = $('nav-links');
toggle.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.textContent = open ? 'Close' : 'Menu';
});
links.addEventListener('click', e => {
  if (!e.target.closest('a')) return;
  links.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = 'Menu';
});

/* ---------- SplitText-style reveals ---------- */
function split(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label', words.join(' '));
  el.textContent = '';
  words.forEach((w, i) => {
    const ws = document.createElement('span'); ws.className = 'word'; ws.setAttribute('aria-hidden', 'true');
    for (const ch of w) { const c = document.createElement('span'); c.className = 'ch'; c.textContent = ch; ws.appendChild(c); }
    el.appendChild(ws);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return el.querySelectorAll('.ch');
}
document.querySelectorAll('.split').forEach((el, i) => {
  const chars = split(el);
  const intro = el.closest('#intro-copy');
  gsap.from(chars, {
    yPercent: 110, opacity: 0, rotate: 8, duration: 0.9, stagger: 0.035, ease: 'back.out(1.7)',
    delay: intro ? 0.4 : 0,
    scrollTrigger: intro ? undefined : { trigger: el, start: 'top 88%' }
  });
});

/* ---------- Magnet buttons ---------- */
if (!isTouch && !reduceMotion) {
  document.querySelectorAll('.magnet, .nav-resume, .p-now-links a, .o-block .links a').forEach(el => {
    el.style.display = el.style.display || 'inline-block';
    const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.3);
      yTo((e.clientY - r.top - r.height / 2) * 0.4);
    });
    el.addEventListener('pointerleave', () => { gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' }); });
  });
}

/* ---------- build scenes (wait for fonts: some textures paint text) ---------- */
await Promise.race([
  Promise.all([document.fonts.load('italic 600 100px Fraunces'), document.fonts.load('600 36px Fraunces'), document.fonts.ready]),
  new Promise(r => setTimeout(r, 2500))
]);

const mp1 = $('mp1'), slot = $('slot-bar'), barHost = $('bar-host'), border = $('bar-border');
const bar = createBar(barHost);
const gears = createGears($('gears-host'));
const pcb = createPcb($('pcb-host'));
const stroke = createStroke($('stroke-host'));
createForest($('forest-host'), $('projects'));

/* ================= the manga sequence ================= */
const proxy = { ink: 0, k: 0 };
function applyFrame() {
  const W = mp1.clientWidth, H = mp1.clientHeight;
  const L = slot.offsetLeft, T = slot.offsetTop, SW = slot.offsetWidth, SH = slot.offsetHeight, k = proxy.k;
  const t = T * k, l = L * k, r = (W - L - SW) * k, b = (H - T - SH) * k;
  barHost.style.clipPath = `inset(${t}px ${r}px ${b}px ${l}px)`;
  Object.assign(border.style, { top: `${t}px`, left: `${l}px`, right: `${r}px`, bottom: `${b}px`, opacity: gsap.utils.clamp(0, 1, (k - 0.4) / 0.5) });
  bar.setFrame(k, L + SW / 2, T + SH / 2);
  bar.setInk(proxy.ink);
}
function activate(t) {
  bar.active = t < 4.45;
  gears.active = t > 3.1 && t < 6.85;
  pcb.active = t > 5.5;
  mp1.style.pointerEvents = t > 3.8 ? 'none' : '';
  $('mp2').style.pointerEvents = t > 6.2 ? 'none' : '';
}
const slamIn = (sel, at) => tl
  .fromTo(sel, { scale: 1.45, opacity: 0, rotation: () => gsap.utils.random(-7, 7) }, { scale: 1, opacity: 1, rotation: 0, duration: 0.32, stagger: 0.16, ease: 'back.out(2.2)' }, at)
  .to(`${sel.split(' ')[0]} .burst`, { opacity: 0.85, duration: 0.1 }, at)
  .to(`${sel.split(' ')[0]} .burst`, { opacity: 0, duration: 0.35 }, at + 0.12);

const tl = gsap.timeline({
  defaults: { ease: 'none' },
  onUpdate: () => { applyFrame(); activate(tl.time()); },
  scrollTrigger: { trigger: '#story', start: 'top top', end: 'bottom bottom', scrub: 0.7 }
});
tl.to({}, { duration: 0.4 })
  .to('#intro-copy', { opacity: 0, y: -30, duration: 0.5 }, 0.35)
  .to('#scroll-cue', { opacity: 0, duration: 0.25 }, 0.2)
  // the painted club inks into a manga panel while it shrinks into place
  .to(proxy, { ink: 1, duration: 1.3, ease: 'power1.inOut' }, 0.5)
  .to(proxy, { k: 1, duration: 1.4, ease: 'power2.inOut' }, 0.8);
slamIn('#mp1 .slam', 2.0);
// page one turns over
tl.to(mp1, { rotationY: -180, duration: 1.2, ease: 'power2.inOut' }, 3.2)
  .to('#mp1 .shade', { opacity: 1, duration: 0.6 }, 3.2)
  .fromTo('#mp2 .shade', { opacity: 0.7 }, { opacity: 0, duration: 1.2 }, 3.2);
slamIn('#mp2 .slam', 3.9);
// page two turns over
tl.to('#mp2', { rotationY: -180, duration: 1.2, ease: 'power2.inOut' }, 5.6)
  .to('#mp2 .shade', { opacity: 1, duration: 0.6 }, 5.6);
slamIn('#mp3 .slam', 6.3);
tl.to({}, { duration: 0.9 }, 7.2);
applyFrame(); activate(0);

/* ================= the stroke + wash ================= */
const strokeSection = $('stroke');
ScrollTrigger.create({ trigger: strokeSection, start: 'top top', end: 'bottom bottom', onUpdate: self => stroke.setProgress(self.progress) });
gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: strokeSection, start: 'top top', end: 'bottom bottom', scrub: 0.5 } })
  .fromTo('#stroke-line', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.12 }, 0.2)
  .to('#stroke-line', { opacity: 0, duration: 0.08 }, 0.6)
  .fromTo('.f1', { scale: 0 }, { scale: 1.15, duration: 0.26, ease: 'power2.in' }, 0.6)
  .fromTo('.f2', { scale: 0 }, { scale: 1.15, duration: 0.26, ease: 'power2.in' }, 0.67)
  .fromTo('.f3', { scale: 0 }, { scale: 1.15, duration: 0.25, ease: 'power2.in' }, 0.74)
  .to({}, { duration: 0.01 }, 0.99);

/* ================= Oregon ================= */
ScrollTrigger.create({ trigger: '#projects', start: 'top 60px', end: 'bottom top', onToggle: self => nav.classList.toggle('light', self.isActive) });
gsap.utils.toArray('.o-block').forEach(el => {
  gsap.from(el, { y: 70, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
});

ScrollTrigger.refresh();
start();
