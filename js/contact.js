/* Contact: copy the address, and a few paper scraps floating on a patch of water.
   The scraps drift on a slow current, keep out of each other's way, shy from the cursor,
   and can be picked up and tossed; water drag slows them back down. */
import { visibleLoop, reduceMotion, finePointer, rand, clamp } from './site.js';

/* ---------- copy ---------- */
const copy = document.querySelector('.copy'), status = document.querySelector('.copied');
copy?.addEventListener('click', async () => {
  const text = copy.dataset.copy;
  try { await navigator.clipboard.writeText(text); }
  catch { const r = document.createRange(); r.selectNodeContents(document.querySelector('.addr')); getSelection().removeAllRanges(); getSelection().addRange(r); }
  copy.classList.add('done'); copy.firstElementChild.textContent = 'Copied';
  status.textContent = 'Address copied to the clipboard';
  setTimeout(() => { copy.classList.remove('done'); copy.firstElementChild.textContent = 'Copy address'; status.textContent = ''; }, 2200);
});

/* ---------- scraps ---------- */
const desk = document.getElementById('desk');
const els = [...desk.querySelectorAll('.scrap')];
let W = 0, H = 0;
const torn = () => { // a slightly ragged paper outline
  const pts = [], n = 6, j = () => rand(0, 4).toFixed(1);
  for (let i = 0; i <= n; i++) pts.push(`${(i / n * 100).toFixed(1)}% ${j()}px`);
  for (let i = 1; i <= n; i++) pts.push(`calc(100% - ${j()}px) ${(i / n * 100).toFixed(1)}%`);
  for (let i = n - 1; i >= 0; i--) pts.push(`${(i / n * 100).toFixed(1)}% calc(100% - ${j()}px)`);
  for (let i = n - 1; i > 0; i--) pts.push(`${j()}px ${(i / n * 100).toFixed(1)}%`);
  return `polygon(${pts.join(',')})`;
};
const scraps = els.map((el, i) => {
  el.style.clipPath = torn();
  return { el, x: 0, y: 0, vx: 0, vy: 0, r: rand(-12, 12), vr: 0, w: 0, h: 0, seed: rand(0, 100), held: false };
});
function measure() {
  const r = desk.getBoundingClientRect(); const first = !W;
  W = r.width; H = r.height;
  scraps.forEach((s, i) => {
    s.w = s.el.offsetWidth; s.h = s.el.offsetHeight;
    if (first) { // scatter on a loose grid so they start apart
      const cols = 2, cx = (i % cols + 0.5) / cols, cy = (Math.floor(i / cols) + 0.5) / Math.ceil(scraps.length / cols);
      s.x = clamp(cx * W - s.w / 2 + rand(-30, 30), 8, W - s.w - 8); s.y = clamp(cy * H - s.h / 2 + rand(-20, 20), 8, H - s.h - 8);
    }
    s.x = clamp(s.x, 0, Math.max(0, W - s.w)); s.y = clamp(s.y, 0, Math.max(0, H - s.h));
  });
}
const place = s => { s.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) rotate(${s.r.toFixed(2)}deg)`; };

const mouse = { x: -1e4, y: -1e4 };
function step(t, dt) {
  for (const s of scraps) {
    if (s.held) continue;
    // a slow current, a little different for each scrap
    s.vx += Math.sin(t * 0.21 + s.seed) * 7 * dt; s.vy += Math.cos(t * 0.17 + s.seed * 1.4) * 6 * dt;
    // shy away from the cursor
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2, dx = cx - mouse.x, dy = cy - mouse.y, d = Math.hypot(dx, dy);
    const over = mouse.x > s.x - 8 && mouse.x < s.x + s.w + 8 && mouse.y > s.y - 8 && mouse.y < s.y + s.h + 8; // stays still enough to grab
    if (d < 130 && !over) { const f = (1 - d / 130) * 110 * dt; s.vx += (dx / (d || 1)) * f; s.vy += (dy / (d || 1)) * f; s.vr += (dx > 0 ? 1 : -1) * f * 0.06; }
    // keep apart from each other
    for (const o of scraps) {
      if (o === s) continue;
      const ox = (o.x + o.w / 2) - cx, oy = (o.y + o.h / 2) - cy, od = Math.hypot(ox, oy), min = (s.w + o.w) * 0.36;
      if (od < min) { const f = (1 - od / min) * 90 * dt; s.vx -= (ox / (od || 1)) * f; s.vy -= (oy / (od || 1)) * f; }
    }
    // soft walls
    const m = 6;
    if (s.x < m) s.vx += (m - s.x) * 6 * dt; if (s.x > W - s.w - m) s.vx -= (s.x - (W - s.w - m)) * 6 * dt;
    if (s.y < m) s.vy += (m - s.y) * 6 * dt; if (s.y > H - s.h - m) s.vy -= (s.y - (H - s.h - m)) * 6 * dt;
    // water drag
    const drag = Math.exp(-dt * 1.4);
    s.vx *= drag; s.vy *= drag; s.vr = (s.vr + Math.sin(t * 0.3 + s.seed) * 0.4 * dt) * Math.exp(-dt * 1.2);
    s.x += s.vx * dt; s.y += s.vy * dt; s.r = clamp(s.r + s.vr * dt * 10, -24, 24);
    s.x = clamp(s.x, -s.w * 0.3, W - s.w * 0.7); s.y = clamp(s.y, -s.h * 0.3, H - s.h * 0.7);
    place(s);
  }
}

measure(); scraps.forEach(place);
new ResizeObserver(() => { measure(); scraps.forEach(place); }).observe(desk);

// pick up and toss
scraps.forEach(s => {
  let lx = 0, ly = 0, lt = 0, ox = 0, oy = 0;
  s.el.addEventListener('pointerdown', e => {
    s.held = true; s.el.classList.add('held'); s.el.setPointerCapture(e.pointerId);
    s.el.style.zIndex = String(10 + Math.round(performance.now() / 1000) % 1000);
    const r = desk.getBoundingClientRect(); ox = e.clientX - r.left - s.x; oy = e.clientY - r.top - s.y;
    lx = e.clientX; ly = e.clientY; lt = performance.now(); s.vx = s.vy = 0;
  });
  s.el.addEventListener('pointermove', e => {
    if (!s.held) return;
    const r = desk.getBoundingClientRect(), now = performance.now(), dt = Math.max(1, now - lt) / 1000;
    s.x = clamp(e.clientX - r.left - ox, -s.w * 0.3, W - s.w * 0.7); s.y = clamp(e.clientY - r.top - oy, -s.h * 0.3, H - s.h * 0.7);
    s.vx = s.vx * 0.5 + ((e.clientX - lx) / dt) * 0.5; s.vy = s.vy * 0.5 + ((e.clientY - ly) / dt) * 0.5;
    s.r += (e.clientX - lx) * 0.08;
    lx = e.clientX; ly = e.clientY; lt = now; place(s);
  });
  const drop = () => { if (!s.held) return; s.held = false; s.el.classList.remove('held'); s.vx = clamp(s.vx, -900, 900); s.vy = clamp(s.vy, -900, 900); s.vr = s.vx * 0.004; };
  s.el.addEventListener('pointerup', drop); s.el.addEventListener('pointercancel', drop);
});

if (!reduceMotion) {
  if (finePointer) {
    desk.addEventListener('pointermove', e => { const r = desk.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    desk.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
  }
  visibleLoop(desk, step, { fps: 60 });
}
