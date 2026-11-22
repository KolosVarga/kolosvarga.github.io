/* Projects header: a small patch of pixel-art space, treated as 3D.
   Human and alien craft fly between planets and the screen edges. They shrink as they descend to a
   planet and grow as they lift off, and anything farther away than a planet passes behind it.
   - Grab any craft and throw it. Thrown at a planet, it blows up. Otherwise it rights itself and
     flies off; thrown off screen, it drifts back in after a moment.
   - Every so often a human fighter and an alien saucer get into a chase and trade laser fire.
   - The odd astronaut floats by (you can throw them too; they land softly).
   Everything renders into one low-resolution canvas that CSS scales up with hard pixel edges. */
import { visibleLoop, reduceMotion, rand, clamp } from './site.js';

const hero = document.getElementById('space');
const canvas = hero?.querySelector('canvas');
if (canvas) start();

function start() {
const ctx = canvas.getContext('2d');
const title = document.getElementById('p-title');
const hint = document.getElementById('space-hint');
const bar = document.getElementById('bar');
const TAU = Math.PI * 2;
const pick = a => a[Math.floor(Math.random() * a.length)];
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const snap16 = a => Math.round(a / (TAU / 16)) * (TAU / 16);
const coarse = window.matchMedia('(pointer: coarse)').matches;

let W = 0, H = 0, PIX = 3, SPR = 1, BW = 0, BH = 0, speedScale = 1, time = 0; // SPR: buffer pixels per sprite pixel

/* ================= sprites ================= */
const COL = {
  k: '#0a0e1a', w: '#eef2f4', l: '#c3cad0', g: '#8a949e', d: '#4d5661', b: '#3aa0e6', B: '#1d4f9c', c: '#a8e6ff',
  o: '#f28a36', r: '#e04a3a', y: '#ffd23f', G: '#4fd86f', h: '#1f7a3d', p: '#fff6c8', m: '#5d6b82', n: '#33405a'
};
function sprite(rows, { mirror = false, swap = null } = {}) {
  const full = rows.map(r => (mirror ? r + [...r.slice(0, -1)].reverse().join('') : r));
  const w = Math.max(...full.map(r => r.length)), h = full.length;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  full.forEach((row, y) => [...row].forEach((ch, x) => {
    const k = (swap && swap[ch]) || ch;
    if (COL[k]) { g.fillStyle = COL[k]; g.fillRect(x, y, 1, 1); }
  }));
  return c;
}
// human craft point up; they're rotated to face where they fly
const SHUTTLE = [
  '.....k', '....kw', '....kw', '...kwl', '...kww', '..kwbc', '..kwbb', '..kwBb', '..kwww', '..kwrr',
  '..kwwl', '.kkwwl', 'kwkwwl', 'kwkwol', 'kwkwwl', 'klkwwl', 'kkkddd', '..kdgd', '..kk.k'
];
const FIGHTER = [
  '.......k', '......kl', '......kw', '.....kwb', '.....kwc', '.....kwb', '.....kwB', '..k..kww',
  '..k.klww', '.kl.klwo', '.klkllwo', 'kllllllw', 'kllllrrl', 'kkklllld', '...kkddd', '....kk.k'
];
// alien craft stay level and tilt as they turn
const SAUCER = [
  '........kkk', '......kkccb', '.....kcwcbb', '.....kcbbbb', '...kkkkkkkk',
  '..kllwlllwl', '.kgggygggyg', 'kddgggggggg', '.kkddddkddd', '...kkkkkkkk'
];
const GREENIE = [
  '......kkk', '....kkccc', '...kccGGG', '...kcGkGG', '...kcGGGG',
  '.kkkkkkkk', 'kmmcmmmcm', 'kdmmmmmmm', '.kkdddddd', '...kkkyyy'
];
const ASTRO = [
  '...kkkkk...', '..kwwwwwk..', '.kwkkkkkwk.', '.kwkcbbbkwk', '.kwkbbbBkwk', '.kwkkkkkkwk',
  'kokwwwwwwkb', 'kwkwkkkwkwk', 'kwkwkbkwkwk', '.kkwkkkwkk.', '..koooook..', '..kwwkwwk..', '..kwwkwwk..', '..kkk.kkk..'
];
const KINDS = {
  shuttle: { frames: [sprite(SHUTTLE, { mirror: true })], team: 'human', speed: 80, turn: 1.3, hp: 4, rot: true, flames: [{ x: 0, w: 3 }] },
  fighter: { frames: [sprite(FIGHTER, { mirror: true })], team: 'human', speed: 135, turn: 1.9, hp: 4, rot: true, flames: [{ x: -2.5, w: 2 }, { x: 2.5, w: 2 }] },
  saucer: { frames: [sprite(SAUCER, { mirror: true }), sprite(SAUCER, { mirror: true, swap: { y: 'o', c: 'b', b: 'c' } })], team: 'alien', speed: 110, turn: 2.2, hp: 4, bob: true },
  greenie: { frames: [sprite(GREENIE, { mirror: true }), sprite(GREENIE, { mirror: true, swap: { c: 'b', y: 'o' } })], team: 'alien', speed: 120, turn: 2.4, hp: 3, bob: true },
  astro: { frames: [sprite(ASTRO)], team: 'astro', speed: 20, turn: 0, hp: 99 }
};
for (const K of Object.values(KINDS)) { K.w = K.frames[0].width; K.h = K.frames[0].height; }
const SHIPS = ['shuttle', 'shuttle', 'fighter', 'fighter', 'saucer', 'saucer', 'greenie'];

/* ================= noise + dithering ================= */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
function hash3(x, y, z) { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (a, b, d) => hash3(xi + a, yi + b, zi + d);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u), x10 = lerp(c(0, 1, 0), c(1, 1, 0), u);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u), x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}
const fbm = (x, y, z, o = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * noise3(x * f, y * f, z * f); f *= 2; a *= 0.5; } return s / (1 - Math.pow(0.5, o)); };
const toU32 = hex => { const n = parseInt(hex.slice(1), 16); return (255 << 24 | (n & 255) << 16 | ((n >> 8) & 255) << 8 | (n >> 16)) >>> 0; };

