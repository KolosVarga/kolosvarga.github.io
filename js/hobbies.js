/* A smaller pond, in pixels: lily pads drift, fish idle underneath, dragonflies wander,
   and frogs hop between pads and now and then try their luck with a tongue.
   Everything is drawn into one low-resolution pixel buffer and scaled up with hard edges, like the intro's water. */
import { visibleLoop, reduceMotion, rand, clamp } from './site.js';

const scene = document.getElementById('eco');
const canvas = scene.querySelector('canvas');
const ctx = canvas.getContext('2d');
const TAU = Math.PI * 2;

const hex = h => { const n = parseInt(h.slice(1), 16); return (255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | (n >> 16); };
const C = {
  water: hex('#050909'), speck: [hex('#0c1716'), hex('#0e1a18'), hex('#132321')],
  ring: [hex('#1d2a2c'), hex('#334246'), hex('#5a6a70')],
  pad: [hex('#24a87f'), hex('#27b087'), hex('#209c77')], stripe: hex('#17785a'), padEdge: hex('#1a8a69'),
  lotus: hex('#eef6f2'), lotus2: hex('#cfdcd6'),
  frog: hex('#9bd46a'), frogDark: hex('#5f9e3e'), belly: hex('#d7efb4'), eye: hex('#08120c'), eyeW: hex('#eef6f2'), mouth: hex('#3f6e2a'),
  shadow: hex('#020404'), tongue: hex('#e2604a'), tongueTip: hex('#f28a7a'),
  dfly: hex('#5aa9c7'), dflyHead: hex('#2f6f86'), wing: hex('#a9c4cc'), wing2: hex('#6f8a92'),
  fish: [[hex('#f28a36'), hex('#c45f1c')], [hex('#f6e4c6'), hex('#f07a2a')], [hex('#f5c25e'), hex('#c99138')]],
};
const FROG_SIT = [
  '.GG...GG.',
  'GwEGGGEwG',
  'GGGGGGGGG',
  'DGmmmmmGD',
  'GGBBBBBGG',
  '.GGBBBGG.',
  'GG.....GG',
];
const FROG_JUMP = [
  '.GG...GG.',
  'GwEGGGEwG',
  'GGGGGGGGG',
  '.GBBBBBG.',
  '..GBBBG..',
  '.G.....G.',
  'G.......G',
];
const FROG_GULP = [
  '.GG...GG.',
  'GDDGGGDDG',
  'GGGGGGGGG',
  'DGmmmmmGD',
  'GBBBBBBBG',
  'GGBBBBBGG',
  'GG.....GG',
];
const SPR = { G: 'frog', D: 'frogDark', B: 'belly', E: 'eye', w: 'eyeW', m: 'mouth' };

let W = 0, H = 0, PIX = 3, buf = null, img = null, u32 = null;
let pads = [], frogs = [], flies = [], fish = [], ripples = [], specks = [];

function set(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; u32[y * W + x] = c; }

/* ---------- world ---------- */
function makePads() {
  const list = [], n = clamp(Math.round((W * H) / 4200), 6, 13);
  for (let t = 0; t < 400 && list.length < n; t++) {
    const r = rand(6, 12.5), x = rand(r + 4, W - r - 4), y = rand(r + 4, H - r - 4);
    if (list.every(p => Math.hypot(p.ax - x, p.ay - y) > p.r + r + 7)) list.push({ ax: x, ay: y, x, y, r, rot: rand(0, TAU), notch: rand(0.35, 0.55), seed: rand(0, 100), col: C.pad[list.length % 3], vx: 0, vy: 0, dip: 0, lotus: false });
  }
  if (list.length > 3) list[2].lotus = true;
  return list;
}
function makeFrog(pad) { return { pad, x: pad.x, y: pad.y, state: 'sit', timer: rand(2, 6), hop: null, tongue: null, cool: rand(1.5, 4), gulp: 0, blink: 0 }; }
function makeFly(edge = false) {
  const x = edge ? (Math.random() < 0.5 ? -4 : W + 4) : rand(10, W - 10), y = rand(8, H - 8);
  return { x, y, a: edge ? (x < 0 ? 0 : Math.PI) + rand(-0.5, 0.5) : rand(0, TAU), v: rand(18, 30), turn: 0, hover: 0, dart: 0, caught: false, seed: rand(0, 100) };
}
function makeFish(i) {
  const x = rand(10, W - 10), y = rand(10, H - 10), segs = Array.from({ length: 6 }, (_, k) => ({ x: x - k, y }));
  return { segs, a: rand(0, TAU), v: rand(4, 7), tx: rand(0, W), ty: rand(0, H), col: C.fish[i % C.fish.length] };
}
function build() {
  pads = makePads();
  const fc = Math.min(3, Math.max(2, Math.floor(pads.length / 3)));
  frogs = pads.filter(p => !p.lotus).slice(0, fc).map(makeFrog);
  flies = Array.from({ length: W > 220 ? 4 : 3 }, () => makeFly());
  fish = Array.from({ length: W > 220 ? 4 : 3 }, (_, i) => makeFish(i));
  specks = Array.from({ length: Math.round((W * H) / 90) }, () => ({ x: rand(0, W), y: rand(0, H), c: C.speck[Math.floor(rand(0, 3))], s: rand(0, 100) }));
  ripples = [];
}

function layout() {
  const r = scene.getBoundingClientRect();
  PIX = clamp(Math.round(r.width / 300), 2, 5);
  const nW = Math.max(60, Math.round(r.width / PIX)), nH = Math.max(40, Math.round(r.height / PIX));
  const first = !W;
  if (!first && Math.abs(nW - W) < 2 && Math.abs(nH - H) < 2) return;
  const sx = first ? 1 : nW / W, sy = first ? 1 : nH / H;
  W = nW; H = nH;
  canvas.width = W; canvas.height = H;
  img = ctx.createImageData(W, H); u32 = new Uint32Array(img.data.buffer);
  if (first) build();
  else { pads.forEach(p => { p.ax *= sx; p.ay *= sy; p.x *= sx; p.y *= sy; }); fish.forEach(f => f.segs.forEach(s => { s.x *= sx; s.y *= sy; })); flies.forEach(f => { f.x *= sx; f.y *= sy; }); }
}

/* ---------- behaviour ---------- */
const ripple = (x, y, s = 1) => { ripples.push({ x, y, t: 0, life: 1.6 + s, s }); if (ripples.length > 14) ripples.shift(); };
const freePads = frog => pads.filter(p => !p.lotus && !frogs.some(f => f !== frog && (f.pad === p || (f.hop && f.hop.to === p))));

function hopTo(f, to) {
  if (!to || f.state !== 'sit') return;
  f.state = 'hop'; f.tongue = null;
  f.hop = { from: { x: f.x, y: f.y }, to, t: 0, dur: clamp(Math.hypot(to.x - f.x, to.y - f.y) / 55, 0.45, 0.95) };
  f.pad.vx -= (to.x - f.x) * 0.15; f.pad.vy -= (to.y - f.y) * 0.15; // pushing off nudges the pad backwards
}

function updateFrog(f, dt) {
  if (f.state === 'sit') {
    f.x = f.pad.x; f.y = f.pad.y - 1;
    f.timer -= dt; f.cool -= dt; f.gulp = Math.max(0, f.gulp - dt);
    if (f.tongue) updateTongue(f, dt);
    else if (f.cool <= 0) {
      const near = flies.filter(d => !d.caught && Math.hypot(d.x - f.x, d.y - (f.y - 3)) < 34).sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
      f.cool = rand(0.3, 0.6);
      if (near && Math.random() < 0.35) { f.tongue = { fly: near, tx: near.x + Math.cos(near.a) * near.v * 0.1, ty: near.y + Math.sin(near.a) * near.v * 0.1, t: 0, ext: 0.13, ret: 0.2, hit: Math.random() < 0.45 }; f.cool = rand(3, 6); }
    }
    if (f.timer <= 0 && !f.tongue) {
      const options = freePads(f).filter(p => p !== f.pad && Math.hypot(p.x - f.x, p.y - f.y) < Math.max(70, W * 0.35));
      if (options.length) hopTo(f, options[Math.floor(rand(0, options.length))]);
      f.timer = rand(4, 10);
    }
  } else if (f.state === 'hop') {
    const h = f.hop; h.t += dt;
    const k = Math.min(1, h.t / h.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    f.x = h.from.x + (h.to.x - h.from.x) * e; f.y = h.from.y + (h.to.y - 1 - h.from.y) * e;
    f.z = Math.sin(k * Math.PI) * clamp(h.dur * 18, 7, 16);
    if (k >= 1) {
      f.state = 'sit'; f.pad = h.to; f.hop = null; f.z = 0;
      f.pad.dip = 1; f.pad.vx += (h.to.x - h.from.x) * 0.12; f.pad.vy += (h.to.y - h.from.y) * 0.12;
      ripple(f.pad.x, f.pad.y, 0.6);
    }
  }
}

function updateTongue(f, dt) {
  const tg = f.tongue; tg.t += dt;
  const mx = f.x, my = f.y - 3;
  if (tg.t < tg.ext) { tg.k = tg.t / tg.ext; }
  else {
    if (!tg.resolved) {
      tg.resolved = true;
      const d = tg.fly;
      if (tg.hit && !d.caught && flies.includes(d)) { d.caught = true; tg.tx = d.x; tg.ty = d.y; }
      else if (flies.includes(d)) { d.dart = 0.45; d.a = Math.atan2(d.y - my, d.x - mx) + rand(-0.4, 0.4); }
    }
    tg.k = 1 - Math.min(1, (tg.t - tg.ext) / tg.ret);
    if (tg.fly.caught) { tg.fly.x = mx + (tg.tx - mx) * tg.k; tg.fly.y = my + (tg.ty - my) * tg.k; }
    if (tg.t >= tg.ext + tg.ret) {
      if (tg.fly.caught) { flies.splice(flies.indexOf(tg.fly), 1); f.gulp = 0.5; setTimeout(() => flies.push(makeFly(true)), rand(3000, 7000)); }
      f.tongue = null;
    }
  }
}

function updateFly(d, dt, t) {
  if (d.caught) return;
  if (d.dart > 0) { d.dart -= dt; d.x += Math.cos(d.a) * 95 * dt; d.y += Math.sin(d.a) * 95 * dt; return; }
  if (d.hover > 0) { d.hover -= dt; d.x += Math.sin(t * 9 + d.seed) * 0.05; return; }
  if (Math.random() < dt * 0.25) d.hover = rand(0.5, 1.6);
  // wander: a slowly changing turn rate, steered back toward the middle near the edges
  d.turn += (Math.sin(t * 0.7 + d.seed) * 1.6 - d.turn) * dt * 1.5 + rand(-1, 1) * dt * 3;
  const m = 14;
  if (d.x < m || d.x > W - m || d.y < m || d.y > H - m) {
    const want = Math.atan2(H / 2 - d.y, W / 2 - d.x);
    let diff = want - d.a; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    d.a += diff * dt * 2.5;
  }
  d.a += d.turn * dt;
  const v = d.v * (0.7 + 0.3 * Math.sin(t * 1.3 + d.seed));
  d.x += Math.cos(d.a) * v * dt; d.y += Math.sin(d.a) * v * dt;
}

function updateFish(f, dt) {
  const h = f.segs[0];
  if (Math.hypot(f.tx - h.x, f.ty - h.y) < 6) { f.tx = rand(8, W - 8); f.ty = rand(8, H - 8); }
  const want = Math.atan2(f.ty - h.y, f.tx - h.x);
  let diff = Math.atan2(Math.sin(want - f.a), Math.cos(want - f.a));
  f.a += clamp(diff, -1, 1) * dt * 0.8;
  const v = f.v * (f.scare > 0 ? 4 : 1); f.scare = Math.max(0, (f.scare || 0) - dt);
  h.x += Math.cos(f.a) * v * dt; h.y += Math.sin(f.a) * v * dt;
  for (let i = 1; i < f.segs.length; i++) {
    const p = f.segs[i - 1], s = f.segs[i], dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy) || 1;
    s.x = p.x + (dx / d) * 1.2; s.y = p.y + (dy / d) * 1.2;
  }
}

function updatePads(dt, t) {
  for (const p of pads) {
    const hx = p.ax + Math.sin(t * 0.09 + p.seed) * 2.5, hy = p.ay + Math.cos(t * 0.07 + p.seed * 1.3) * 2;
    p.vx = (p.vx + (hx - p.x) * 1.2 * dt) * Math.exp(-dt * 1.8);
    p.vy = (p.vy + (hy - p.y) * 1.2 * dt) * Math.exp(-dt * 1.8);
    for (const r of ripples) {
      const dx = p.x - r.x, dy = p.y - r.y, d = Math.hypot(dx, dy) || 1, rad = r.t * 26;
      if (Math.abs(d - rad) < 5) { const f = (1 - r.t / r.life) * r.s * 6 * dt; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
    }
    p.x += p.vx * dt * 6; p.y += p.vy * dt * 6;
    p.rot += Math.sin(t * 0.13 + p.seed) * 0.02 * dt;
    p.dip = Math.max(0, p.dip - dt * 2.5);
  }
}

/* ---------- drawing ---------- */
function drawPad(p) {
  const r = p.r * (1 - p.dip * 0.08), R = Math.ceil(r) + 1;
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const d = Math.hypot(x, y);
    if (d > r) continue;
    let a = Math.atan2(y, x) - p.rot; a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) < p.notch / 2 && d > 1) continue;
    const px = Math.round(p.x + x), py = Math.round(p.y + y);
    set(px, py, d > r - 1 ? C.padEdge : ((px + py) % 3 === 0 ? C.stripe : p.col));
  }
  if (p.lotus) {
    const cx = Math.round(p.x - p.r * 0.2), cy = Math.round(p.y - p.r * 0.1);
    [[0, -3], [-2, -2], [2, -2], [-3, 0], [3, 0], [-2, 2], [2, 2], [0, 3]].forEach(([x, y]) => { set(cx + x, cy + y, C.lotus2); set(cx + x * 0.6, cy + y * 0.6, C.lotus); });
    set(cx, cy, C.pad[0]);
  }
}
function drawSprite(rows, x, y) {
  const ox = Math.round(x - 4), oy = Math.round(y - 6);
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const k = SPR[row[i]]; if (k) set(ox + i, oy + j, C[k]); } });
}
function line(x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 400; n++) { set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
function circle(cx, cy, r, c) {
  const n = Math.max(12, Math.round(r * 6));
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), c); }
}

