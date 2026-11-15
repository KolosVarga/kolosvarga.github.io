/* A breaking wave drawn only with keyboard symbols.
   - The shape is painted once into three small grey maps (body + striations, foam, sun).
   - Each frame, every character cell samples those maps through a slow wobble, and picks a symbol by density.
   - The cursor parts the water: cells near it sample from closer in, so the wave bends away, and its edge foams.
   - Now and then the lip throws spray across to the headline, and the letters it hits bob like something floating. */
import { visibleLoop, reduceMotion, finePointer, gsap, rand, clamp } from './site.js';

const hero = document.querySelector('.a-hero');
const canvas = document.getElementById('wave');
const ctx = canvas.getContext('2d');
const title = hero.querySelector('h1');
const TAU = Math.PI * 2;
const DW = 1000, DH = 700, MS = 2, MW = DW / MS, MH = DH / MS; // design space and map resolution

const RAMP = " .'`:;\"^<>*&%$#@";
const FOAM = "'\"^*o%&";
const SPRAY = "'`.,\"*:";
const COLORS = { deep: '#1a7a5e', mid: '#2fbf93', light: '#a7dccb', foam: '#eef6f2', sun: '#f28a36' };
const LAYERS = Object.keys(COLORS);

// the wave travels to the right: a long face, a crest, a lip that curls back over a hollow
const BODY = 'M0 700 L0 604 C 40 590, 80 562, 120 550 C 152 541, 176 550, 182 567 C 186 579, 174 585, 165 578 ' +
  'C 205 590, 240 560, 280 505 C 330 435, 360 335, 425 250 C 475 182, 560 132, 650 135 C 742 140, 805 192, 812 262 ' +
  'C 816 302, 792 334, 760 333 C 734 332, 718 306, 736 286 C 702 268, 652 262, 612 292 C 562 332, 540 402, 560 470 ' +
  'C 580 532, 662 560, 762 568 C 862 576, 942 574, 1000 572 L1000 700 Z';
const CREST = [[425, 250], [470, 192], [520, 160], [580, 140], [650, 135], [712, 143], [762, 167], [796, 207], [812, 262], [806, 304], [786, 328], [760, 333]];