/* ================= planets ================= */
// textures are wrapped around the sphere once; each frame just reads them at a new longitude
const TW = 160, TH = 80;
function makeTexture(fn) {
  const t = new Float32Array(TW * TH), t2 = new Float32Array(TW * TH);
  for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
    const a = (i / TW) * TAU, v = j / TH, cx = Math.cos(a), sy = Math.sin(a);
    const [m, n] = fn(cx, sy, v, i / TW);
    t[j * TW + i] = m; t2[j * TW + i] = n || 0;
  }
  return { t, t2 };
}
const craters = Array.from({ length: 16 }, () => ({ u: Math.random(), v: rand(0.15, 0.85), r: rand(0.03, 0.09) }));
const PLANETS = [
  { id: 'giant', depth: 0.62, spin: 0.004,
    pal: ['#1a0a08', '#4a1a10', '#8a3216', '#c4521f', '#e8823a', '#f6b276'],
    tex: makeTexture((cx, sy, v, u) => {
      let b = 0.5 + 0.5 * Math.sin(v * Math.PI * 11 + 2.2 * fbm(cx * 1.4 + 9, sy * 1.4, v * 5));
      const du = Math.min(Math.abs(u - 0.3), 1 - Math.abs(u - 0.3)) / 0.07, dv = (v - 0.64) / 0.045, e = du * du + dv * dv;
      if (e < 1) b = e < 0.45 ? 0.95 : 0.15; // a storm
      return [b * 0.8 + 0.1];
    }) },
  { id: 'ringed', depth: 0.44, spin: 0.006, ring: true,
    pal: ['#04161a', '#0a3a3c', '#136a66', '#1f9a8c', '#4cc9b0', '#aef0dc'],
    ringPal: ['#2c5a58', '#4f8f88', '#7fc2b6', '#b6e6da'],
    tex: makeTexture((cx, sy, v) => [0.5 + 0.28 * Math.sin(v * Math.PI * 8 + 1.4 * fbm(cx * 2 + 3, sy * 2, v * 4))]) },
  { id: 'moon', depth: 0.3, spin: 0.003,
    pal: ['#0e1014', '#2a2e36', '#4c525c', '#767d88', '#a6adb6', '#d6dbe0'],
    tex: makeTexture((cx, sy, v, u) => {
      let b = 0.45 + 0.35 * (fbm(cx * 2.5, sy * 2.5, v * 5) - 0.5);
      for (const c of craters) {
        const du = Math.min(Math.abs(u - c.u), 1 - Math.abs(u - c.u)) * 2, d = Math.hypot(du, v - c.v) / c.r;
        if (d < 0.75) b = 0.18; else if (d < 1) b = Math.max(b, 0.8);
      }
      return [b];
    }) },
  { id: 'earth', depth: 0.5, spin: 0.012,
    pal: ['#04102a', '#0a2a5c', '#14509a', '#2a7fd0', '#5fb0f0', '#a8dcff'],
    land: ['#06180c', '#0f3a1a', '#1e6a2c', '#3a9a3e', '#76c45a', '#bfe89a'],
    cloud: ['#2a3340', '#6a7686', '#b8c4d0', '#eef4fa'],
    tex: makeTexture((cx, sy, v) => {
      const land = fbm(cx * 1.6 + 20, sy * 1.6, v * 3.2), cl = fbm(cx * 2.4 - 7, sy * 2.4, v * 6 + 4);
      return [land, cl];
    }) }
];
// where each planet sits: landscape and portrait layouts (fractions of the scene; r is a fraction of H or W)
const PLACES = {
  wide: { giant: [0.07, 0.92, 0.36], ringed: [0.86, 0.26, 0.095], moon: [0.21, 0.2, 0.042], earth: [0.76, 0.8, 0.07] },
  tall: { giant: [0.0, 0.93, 0.5], ringed: [0.84, 0.21, 0.14], moon: [0.16, 0.18, 0.065], earth: [0.85, 0.72, 0.1] }
};
const LIGHT = (() => { const v = [-0.62, -0.5, 0.6], l = Math.hypot(...v); return v.map(x => x / l); })();