function draw(t) {
  u32.fill(C.water);
  for (const s of specks) set(s.x + Math.sin(t * 0.2 + s.s) * 1.5, s.y + Math.cos(t * 0.17 + s.s) * 1.2, s.c);
  for (const f of fish) {
    const [body, mark] = f.col;
    f.segs.forEach((s, i) => { set(s.x, s.y, i === 1 ? mark : body); if (i < 3) { const a = f.a + Math.PI / 2; set(s.x + Math.cos(a) * 0.8, s.y + Math.sin(a) * 0.8, body); } });
    const tail = f.segs[f.segs.length - 1], a = f.a + Math.PI / 2, wag = Math.sin(t * 6 + f.v) * 0.6;
    set(tail.x + Math.cos(a) * (1 + wag), tail.y + Math.sin(a) * (1 + wag), body); set(tail.x - Math.cos(a) * (1 - wag), tail.y - Math.sin(a) * (1 - wag), body);
  }
  for (const r of ripples) {
    const k = r.t / r.life;
    circle(r.x, r.y, r.t * 26, C.ring[k < 0.3 ? 2 : k < 0.65 ? 1 : 0]);
  }
  pads.forEach(drawPad);
  for (const f of frogs) {
    if (f.state === 'hop') { line(f.x - 3, f.y + 1, f.x + 3, f.y + 1, C.shadow); line(f.x - 2, f.y + 2, f.x + 2, f.y + 2, C.shadow); drawSprite(FROG_JUMP, f.x, f.y - f.z); }
    else drawSprite(f.gulp > 0 ? FROG_GULP : FROG_SIT, f.x, f.y);
    if (f.tongue) {
      const tg = f.tongue, mx = f.x, my = f.y - 3, k = tg.k || 0;
      const ex = mx + (tg.tx - mx) * k, ey = my + (tg.ty - my) * k;
      line(mx, my, ex, ey, C.tongue); set(ex, ey, C.tongueTip);
    }
  }
  for (const d of flies) {
    const ca = Math.cos(d.a), sa = Math.sin(d.a), px = -sa, py = ca;
    set(d.x + 3, d.y + 4, C.shadow); set(d.x + 2, d.y + 4, C.shadow);
    const flap = Math.floor(t * 24 + d.seed) % 2;
    for (const off of [0.6, -0.6]) for (let w = 1; w <= 3 - (flap && off < 0 ? 1 : 0); w++) {
      set(d.x + ca * off + px * w, d.y + sa * off + py * w, w === 3 ? C.wing2 : C.wing);
      set(d.x + ca * off - px * w, d.y + sa * off - py * w, w === 3 ? C.wing2 : C.wing);
    }
    for (let k = -3; k <= 1; k++) set(d.x + ca * k, d.y + sa * k, C.dfly);
    set(d.x + ca * 2, d.y + sa * 2, C.dflyHead);
  }
  ctx.putImageData(img, 0, 0);
}