function seeded(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function hash(i, j, k) { let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }

/* ---------- the maps ---------- */
let BODYM, FOAMM, SUNM;
function buildMaps() {
  const mk = () => { const c = document.createElement('canvas'); c.width = MW; c.height = MH; const g = c.getContext('2d', { willReadFrequently: true }); g.scale(1 / MS, 1 / MS); return g; };
  const b = mk(), f = mk(), s = mk();
  const body = new Path2D(BODY);
  b.fillStyle = '#d9d9d9'; b.fill(body);
  b.save(); b.clip(body);
  // striations that follow the curl, and long swells in the sea
  b.strokeStyle = '#4e4e4e'; b.lineCap = 'round';
  b.fillStyle = '#9c9c9c'; b.fillRect(0, 590, 1000, 110); // the open sea is lighter than the wall of water
  for (let k = 0; k < 7; k++) { b.lineWidth = 13 + k * 2; b.beginPath(); b.arc(690, 300, 66 + k * 38, Math.PI * 0.93, Math.PI * 1.96); b.stroke(); }
  for (let k = 0; k < 6; k++) {
    b.lineWidth = 7; b.beginPath();
    for (let x = 0; x <= 1000; x += 20) { const y = 604 + k * 17 + Math.sin(x * 0.018 + k * 1.7) * 6; x ? b.lineTo(x, y) : b.moveTo(x, y); }
    b.stroke();
  }
  // the face just under the crest stays lighter
  b.strokeStyle = '#8a8a8a'; b.lineWidth = 22; b.beginPath(); b.moveTo(300, 520); b.bezierCurveTo(360, 400, 400, 320, 450, 262); b.stroke();
  b.restore();

  // foam: a cap along the crest, curling fingers off the lip, spray, and foam where the wave lands
  const rnd = seeded(23);
  f.strokeStyle = '#fff'; f.fillStyle = '#fff'; f.lineCap = 'round'; f.lineJoin = 'round';
  f.lineWidth = 16; f.beginPath(); CREST.forEach(([x, y], i) => (i ? f.lineTo(x, y) : f.moveTo(x, y))); f.stroke();
  for (let i = 1; i < CREST.length; i++) {
    const [x0, y0] = CREST[i - 1], [x1, y1] = CREST[i];
    const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny);
    for (let k = 0; k < 3; k++) {
      const t = rnd(), x = x0 + (x1 - x0) * t - (nx / nl) * 12, y = y0 + (y1 - y0) * t - (ny / nl) * 12;
      f.lineWidth = 5; f.beginPath(); f.arc(x, y, 8 + rnd() * 10, rnd() * TAU, rnd() * TAU + Math.PI * 1.2); f.stroke();
    }
    for (let k = 0; k < 5; k++) { // spray beyond the lip
      const t = rnd(), out = 18 + rnd() * 70;
      f.beginPath(); f.arc(x0 + (x1 - x0) * t - (nx / nl) * out, y0 + (y1 - y0) * t - (ny / nl) * out, 2 + rnd() * 4, 0, TAU); f.fill();
    }
  }
  for (let k = 0; k < 9; k++) { f.lineWidth = 5; f.beginPath(); f.arc(745 + rnd() * 50, 330 + rnd() * 34, 6 + rnd() * 9, 0, TAU * 0.8); f.stroke(); }
  for (let k = 0; k < 70; k++) { const x = 560 + rnd() * 440, y = 470 + (x - 560) * 0.2 + rnd() * 70; if (y < 590) { f.beginPath(); f.arc(x, y, 2 + rnd() * 6, 0, TAU); f.fill(); } }
  f.lineWidth = 9; f.beginPath(); f.moveTo(120, 551); f.bezierCurveTo(150, 540, 178, 548, 182, 567); f.stroke();

  s.fillStyle = '#fff'; s.beginPath(); s.arc(235, 205, 62, 0, TAU); s.fill();

  const read = g => { const d = g.getImageData(0, 0, MW, MH).data, out = new Float32Array(MW * MH); for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255; return out; };
  BODYM = read(b); FOAMM = read(f); SUNM = read(s);
}

/* ---------- layout ---------- */
let W = 0, H = 0, DPR = 1, fs = 12, cw = 7, ch = 13, cols = 0, rows = 0, box = { x: 0, y: 0, w: 1, h: 1 }, mobile = false;
function layout() {
  const r = hero.getBoundingClientRect();
  W = r.width; H = r.height; DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  mobile = W < 860;
  fs = clamp(Math.round(W / (mobile ? 60 : 120)), 8, 14);
  ctx.font = `400 ${fs}px "DM Mono", ui-monospace, monospace`;
  cw = ctx.measureText('@').width; ch = Math.round(fs * 1.15);
  cols = Math.ceil(W / cw); rows = Math.ceil(H / ch);
  if (mobile) {
    const w = W * 1.08; box = { x: -W * 0.06, y: 64, w, h: w * 0.7 };
  } else {
    let w = W * 0.64, h = w * 0.7;
    if (h > H * 0.86) { h = H * 0.86; w = h / 0.7; }
    box = { x: -w * 0.02, y: H - h - H * 0.03, w, h };
  }
  hero.style.setProperty('--wave-h', `${Math.round(box.y + box.h)}px`);
}
const toScreen = (u, v) => [box.x + (u / DW) * box.w, box.y + (v / DH) * box.h];

/* ---------- cursor ---------- */
const mouse = { x: -1e4, y: -1e4, k: 0, target: 0, lx: 0, ly: 0, lt: 0 };
const R = () => Math.max(70, Math.min(W, H) * 0.12);

/* ---------- spray particles ---------- */
const parts = [];
const G = 820;
function emit(x, y, vx, vy, opts = {}) {
  if (parts.length > 180) return;
  parts.push({ x, y, vx, vy, age: 0, life: opts.life || rand(0.7, 1.4), c: SPRAY[Math.floor(rand(0, SPRAY.length))], hit: opts.hit || null, T: opts.T || 0 });
}
function lipPoint() { const i = Math.floor(rand(4, CREST.length)); return CREST[i]; }