function layoutPlanets() {
  const wide = W / H >= 0.9, P = wide ? PLACES.wide : PLACES.tall, base = wide ? H : W;
  for (const p of PLANETS) {
    const [fx, fy, fr] = P[p.id];
    p.bx = fx * W; p.by = fy * H; p.r = fr * base;
    p.R = Math.max(4, Math.round(p.r / PIX));
    p.pad = p.ring ? Math.ceil(p.R * 1.05) : 1;
    const size = 2 * (p.R + p.pad) + 1;
    p.disk = document.createElement('canvas'); p.disk.width = p.disk.height = size;
    p.img = p.disk.getContext('2d').createImageData(size, size);
    p.buf = new Uint32Array(p.img.data.buffer);
    p.rot = p.rot || Math.random(); p.redraw = 0;
    if (p.ring) buildRing(p, size);
    renderPlanet(p);
  }
}
function buildRing(p, size) {
  const back = document.createElement('canvas'), front = document.createElement('canvas');
  back.width = front.width = back.height = front.height = size;
  const bg = back.getContext('2d'), fg = front.getContext('2d');
  const c = (size - 1) / 2, R = p.R, inner = R * 1.32, outer = R * 1.98, tilt = -0.36, flat = 0.3;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let rr = inner; rr <= outer; rr += 0.5) {
    const f = (rr - inner) / (outer - inner);
    if (f > 0.56 && f < 0.64) continue; // the gap
    const steps = Math.ceil(TAU * rr * 1.6);
    for (let k = 0; k < steps; k++) {
      const t = (k / steps) * TAU, x0 = Math.cos(t) * rr, y0 = Math.sin(t) * rr * flat;
      const x = Math.round(c + x0 * ct - y0 * st), y = Math.round(c + x0 * st + y0 * ct);
      const isBack = Math.sin(t) < 0;
      let idx = Math.floor(clamp((0.35 + 0.65 * Math.sin(f * 9)) * 0.5 + 0.35 + (bayer(x, y) - 0.5) * 0.3, 0, 0.999) * p.ringPal.length);
      if (isBack) idx = Math.max(0, idx - 1);
      const g = isBack ? bg : fg; g.fillStyle = p.ringPal[idx]; g.fillRect(x, y, 1, 1);
    }
  }
  p.ringBack = back; p.ringFront = front;
}
function renderPlanet(p) {
  const R = p.R, size = p.disk.width, c = (size - 1) / 2, buf = p.buf;
  buf.fill(0);
  const pal = p.pal.map(toU32), land = p.land?.map(toU32), cloud = p.cloud?.map(toU32);
  const { t, t2 } = p.tex, N = pal.length;
  for (let j = -R; j <= R; j++) {
    for (let i = -R; i <= R; i++) {
      const nx = i / R, ny = j / R, d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const lam = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const lon = Math.atan2(nx, nz), lat = Math.asin(ny);
      const u = ((((lon / TAU) + p.rot) % 1) + 1) % 1, v = lat / Math.PI + 0.5;
      const ti = Math.min(TH - 1, Math.floor(v * TH)) * TW + Math.floor(u * TW);
      const px = i + R, py = j + R, dth = (bayer(px, py) - 0.5) * 0.24;
      let col;
      if (p.id === 'earth') {
        const isLand = t[ti] > 0.56, isCloud = t2[ti] > 0.64;
        const val = clamp(lam * 0.95 + (isLand ? 0.05 : 0) - 0.05 + dth, 0, 0.999);
        col = isCloud ? cloud[Math.floor(clamp(lam * 1.05 + dth, 0, 0.999) * cloud.length)] : (isLand ? land : pal)[Math.floor(val * N)];
      } else {
        const val = clamp(lam * 0.82 + t[ti] * 0.34 - 0.14 + dth, 0, 0.999);
        col = pal[Math.floor(val * N)];
      }
      buf[Math.round(c + j) * size + Math.round(c + i)] = col;
    }
  }
  p.disk.getContext('2d').putImageData(p.img, 0, 0);
}
function drawPlanet(p) {
  const x = Math.round(p.x / PIX - p.disk.width / 2), y = Math.round(p.y / PIX - p.disk.height / 2);
  if (p.ringBack) ctx.drawImage(p.ringBack, x, y);
  ctx.drawImage(p.disk, x, y);
  if (p.ringFront) ctx.drawImage(p.ringFront, x, y);
}

/* ================= stars + nebula ================= */
let stars = [], sparkles = [], nebula = null;
function makeStars() {
  const n = Math.round((BW * BH) / 150);
  const tints = ['#ffffff', '#ffffff', '#cfe6ff', '#fff2c8', '#bfefff'];
  stars = Array.from({ length: n }, () => ({ x: rand(0, BW), y: rand(0, BH), d: pick([0.15, 0.3, 0.3, 0.55, 0.9]), a: rand(0.25, 1), tw: rand(0.5, 2.5), ph: rand(0, TAU), c: pick(tints) }));
  sparkles = Array.from({ length: Math.round(clamp(BW / 45, 5, 14)) }, () => ({ x: rand(0, BW), y: rand(0, BH * 0.9), d: rand(0.3, 0.8), ph: rand(0, TAU), sp: rand(0.6, 1.6), c: pick(['#ffffff', '#bfefff', '#ffe38a', '#9fe3ff', '#ffc9a8']) }));
}
function makeNebula() {
  const m = 10, w = BW + m * 2, h = BH + m * 2;
  nebula = document.createElement('canvas'); nebula.width = w; nebula.height = h;
  const g = nebula.getContext('2d'), img = g.createImageData(w, h), buf = new Uint32Array(img.data.buffer);
  const cols = ['#0a1124', '#0e1730', '#13203f', '#0b1a22'].map(toU32), sc = 90 / Math.max(BW, 1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm(x * sc * 0.05, y * sc * 0.08, 1.7, 5) + (bayer(x, y) - 0.5) * 0.09;
    const teal = fbm(x * sc * 0.04 + 30, y * sc * 0.06, 5.1, 4);
    if (teal + (bayer(x, y) - 0.5) * 0.08 > 0.71) buf[y * w + x] = cols[3];
    else if (n > 0.69) buf[y * w + x] = cols[2];
    else if (n > 0.62) buf[y * w + x] = cols[1];
    else if (n > 0.56) buf[y * w + x] = cols[0];
  }
  g.putImageData(img, 0, 0);
}
function drawSky(dt) {
  ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, BW, BH);
  ctx.drawImage(nebula, Math.round(-10 + par.x * 0.1 / PIX), Math.round(-10 + par.y * 0.1 / PIX));
  drift += dt * 2.2;
  for (const s of stars) {
    const x = (((s.x - drift * s.d + par.x * s.d * 0.3 / PIX) % BW) + BW) % BW, y = s.y + par.y * s.d * 0.3 / PIX;
    const a = s.a * (0.65 + 0.35 * Math.sin(time * s.tw + s.ph));
    ctx.globalAlpha = a; ctx.fillStyle = s.c; ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
  }
  ctx.globalAlpha = 1;
  for (const s of sparkles) {
    const x = Math.floor((((s.x - drift * s.d + par.x * s.d * 0.3 / PIX) % BW) + BW) % BW), y = Math.floor(s.y + par.y * s.d * 0.3 / PIX);
    const k = 0.5 + 0.5 * Math.sin(time * s.sp + s.ph), arm = k > 0.75 ? 2 : k > 0.3 ? 1 : 0;
    ctx.fillStyle = s.c; ctx.fillRect(x, y, 1, 1);
    if (arm) { ctx.globalAlpha = 0.55 + 0.45 * k; ctx.fillRect(x - arm, y, arm, 1); ctx.fillRect(x + 1, y, arm, 1); ctx.fillRect(x, y - arm, 1, arm); ctx.fillRect(x, y + 1, 1, arm); ctx.globalAlpha = 1; }
  }
}
let drift = 0;
const par = { x: 0, y: 0, tx: 0, ty: 0 };