function step(t, dt) {
  for (const r of ripples) r.t += dt;
  ripples = ripples.filter(r => r.t < r.life);
  updatePads(dt, t);
  frogs.forEach(f => updateFrog(f, dt));
  flies.forEach(d => updateFly(d, dt, t));
  fish.forEach(f => updateFish(f, dt));
  draw(t);
}

/* ---------- start ---------- */
layout();
for (let i = 0; i < 40; i++) step(i / 30, 1 / 30); // settle so the first frame already looks lived-in
new ResizeObserver(() => { layout(); draw(performance.now() / 1000); }).observe(scene);

const toLocal = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
scene.addEventListener('pointerdown', e => {
  const [x, y] = toLocal(e);
  const pad = pads.find(p => !p.lotus && Math.hypot(p.x - x, p.y - y) < p.r + 2);
  if (pad && !frogs.some(f => f.pad === pad && f.state === 'sit')) {
    // the nearest frog that is sitting still hops over
    const f = frogs.filter(f => f.state === 'sit' && !f.tongue).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (f && freePads(f).includes(pad)) { hopTo(f, pad); f.timer = rand(5, 10); }
  } else {
    ripple(x, y, 1);
    fish.forEach(f => { const h = f.segs[0]; if (Math.hypot(h.x - x, h.y - y) < 40) { f.a = Math.atan2(h.y - y, h.x - x); f.tx = clamp(h.x + (h.x - x) * 2, 5, W - 5); f.ty = clamp(h.y + (h.y - y) * 2, 5, H - 5); f.scare = 0.8; } });
  }
  if (reduceMotion) draw(performance.now() / 1000);
});