function splash() { // throw a handful of spray at one letter of the headline
  const letters = [...title.querySelectorAll('.ch')];
  if (!letters.length) return;
  const el = letters[Math.floor(rand(0, letters.length))];
  const hr = hero.getBoundingClientRect(), lr = el.getBoundingClientRect();
  const tx = lr.left + lr.width / 2 - hr.left, ty = lr.top + lr.height * 0.25 - hr.top;
  const [x0, y0] = toScreen(806, 290);
  const T = clamp(Math.hypot(tx - x0, ty - y0) / 520, 0.8, 1.5);
  for (let n = 0; n < 14; n++) {
    const sx = tx + rand(-18, 18), sy = ty + rand(-10, 10), t = T * rand(0.92, 1.08);
    emit(x0 + rand(-6, 6), y0 + rand(-6, 6), (sx - x0) / t, (sy - y0 - 0.5 * G * t * t) / t, { life: t + 0.25, hit: n === 0 ? el : null, T: t });
  }
}
function bob(el) {
  if (!gsap) return;
  const all = [...title.querySelectorAll('.ch')], i = all.indexOf(el);
  [-2, -1, 0, 1, 2].forEach(o => {
    const c = all[i + o]; if (!c) return;
    const s = 1 - Math.abs(o) * 0.35;
    gsap.timeline({ delay: Math.abs(o) * 0.06 })
      .to(c, Object.assign({ yPercent: -16 * s, duration: 0.16, ease: 'power2.out' }, o === 0 ? { color: '#2fbf93' } : {}))
      .to(c, { yPercent: 0, duration: 1.1, ease: 'elastic.out(1, 0.35)' })
      .set(c, { clearProps: 'color' });
  });
}