/* ================= craft ================= */
let crafts = [], lasers = [], parts = [], booms = [], shake = 0;
class Craft {
  constructor(kind, x, y, s) {
    this.kind = kind; this.K = KINDS[kind]; this.team = this.K.team;
    this.x = x; this.y = y; this.s = s; this.cs = s;
    this.h = 0; this.vx = 0; this.vy = 0; this.spin = 0; this.tilt = 0;
    this.state = 'cruise'; this.goal = null; this.hp = this.K.hp; this.mul = 1; this.t = 0;
    this.cool = rand(0.4, 1.2); this.burst = 0; this.flash = 0; this.seed = rand(0, 100);
  }
  get size() { return Math.max(this.K.w, this.K.h) * this.s * SPR * PIX; } // in CSS px
}
const onScreen = (c, m = 0) => c.x > -m && c.x < W + m && c.y > -m && c.y < H + m;
function goalPoint(g) { return g.type === 'planet' ? { x: g.p.x, y: g.p.y } : g; }
function exitGoal(from) {
  const left = from ? from.x > W / 2 : Math.random() < 0.5;
  if (Math.random() < 0.15) return { type: 'exit', x: rand(0.1, 0.9) * W, y: -140 };
  return { type: 'exit', x: left ? -140 : W + 140, y: rand(0.08, 0.85) * H };
}
function planetGoal(not) { const ps = PLANETS.filter(p => p !== not); return { type: 'planet', p: pick(ps) }; }
const newGoal = (c, not) => (Math.random() < 0.5 ? exitGoal(c) : planetGoal(not));

function spawnEdge(kind = pick(SHIPS)) {
  const left = Math.random() < 0.5, s = rand(0.45, 1.2);
  const c = new Craft(kind, left ? -40 : W + 40, rand(0.1, 0.8) * H, s);
  c.goal = Math.random() < 0.55 ? { type: 'exit', x: left ? W + 140 : -140, y: rand(0.1, 0.85) * H } : planetGoal();
  const g = goalPoint(c.goal); c.h = Math.atan2(g.y - c.y, g.x - c.x);
  crafts.push(c); return c;
}
function spawnLaunch() {
  const p = pick(PLANETS), c = new Craft(pick(SHIPS), p.x, p.y, 0.06);
  c.cs = rand(0.6, 1.2); c.state = 'launch'; c.origin = p; c.goal = newGoal(c, p);
  c.h = Math.atan2(H * 0.45 - p.y, W * 0.5 - p.x) + rand(-0.9, 0.9);
  crafts.push(c); return c;
}
function spawnAstro() {
  const left = Math.random() < 0.5, c = new Craft('astro', left ? -30 : W + 30, rand(0.12, 0.7) * H, rand(0.5, 1));
  c.state = 'drift'; c.vx = (left ? 1 : -1) * rand(14, 30) * speedScale; c.vy = rand(-6, 6); c.spin = rand(-0.35, 0.35); c.h = rand(0, TAU);
  crafts.push(c);
}
function startChase() {
  const left = Math.random() < 0.5, y = rand(0.2, 0.7) * H, s = rand(0.85, 1.2);
  const alien = pick(['saucer', 'greenie']), alienHunts = Math.random() < 0.35;
  const fleer = new Craft(alienHunts ? 'fighter' : alien, left ? -40 : W + 40, y, s);
  const hunter = new Craft(alienHunts ? alien : 'fighter', left ? -190 : W + 190, y + rand(-40, 40), s);
  fleer.state = 'flee'; hunter.state = 'hunt'; fleer.chase = hunter.chase = true;
  fleer.partner = hunter; hunter.partner = fleer;
  fleer.h = hunter.h = left ? 0 : Math.PI; fleer.end = rand(9, 14); fleer.hp = Math.round(rand(4, 7)); hunter.hp = Math.round(rand(5, 8));
  crafts.push(fleer, hunter);
}

function steer(c, tx, ty, turn, dt) {
  const des = Math.atan2(ty - c.y, tx - c.x);
  c.h += clamp(angDiff(c.h, des), -turn * dt, turn * dt);
  const sp = c.K.speed * speedScale * c.mul * (0.35 + 0.65 * c.s);
  c.vx = Math.cos(c.h) * sp; c.vy = Math.sin(c.h) * sp;
  c.x += c.vx * dt; c.y += c.vy * dt;
}
function levelOut(c, dt) { // aliens tilt into their turns
  const sp = Math.hypot(c.vx, c.vy) || 1;
  c.tilt = lerp(c.tilt, clamp((c.vx / sp) * 0.22, -0.25, 0.25), 1 - Math.exp(-dt * 4));
}
function fire(c, ang) {
  const r = c.size * 0.45, sp = 760 * speedScale * (0.4 + 0.6 * c.s);
  lasers.push({ x: c.x + Math.cos(ang) * r, y: c.y + Math.sin(ang) * r, vx: Math.cos(ang) * sp + c.vx, vy: Math.sin(ang) * sp + c.vy, t: 0, team: c.team, s: c.s });
}
function endChase(c) {
  c.chase = false; c.partner = null;
  if (c.state === 'flee' || c.state === 'hunt') { c.state = 'cruise'; c.mul = 1.2; c.goal = exitGoal(c); }
}
function remove(c) {
  const i = crafts.indexOf(c); if (i >= 0) crafts.splice(i, 1);
  if (c.partner) { const o = c.partner; c.partner = null; o.partner = null; endChase(o); }
  if (held === c) held = null;
}