if (!reduceMotion) visibleLoop(scene, step, { fps: 30 });
else draw(0);

/* ---------- a staff under "Trumpet & piano": notes lift as the cursor passes, like keys being pressed ---------- */
const staff = document.getElementById('staff');
if (staff) {
  const NS = 'http://www.w3.org/2000/svg', n = 34;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1000 54'); svg.setAttribute('preserveAspectRatio', 'none');
  for (let i = 0; i < 5; i++) { const l = document.createElementNS(NS, 'line'); l.setAttribute('x1', 0); l.setAttribute('x2', 1000); l.setAttribute('y1', 7 + i * 10); l.setAttribute('y2', 7 + i * 10); svg.appendChild(l); }
  const notes = [];
  let pitch = 4;
  for (let i = 0; i < n; i++) {
    pitch = clamp(pitch + Math.round(rand(-2, 2)), 0, 8);
    const e = document.createElementNS(NS, 'ellipse');
    e.setAttribute('cx', 20 + i * (960 / (n - 1))); e.setAttribute('cy', 47 - pitch * 5); e.setAttribute('rx', 5.5); e.setAttribute('ry', 4);
    e.setAttribute('class', 'nt'); svg.appendChild(e); notes.push(e);
  }
  staff.appendChild(svg);
  if (!reduceMotion) {
    staff.addEventListener('pointermove', ev => {
      const r = staff.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * 1000;
      notes.forEach(e => {
        const d = Math.abs(+e.getAttribute('cx') - x), k = Math.max(0, 1 - d / 70);
        e.style.transform = `translateY(${-k * 8}px)`; e.style.fill = k > 0.5 ? 'var(--jade)' : '';
      });
    });
    staff.addEventListener('pointerleave', () => notes.forEach(e => { e.style.transform = ''; e.style.fill = ''; }));
  }
}