/* ---------- render ---------- */
const rowsBuf = {};
function render(t, dt) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.font = `400 ${fs}px "DM Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  const rad = R(), mk = mouse.k;
  const tick = Math.floor(t * 1.6);
  for (const L of LAYERS) rowsBuf[L] = new Array(cols);
  for (let j = 0; j < rows; j++) {
    const lines = {}; for (const L of LAYERS) lines[L] = rowsBuf[L].fill(' ');
    const y = j * ch + ch / 2;
    let any = false;
    for (let i = 0; i < cols; i++) {
      const x = i * cw + cw / 2;
      let sx = x, sy = y, hole = 0;
      if (mk > 0.01) {
        const dx = x - mouse.x, dy = y - mouse.y, d = Math.hypot(dx, dy);
        if (d < rad) { const k = (1 - d / rad); hole = k * mk; const push = k * k * rad * 0.5 * mk; sx -= (dx / (d || 1)) * push; sy -= (dy / (d || 1)) * push; }
      }
      sx += Math.sin(sy * 0.028 + t * 1.1) * cw * 0.55;
      sy += Math.cos(sx * 0.019 + t * 0.8) * ch * 0.3;
      let u = ((sx - box.x) / box.w) * DW, v = ((sy - box.y) / box.h) * DH;
      if (v < 0 || u < 0) continue;
      if (v >= DH) { if (mobile) continue; v = DH - 1; } // on phones the water ends above the text
      let foamOK = true;
      if (u >= DW) { if (v < 575) continue; u = DW - 1 - ((u - DW) % 300); foamOK = false; } // the sea runs on under the text
      const mi = ((v / MS) | 0) * MW + ((u / MS) | 0);
      let body = BODYM[mi];
      const foam = foamOK ? FOAMM[mi] : 0, sun = SUNM[mi];
      if (body > 0.05 && v > 588) body *= 0.72 + 0.28 * Math.sin(u * 0.028 - t * 0.7 + v * 0.11); // swells roll along
      const n = hash(i, j, tick + ((i * 7 + j * 3) % 5));
      let layer = null, c = ' ';
      if (foam > 0.35 && hole < 0.45) { layer = 'foam'; c = FOAM[Math.floor(n * FOAM.length)]; }
      else if (body > 0.04) {
        if (hole > 0.3 && hole < 0.62) { layer = 'foam'; c = SPRAY[Math.floor(n * SPRAY.length)]; }
        else {
          const d = clamp(body * (1 - hole * 1.1) + (n - 0.5) * 0.09, 0, 1);
          const idx = Math.round(d * (RAMP.length - 1));
          if (v > 590) { // the open sea stays quiet: darker, lighter symbols
            const si = Math.round(d * 0.8 * (RAMP.length - 1));
            if (si > 1) { c = RAMP[si]; layer = d > 0.55 ? 'mid' : 'deep'; }
          } else if (idx > 0) { c = RAMP[idx]; layer = d > 0.74 ? 'deep' : d > 0.42 ? 'mid' : 'light'; }
        }
      } else if (sun > 0.4) { layer = 'sun'; c = (i + j) % 2 ? ':' : '.'; }
      if (layer) { lines[layer][i] = c; any = true; }
    }
    if (!any) continue;
    for (const L of LAYERS) {
      const s = lines[L].join('');
      if (s.trim()) { ctx.fillStyle = COLORS[L]; ctx.fillText(s, 0, y); }
    }
  }
  // spray
  ctx.fillStyle = COLORS.foam;
  for (let p = parts.length - 1; p >= 0; p--) {
    const q = parts[p];
    q.age += dt; q.vy += G * dt; q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.hit && q.age >= q.T) { bob(q.hit); q.hit = null; }
    if (q.age > q.life) { parts.splice(p, 1); continue; }
    ctx.globalAlpha = clamp(1 - q.age / q.life, 0, 1) * 0.9;
    ctx.fillText(q.c, q.x, q.y);
  }
  ctx.globalAlpha = 1;
}

/* ---------- start ---------- */
await Promise.race([document.fonts.load(`400 12px "DM Mono"`), new Promise(r => setTimeout(r, 1500))]);
buildMaps();
layout();
render(3.2, 0);
let queued = false;
new ResizeObserver(() => {
  if (queued) return; queued = true;
  requestAnimationFrame(() => { queued = false; layout(); render(performance.now() / 1000, 0); });
}).observe(hero);

if (!reduceMotion) {
  if (finePointer) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now();
      const sp = mouse.lt ? Math.hypot(x - mouse.lx, y - mouse.ly) / Math.max(1, now - mouse.lt) * 1000 : 0;
      mouse.x = x; mouse.y = y; mouse.target = 1;
      // dragging fast through the water throws a little spray
      const u = ((x - box.x) / box.w) * DW, v = ((y - box.y) / box.h) * DH;
      if (sp > 900 && u > 0 && u < DW && v > 0 && v < DH && BODYM[((v / MS) | 0) * MW + ((u / MS) | 0)] > 0.1 && Math.random() < 0.5) {
        for (let n = 0; n < 3; n++) emit(x, y, (x - mouse.lx) * rand(2, 5), -rand(150, 320), { life: rand(0.5, 0.9) });
      }
      mouse.lx = x; mouse.ly = y; mouse.lt = now;
    });
    hero.addEventListener('pointerleave', () => { mouse.target = 0; mouse.lt = 0; });
  }
  let nextSplash = 2.6, sprayAcc = 0;
  visibleLoop(hero, (t, dt) => {
    mouse.k += (mouse.target - mouse.k) * Math.min(1, dt * 5);
    // the lip loses a little spray all the time
    sprayAcc += dt * 7;
    while (sprayAcc > 1) {
      sprayAcc -= 1;
      const [u, v] = lipPoint(), [x, y] = toScreen(u, v);
      emit(x, y, rand(10, 90), -rand(40, 160), { life: rand(0.5, 1.0) });
    }
    nextSplash -= dt;
    if (nextSplash <= 0) { splash(); nextSplash = rand(7, 12); }
    render(t, dt);
  }, { fps: 30 });
}