function update(dt) {
  for (const c of [...crafts]) {
    c.t += dt; c.flash = Math.max(0, c.flash - dt);
    const K = c.K;
    switch (c.state) {
      case 'launch': case 'cruise': case 'return': {
        const g = goalPoint(c.goal);
        let turn = K.turn;
        if (c.goal.type === 'planet') {
          const p = c.goal.p, d = Math.hypot(g.x - c.x, g.y - c.y);
          turn *= 1 + 3 * clamp(1 - d / (p.r * 3.5), 0, 1);
          if (d < p.r * 3.2) c.s = Math.min(c.s, lerp(0.05, c.cs, clamp((d - p.r * 0.15) / (p.r * 3.05), 0, 1)));
          if (d < Math.max(6, p.r * 0.16) || c.s < 0.06) { remove(c); continue; } // landed
        }
        steer(c, g.x, g.y, turn, dt);
        if (c.state === 'launch') {
          c.s = lerp(c.s, c.cs, 1 - Math.exp(-dt * 0.8));
          if (c.s > c.cs * 0.93) { c.state = 'cruise'; c.origin = null; }
        }
        if (c.state === 'return') {
          c.mul = lerp(c.mul, 0.55, 1 - Math.exp(-dt * 2));
          if (Math.hypot(g.x - c.x, g.y - c.y) < 40) { c.state = 'cruise'; c.goal = newGoal(c); }
        } else c.mul = lerp(c.mul, 1, 1 - Math.exp(-dt * 0.8));
        if (c.goal.type === 'exit' && !onScreen(c, 90)) { remove(c); continue; }
        if (!K.rot) levelOut(c, dt);
        break;
      }
      case 'flee': {
        if (!c.wp || c.t > c.wpT || Math.hypot(c.wp.x - c.x, c.wp.y - c.y) < 70) { c.wp = { x: rand(0.08, 0.92) * W, y: rand(0.12, 0.8) * H }; c.wpT = c.t + rand(1.1, 2); }
        c.mul = 1.3; steer(c, c.wp.x, c.wp.y, K.turn * 1.5, dt);
        if (!K.rot) levelOut(c, dt);
        const o = c.partner;
        c.cool -= dt;
        if (o && c.cool <= 0 && Math.hypot(o.x - c.x, o.y - c.y) < 420) { fire(c, Math.atan2(o.y - c.y, o.x - c.x) + rand(-0.3, 0.3)); c.cool = rand(1.1, 2.3); }
        if (c.t > c.end) { c.state = 'cruise'; c.goal = exitGoal(c); c.mul = 1.3; }
        break;
      }
      case 'hunt': {
        const o = c.partner;
        if (!o) { endChase(c); break; }
        const ax = o.x + o.vx * 0.3, ay = o.y + o.vy * 0.3, d = Math.hypot(o.x - c.x, o.y - c.y);
        c.mul = d < 110 ? 1.15 : 1.4; steer(c, ax, ay, K.turn * 1.25, dt);
        if (!K.rot) levelOut(c, dt);
        const aim = Math.atan2(ay - c.y, ax - c.x);
        c.cool -= dt;
        if (c.cool <= 0 && d < 540 * speedScale + 120 && (!K.rot || Math.abs(angDiff(c.h, aim)) < 0.24)) {
          fire(c, K.rot ? c.h : aim + rand(-0.12, 0.12)); c.burst++;
          c.cool = c.burst % 3 ? 0.12 : rand(0.6, 1.1);
        }
        if (!onScreen(c, 300) && c.t > 4) { remove(c); continue; }
        break;
      }
      case 'drift': {
        c.x += c.vx * dt; c.y += c.vy * dt; c.h += c.spin * dt;
        c.vx *= Math.exp(-dt * 0.05); c.vy *= Math.exp(-dt * 0.05);
        if (!onScreen(c, 90) && c.t > 2) { remove(c); continue; }
        break;
      }
      case 'thrown': {
        if (c.doom) { // on its way into a planet
          const p = c.doom, dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy), sp = Math.max(320, Math.hypot(c.vx, c.vy));
          const va = Math.atan2(c.vy, c.vx), want = Math.atan2(dy, dx), na = va + clamp(angDiff(va, want), -4 * dt, 4 * dt);
          c.vx = Math.cos(na) * sp; c.vy = Math.sin(na) * sp;
          c.s = Math.max(0.1, c.s0 * (0.3 + 0.7 * clamp(d / c.d0, 0, 1)));
          if (d < p.r * 0.72) { if (c.team === 'astro') { sparks(c.x, c.y, c.s, '#eef4fa', 6); remove(c); } else explode(c, p); continue; }
        } else {
          const drag = c.team === 'astro' ? 0.5 : 1.6;
          c.vx *= Math.exp(-dt * drag); c.vy *= Math.exp(-dt * drag);
        }
        c.x += c.vx * dt; c.y += c.vy * dt;
        c.h += c.spin * dt; c.spin *= Math.exp(-dt * 0.9);
        if (!K.rot && c.team !== 'astro') c.tilt += c.spin * dt;
        const speed = Math.hypot(c.vx, c.vy);
        if (!c.doom && !onScreen(c, c.size * 0.6)) {
          if (c.team === 'astro') { remove(c); continue; } // floats away for good
          // stop a little way past the edge, wait, then drift back in
          c.x = clamp(c.x, -120, W + 120); c.y = clamp(c.y, -120, H + 120);
          if (speed < 260 || c.x <= -120 || c.x >= W + 120 || c.y <= -120 || c.y >= H + 120) { c.state = 'away'; c.t = 0; c.wait = rand(1.2, 2.6); c.vx = c.vy = 0; }
        } else if (!c.doom && speed < 55) {
          if (c.team === 'astro') { c.state = 'drift'; c.vx = c.vx || rand(-14, 14); c.vy = c.vy || rand(-6, 6); c.spin = clamp(c.spin, -0.5, 0.5); }
          else { c.state = 'recover'; c.t = 0; c.goal = newGoal(c); }
        }
        break;
      }
      case 'recover': { // steady itself, turn toward somewhere new, then go
        c.spin *= Math.exp(-dt * 5); c.h += c.spin * dt;
        c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= Math.exp(-dt * 3); c.vy *= Math.exp(-dt * 3);
        const g = goalPoint(c.goal);
        c.h += angDiff(c.h, Math.atan2(g.y - c.y, g.x - c.x)) * (1 - Math.exp(-dt * 3));
        if (!K.rot) c.tilt = lerp(angDiff(0, c.tilt), Math.sin(c.t * 9) * 0.12 * Math.max(0, 1 - c.t), 1 - Math.exp(-dt * 5));
        if (c.t > 0.85) { c.state = 'cruise'; c.mul = 0.3; }
        break;
      }
      case 'away': {
        if (c.t > c.wait) {
          c.state = 'return'; c.mul = 0.45;
          c.goal = { type: 'point', x: clamp(c.x, W * 0.18, W * 0.82), y: clamp(c.y, H * 0.18, H * 0.75) };
          c.h = Math.atan2(c.goal.y - c.y, c.goal.x - c.x);
          if (!K.rot) c.tilt = 0;
        }
        break;
      }
    }
  }

  // lasers
  for (let i = lasers.length - 1; i >= 0; i--) {
    const l = lasers[i];
    l.t += dt; l.x += l.vx * dt; l.y += l.vy * dt;
    let gone = l.t > 1.3 || l.x < -60 || l.x > W + 60 || l.y < -60 || l.y > H + 60;
    if (!gone) for (const c of crafts) {
      if (c.team === l.team || c.team === 'astro' || Math.abs(c.s - l.s) > 0.45) continue;
      if (Math.hypot(c.x - l.x, c.y - l.y) < c.size * 0.38) {
        if (l.miss ??= Math.random() < 0.45) continue; // plenty of near misses, like any good dogfight
        sparks(l.x, l.y, c.s, l.team === 'human' ? '#ff6a4a' : '#7dff8a', 7);
        c.hp--; c.flash = 0.12; gone = true;
        if (c.hp <= 0) explode(c);
        break;
      }
    }
    if (gone) lasers.splice(i, 1);
  }

  // particles + booms
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    if (p.t > p.life) { parts.splice(i, 1); continue; }
    const drag = Math.exp(-dt * p.drag); p.vx *= drag; p.vy *= drag; p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = booms.length - 1; i >= 0; i--) { booms[i].t += dt; if (booms[i].t > 0.7) booms.splice(i, 1); }
  shake = Math.max(0, shake - dt);
}

/* ================= explosions ================= */
function sparks(x, y, s, color, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(40, 160) * s;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(0.15, 0.35), size: Math.max(1, s * 1.2), kind: 'spark', color, drag: 4, key: s + 0.01 });
  }
}
function explode(c, planet) {
  remove(c);
  const s = c.s, key = planet ? planet.depth + 0.004 : s + 0.01;
  booms.push({ x: c.x, y: c.y, s, t: 0, key });
  for (let i = 0; i < 44; i++) {
    const a = rand(0, TAU), sp = rand(30, 220) * s * (0.6 + speedScale * 0.4);
    parts.push({ x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(0.45, 1.25), size: rand(1, 2.6) * Math.max(0.6, s), kind: 'fire', drag: 2.4, key });
  }
  for (let i = 0; i < 9; i++) {
    const a = rand(0, TAU), sp = rand(40, 130) * s;
    parts.push({ x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(1.4, 2.4), size: Math.max(1, s * 1.4), kind: 'debris', color: pick([COL.l, COL.g, COL.d, COL.w]), drag: 0.8, key });
  }
  for (let i = 0; i < 7; i++) {
    const a = rand(0, TAU), sp = rand(8, 40) * s;
    parts.push({ x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(1, 1.9), size: rand(2.5, 4.5) * Math.max(0.6, s), kind: 'smoke', drag: 1.5, key: key - 0.002 });
  }
  if (planet) for (let i = 0; i < 14; i++) { // a puff of dust off the planet's surface
    const a = rand(0, TAU), sp = rand(20, 90) * s;
    parts.push({ x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(0.8, 1.6), size: Math.max(1, s * 1.6), kind: 'debris', color: pick(planet.pal.slice(2)), drag: 1.8, key });
  }
  shake = Math.max(shake, 0.18 + 0.12 * s);
}
const FIRE = ['#fff6c8', '#ffd23f', '#f28a36', '#e04a3a', '#6a2a20'];
function drawPart(p) {
  const k = p.t / p.life, x = p.x / PIX, y = p.y / PIX;
  let col = p.color, size = p.size;
  if (p.kind === 'fire') col = FIRE[Math.min(4, Math.floor(k * 5))];
  if (p.kind === 'smoke') { col = '#2a2f3a'; size = p.size * (1 + k * 1.6); ctx.globalAlpha = 0.75 * (1 - k); }
  if (p.kind === 'spark' || p.kind === 'debris') ctx.globalAlpha = Math.min(1, (1 - k) * 2);
  ctx.fillStyle = col;
  const sz = Math.max(1, Math.round(size));
  ctx.fillRect(Math.round(x - sz / 2), Math.round(y - sz / 2), sz, sz);
  ctx.globalAlpha = 1;
}
function drawBoom(b) {
  const cx = Math.round(b.x / PIX), cy = Math.round(b.y / PIX), s = Math.max(0.5, b.s);
  if (b.t < 0.16) { // the flash
    const r = Math.round((2 + b.t * 55) * s);
    ctx.fillStyle = b.t < 0.06 ? '#ffffff' : '#fff6c8';
    for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); ctx.fillRect(cx - w, cy + dy, w * 2 + 1, 1); }
  }
  if (b.t < 0.6) { // the shock ring
    const r = (3 + b.t * 48) * s, n = Math.max(12, Math.round(r * 5));
    ctx.globalAlpha = 1 - b.t / 0.6; ctx.fillStyle = b.t < 0.25 ? '#ffd23f' : '#f28a36';
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1); }
    ctx.globalAlpha = 1;
  }
}

/* ================= drawing ================= */
function drawCraft(c) {
  const K = c.K, sc = c.s * SPR;
  const bob = K.bob && c.state !== 'held' ? Math.sin(time * 2.2 + c.seed) * 0.8 : 0;
  const ang = c.team === 'astro' ? c.h : K.rot ? snap16(c.h + Math.PI / 2) : c.tilt;
  ctx.save();
  ctx.translate(Math.round(c.x / PIX), Math.round(c.y / PIX + bob));
  ctx.rotate(ang); ctx.scale(sc, sc);
  const spr = K.frames[K.frames.length > 1 ? Math.floor(time * 3 + c.seed) % K.frames.length : 0];
  if (K.flames && c.state !== 'held' && c.state !== 'thrown' && c.state !== 'away') {
    const flick = hash3(Math.floor(time * 18), Math.floor(c.seed * 10), 3);
    const L = 2 + Math.round(flick * 3) + (c.state === 'flee' || c.state === 'hunt' || c.state === 'launch' ? 2 : 0);
    for (const f of K.flames) for (let i = 0; i < L; i++) {
      ctx.fillStyle = i < 1 ? COL.p : i < L * 0.45 ? COL.y : i < L * 0.75 ? COL.o : COL.r;
      const ww = Math.max(1, f.w - Math.floor((i / L) * f.w));
      ctx.fillRect(f.x - ww / 2, spr.height / 2 + i, ww, 1);
    }
  }
  if (c.flash > 0) ctx.filter = 'brightness(2.6)';
  ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
  ctx.filter = 'none';
  ctx.restore();
}
function drawLaser(l) {
  const sp = Math.hypot(l.vx, l.vy) || 1, dx = l.vx / sp, dy = l.vy / sp, len = Math.max(3, Math.round(7 * l.s));
  const x = l.x / PIX, y = l.y / PIX;
  for (let i = 0; i < len; i++) {
    ctx.fillStyle = i < 2 ? (l.team === 'human' ? '#ffd8c8' : '#e2ffe0') : (l.team === 'human' ? '#ff4a3a' : '#5dff6a');
    ctx.fillRect(Math.round(x - dx * i), Math.round(y - dy * i), 1, 1);
  }
}
function keyOf(c) {
  let k = c.s;
  if (c.state === 'launch' && c.origin) k = Math.max(k, c.origin.depth + 0.003);  // lifting off: in front of its planet
  if (c.goal?.type === 'planet' && c.state !== 'thrown') k = Math.max(k, c.goal.p.depth + 0.003); // coming in to land
  if (c.state === 'thrown' && c.doom) k = Math.max(k, c.doom.depth + 0.003);
  if (c.state === 'held') k = 9;
  return k;
}
function render(dt) {
  const sx = shake > 0 ? Math.round(rand(-2, 2) * shake * 6) : 0, sy = shake > 0 ? Math.round(rand(-2, 2) * shake * 6) : 0;
  ctx.setTransform(1, 0, 0, 1, sx, sy);
  ctx.imageSmoothingEnabled = false;
  drawSky(dt);
  for (const p of PLANETS) { p.x = p.bx + par.x * (1 - p.depth) * 0.6; p.y = p.by + par.y * (1 - p.depth) * 0.6; }
  const list = [];
  for (const p of PLANETS) list.push({ k: p.depth, f: () => drawPlanet(p) });
  for (const c of crafts) list.push({ k: keyOf(c), f: () => drawCraft(c) });
  for (const b of booms) list.push({ k: b.key + 0.001, f: () => drawBoom(b) });
  for (const p of parts) list.push({ k: p.key, f: () => drawPart(p) });
  list.sort((a, b) => a.k - b.k).forEach(o => o.f());
  for (const l of lasers) drawLaser(l);
}

/* ================= the title: same face and size as the name over the pond ================= */
const meter = document.createElement('canvas').getContext('2d');
function layoutTitle() {
  if (!title) return;
  const top = (bar?.getBoundingClientRect().bottom || 70) + 16, bottom = H - Math.max(56, H * 0.08);
  const two = W / H < 1.25, lines = two ? ['Kolos', 'Varga'] : ['Kolos Varga'];
  meter.font = '400 100px "Young Serif", Georgia, serif';
  const widest = Math.max(...lines.map(l => meter.measureText(l).width));
  let size = Math.min((W * (two ? 0.84 : 0.8) / widest) * 100, ((bottom - top) * (two ? 0.72 : 0.5)) / (lines.length * 0.9));
  size = Math.min(size, (W * 0.9 / meter.measureText('Projects').width) * 100); // "Projects" is longer than "Kolos" on a phone
  title.style.fontSize = `${size}px`;
  title.style.top = `${(top + bottom) / 2 - (size * 0.9) / 2}px`;
}

/* ================= grab + throw ================= */
let held = null;
const samples = [];
const local = e => { const r = hero.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function hitTest(x, y) {
  let best = null;
  for (const c of crafts) {
    if (c.state === 'away') continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < c.size * 0.55 + (coarse ? 18 : 6) && (!best || c.s > best.s)) best = c;
  }
  return best;
}
function grab(e) {
  if (held || reduceMotion) return; // one craft at a time; ignore extra fingers
  const p = local(e), c = hitTest(p.x, p.y);
  if (!c) return;
  held = c;
  if (c.partner) { const o = c.partner; c.partner = null; o.partner = null; endChase(o); }
  c.chase = false; c.state = 'held'; c.doom = null; c.origin = null;
  c.ox = p.x - c.x; c.oy = p.y - c.y; c.vx = c.vy = 0; c.spin = 0;
  if (c.goal?.type === 'planet') c.s = Math.max(c.s, 0.35);
  samples.length = 0; samples.push({ x: p.x, y: p.y, t: performance.now() });
  canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
  hint?.classList.add('gone');
  e.preventDefault();
}
function move(e) {
  const p = local(e);
  if (!coarse) { par.tx = (p.x / W - 0.5) * -24; par.ty = (p.y / H - 0.5) * -16; }
  if (!held) { if (!coarse) canvas.style.cursor = hitTest(p.x, p.y) ? 'grab' : ''; return; }
  const c = held, now = performance.now(), last = samples[samples.length - 1];
  c.x = p.x - c.ox; c.y = p.y - c.oy; // the craft is the cursor while it's held
  samples.push({ x: p.x, y: p.y, t: now });
  while (samples.length > 2 && now - samples[0].t > 110) samples.shift();
  const vx = (p.x - last.x) / Math.max(1, now - last.t) * 1000, vy = (p.y - last.y) / Math.max(1, now - last.t) * 1000;
  if (c.K.rot && Math.hypot(vx, vy) > 220) c.h += angDiff(c.h, Math.atan2(vy, vx)) * 0.25; // dragged nose-first
  if (!c.K.rot && c.team !== 'astro') c.tilt = lerp(c.tilt, clamp(vx / 1500, -0.5, 0.5), 0.3);
}
function release(e) {
  if (!held) return;
  const c = held; held = null; canvas.style.cursor = '';
  const now = performance.now(), a = samples[0], b = samples[samples.length - 1];
  let vx = 0, vy = 0;
  if (a && b && now - b.t < 70 && b.t > a.t) { vx = (b.x - a.x) / (b.t - a.t) * 1000; vy = (b.y - a.y) / (b.t - a.t) * 1000; }
  const sp = Math.hypot(vx, vy);
  if (sp > 2600) { vx *= 2600 / sp; vy *= 2600 / sp; }
  c.vx = vx; c.vy = vy; c.t = 0;
  if (sp < 90) {
    if (c.team === 'astro') { c.state = 'drift'; c.vx = rand(-12, 12); c.vy = rand(-6, 6); }
    else { c.state = 'recover'; c.goal = newGoal(c); }
    return;
  }
  c.state = 'thrown'; c.spin = (Math.random() < 0.5 ? -1 : 1) * Math.min(14, sp / 180);
  // is it heading for a planet? (where the throw's line passes closest to each planet, within ~1.4 s)
  let best = null, bt = Infinity;
  for (const p of PLANETS) {
    const dx = p.x - c.x, dy = p.y - c.y, t = (dx * vx + dy * vy) / (sp * sp);
    if (t <= 0 || t > 1.4 || sp < 240) continue;
    const miss = Math.hypot(c.x + vx * t - p.x, c.y + vy * t - p.y);
    if (miss < p.r * 1.05 + 24 && t < bt) { best = p; bt = t; }
  }
  if (best) { c.doom = best; c.s0 = c.s; c.d0 = Math.hypot(best.x - c.x, best.y - c.y); }
}
canvas.addEventListener('pointerdown', grab);
canvas.addEventListener('pointermove', move);
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', () => { par.tx = par.ty = 0; });
// on touch screens, a finger that lands on a craft holds it instead of scrolling the page
canvas.addEventListener('touchstart', e => { if (held) e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', e => { if (held) e.preventDefault(); }, { passive: false });

/* ================= run ================= */
if (new URLSearchParams(location.search).has('debug')) window.__space = { crafts: () => crafts, planets: PLANETS, startChase, step: dt => step(0, dt), parts: () => parts, lasers: () => lasers };
let spawnT = 1.5, astroT = rand(4, 8), chaseT = rand(4, 6), planetT = 0;
const target = () => (W > 1000 ? 6 : W > 640 ? 5 : 3);
function step(t, dt) {
  dt = Math.min(dt, 0.05); time += dt;
  par.x = lerp(par.x, par.tx, 1 - Math.exp(-dt * 2)); par.y = lerp(par.y, par.ty, 1 - Math.exp(-dt * 2));
  spawnT -= dt; astroT -= dt; chaseT -= dt; planetT -= dt;
  if (spawnT <= 0) {
    const n = crafts.filter(c => !c.chase && c.team !== 'astro').length;
    if (n < target()) (Math.random() < 0.45 ? spawnLaunch() : spawnEdge());
    spawnT = rand(1.2, 3.2);
  }
  if (astroT <= 0) { if (crafts.filter(c => c.team === 'astro').length < (W > 700 ? 2 : 1)) spawnAstro(); astroT = rand(9, 18); }
  if (chaseT <= 0) { if (!crafts.some(c => c.chase)) startChase(); chaseT = rand(14, 22); }
  if (planetT <= 0) { for (const p of PLANETS) { p.rot += p.spin * 0.12; renderPlanet(p); } planetT = 0.12; }
  update(dt);
  render(dt);
}

function resize() {
  const r = hero.getBoundingClientRect(), oldW = W, oldH = H;
  W = r.width; H = r.height;
  if (!W || !H) return;
  PIX = clamp(Math.round(Math.max(W, H) / 460), 2, 4);
  BW = Math.ceil(W / PIX); BH = Math.ceil(H / PIX);
  canvas.width = BW; canvas.height = BH;
  SPR = Math.max(1, 3.6 / PIX); // a sprite pixel stays about 3.6 CSS px wide on any screen
  speedScale = clamp(W / 1300, 0.55, 1.15);
  if (oldW) for (const c of crafts) { c.x *= W / oldW; c.y *= H / oldH; }
  layoutPlanets(); makeStars(); makeNebula(); layoutTitle();
  for (const p of PLANETS) { p.x = p.bx; p.y = p.by; }
}

function seed() { // a few craft already under way, so the scene never opens empty
  for (let i = 0; i < Math.min(4, target()); i++) {
    const c = spawnEdge();
    c.x = rand(0.12, 0.88) * W; c.y = rand(0.12, 0.8) * H;
    const g = goalPoint(c.goal); c.h = Math.atan2(g.y - c.y, g.x - c.x);
  }
}

document.fonts.load('400 100px "Young Serif"').catch(() => {}).finally(() => layoutTitle());
resize();
seed();
render(0); // paint straight away, before the first animation frame
let rq = false;
new ResizeObserver(() => { if (rq) return; rq = true; requestAnimationFrame(() => { rq = false; resize(); if (reduceMotion) render(0); }); }).observe(hero);

if (reduceMotion) {
  // one still frame: the planets, the stars, a few craft hanging in place
  hint?.remove();
  canvas.style.cursor = 'default';
  render(0);
} else {
  visibleLoop(hero, step, { fps: 60 });
}
}
