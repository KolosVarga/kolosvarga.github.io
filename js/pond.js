/* Koi pond intro.
   - The name lies on the pond bed (water.js bends it under ripples).
   - Koi wander; each has its own speed and "desire to react".
   - Buttons in the top bar tap the water: fish nearby swim over to see.
   - Clicking the pond drops a stone: ripples spread, nearby fish dart away, lily pads get nudged. */
import { createWater } from './water.js';

const { gsap } = window;
gsap.ticker.lagSmoothing(0); // keep the intro on real time even if a slow device drops frames
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pond = document.querySelector('.pond');
const waterCanvas = document.getElementById('water');
const surface = document.getElementById('surface');
const ctx = surface.getContext('2d');
const padCanvas = document.getElementById('pads');      // full resolution: fish, lily pads, lotus
const pctx = padCanvas.getContext('2d');
let SHARP = 1;                                           // device pixel ratio for the sharp pad layer
const bar = document.getElementById('bar');
const hint = document.getElementById('hint');

const PAL = {
  bed: '#050909', bedSpeck: ['#0a1312', '#0c1716', '#081010', '#0e1a18'],
  nameTop: '#30453f', nameBottom: '#1b2824', nameEdge: 'rgba(120,190,165,0.18)',
  // flat jade pads with a fine diagonal stripe, as in the reference
  pads: ['#24a87f', '#27b087', '#209c77'],
  stripe: 'rgba(3,45,30,0.32)',
  koiLine: 'rgba(205,222,236,0.95)', koiFill: 'rgba(14,20,28,0.88)', koiSolid: 'rgba(226,242,235,0.92)',
  ring: '165,182,192',
  speck: '200,214,222',
  petal: '#eef6f2', petalInner: '#ffffff', petalLine: 'rgba(10,50,36,0.35)', lotusCore: '#9fe3c6',
};

let W = 0, H = 0, DPR = 1, PIX = 2, minD = 1, unit = 1; // DPR here is the render scale: 1 / PIX, for the pixelated LCD look
let water = null;
let nameBox = { x: 0, y: 0, w: 0, h: 0 }, lotusSpot = { x: 0, y: 0 };
const ripples = [];
let koi = [], pads = [];
const reveal = { name: 0, life: 0 };

/* ================= pond bed + name ================= */
function barBottom() { const r = bar.getBoundingClientRect(); return r.bottom; }

function layoutName() {
  const top = barBottom() + 16, bottom = H - Math.max(56, H * 0.08);
  const two = W / H < 1.25;
  const lines = two ? ['Kolos', 'Varga'] : ['Kolos Varga'];
  const m = document.createElement('canvas').getContext('2d');
  m.font = '400 100px "Young Serif", Georgia, serif';
  const widest = Math.max(...lines.map(l => m.measureText(l).width));
  const lh = 0.9;
  const maxW = W * (two ? 0.84 : 0.8);
  const maxH = (bottom - top) * (two ? 0.72 : 0.5);
  const size = Math.min((maxW / widest) * 100, maxH / (lines.length * lh));
  const blockH = size * lh * lines.length;
  const cy = (top + bottom) / 2;
  return { lines, size, lh, cy, blockH, top, two, width: widest * size / 100 };
}

// The name heading: built once as letter spans (for the reveal), then sized and placed to match the layout.
const title = document.getElementById('title');
function buildTitle() {
  title.innerHTML = '';
  ['Kolos', 'Varga'].forEach((word, w) => {
    const line = document.createElement('span');
    line.className = 'line'; line.setAttribute('aria-hidden', 'true');
    for (const ch of word) { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; line.appendChild(s); }
    title.appendChild(line);
    if (w === 0) { const gap = document.createElement('span'); gap.className = 'gap'; gap.textContent = ' '; title.appendChild(gap); }
  });
}
buildTitle();
function placeTitle(L) {
  title.classList.toggle('stacked', L.two);
  title.style.fontSize = `${L.size}px`;
  title.style.lineHeight = String(L.lh);
  title.style.top = `${L.cy - L.blockH / 2}px`;
}

function buildBed() {
  const L = layoutName();
  const cw = Math.round(W * DPR), ch = Math.round(H * DPR);
  const bed = document.createElement('canvas'); bed.width = cw; bed.height = ch;
  const b = bed.getContext('2d');
  b.scale(DPR, DPR);
  const g = b.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
  g.addColorStop(0, '#0a1413'); g.addColorStop(1, PAL.bed);
  b.fillStyle = g; b.fillRect(0, 0, W, H);
  // pebbles and silt, barely visible
  for (let i = 0; i < (W * H) / 900; i++) {
    b.globalAlpha = rand(0.3, 0.9);
    b.fillStyle = PAL.bedSpeck[Math.floor(Math.random() * PAL.bedSpeck.length)];
    b.beginPath(); b.ellipse(rand(0, W), rand(0, H), rand(1, 6), rand(1, 4), rand(0, TAU), 0, TAU); b.fill();
  }
  b.globalAlpha = 1;

  // the name now floats above the pond as an HTML heading; the bed texture stays empty of text
  const name = document.createElement('canvas'); name.width = cw; name.height = ch;
  placeTitle(L);
  nameBox = { x: W / 2 - L.width / 2 - L.size * 0.08, y: L.cy - L.blockH / 2 - L.size * 0.08, w: L.width + L.size * 0.16, h: L.blockH + L.size * 0.16 };
  lotusSpot = L.two
    ? { x: W / 2 + L.width * 0.28, y: L.cy }
    : { x: W / 2 + L.width * 0.04, y: L.cy - L.size * 0.62 };
  return { bed, name };
}

/* ================= ripples ================= */
function addRipple(x, y, strength = 1, opts = {}) {
  ripples.push({ x, y, t: 0, strength, speed: opts.speed || minD * 0.15, life: opts.life || 5.5, rings: opts.rings || 3, radius: 0, amp: 0 });
  if (ripples.length > 40) ripples.shift();
}
function updateRipples(dt) {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.t += dt;
    r.radius = r.t * r.speed;
    const f = 1 - r.t / r.life;
    r.amp = r.strength * Math.max(0, f) * Math.max(0, f);
    if (r.t >= r.life) ripples.splice(i, 1);
  }
}
function drawRipples() {
  ctx.lineWidth = PIX;
  for (const r of ripples) {
    const f = 1 - r.t / r.life;
    for (let k = 0; k < r.rings; k++) {
      const rad = r.radius - k * minD * 0.035;
      if (rad <= 1) continue;
      const a = Math.pow(f, 1.3) * r.strength * (1 - k * 0.35) * 0.6;
      if (a <= 0.01) continue;
      ctx.strokeStyle = `rgba(${PAL.ring},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.stroke();
    }
  }
}

/* ================= koi =================
   Fish body simulation ported from Zongze Chen's "fish-body-simulation"
   (https://github.com/Zer02z2/creative-computing, code © 2024–2026 Zongze Chen, MIT licence).
   How it works:
   - an invisible "cube" wanders with random speed boosts and direction flips; a lagging chain smooths its path
   - the head follows the end of that chain; the body is a chain of circles of varying size
   - each joint is kept within a minimum angle, and a sine oscillation that grows toward the tail rides on top
   - fins and tail are small chains pinned to body joints and dragged along
   - the outline is a smooth curve around the circles */
// Orange koi varieties (the motion is the original's; the look is ours)
const KOI_LOOKS = {
  kohaku: { body: '#f6e4c6', outline: '#d6aa78', fin: 'rgba(250,222,186,0.6)', finLine: 'rgba(222,170,112,0.85)', patch: '#f07a2a', eye: '#2a1408' },
  orange: { body: '#f28a36', outline: '#c45f1c', fin: 'rgba(248,180,112,0.6)', finLine: 'rgba(214,120,52,0.85)', patch: '#fbe2b8', eye: '#2a1408' },
  gold:   { body: '#f5c25e', outline: '#c99138', fin: 'rgba(250,222,150,0.6)', finLine: 'rgba(214,164,74,0.85)', patch: null, eye: '#2a1408' },
  tancho: { body: '#f4eee4', outline: '#c9bba6', fin: 'rgba(244,238,228,0.55)', finLine: 'rgba(200,186,166,0.85)', patch: '#e2502a', eye: '#2a1408' },
};
const pickKoiLook = () => {
  const r = Math.random();
  const name = r < 0.45 ? 'kohaku' : r < 0.72 ? 'orange' : r < 0.86 ? 'gold' : 'tancho';
  const look = KOI_LOOKS[name];
  // patches sit on body circles (index along the body, offset across it, size relative to the body width)
  let patches = [];
  if (name === 'kohaku') patches = Array.from({ length: 2 + Math.floor(rand(0, 2)) }, () => ({ i: 2 + Math.floor(rand(0, 8)), s: rand(-0.3, 0.3), r: rand(0.35, 0.6) }));
  else if (name === 'orange') patches = Math.random() < 0.6 ? [{ i: 1, s: 0, r: 0.45 }] : [];
  else if (name === 'tancho') patches = [{ i: 1, s: 0, r: 0.32 }];
  return { look, patches };
};
const findAngleBetween = (a, b, c) => {
  const v1x = b.x - a.x, v1y = b.y - a.y, v2x = c.x - a.x, v2y = c.y - a.y;
  return Math.acos((v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y))) || 0;
};
const findTangent = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const isOnLeft = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0;
const mapRange = (v, a, b, c, d) => (d - c) * ((v - a) / (b - a)); // as in the original (no output offset)
const lerpTo = (a, b, t) => a + (b - a) * t;

class Circle {
  constructor(x, y, d) { this.x = x; this.y = y; this.d = d; }
  followMouse(mx, my, width, height) {
    const x = lerpTo(this.x, mx, 0.1), y = lerpTo(this.y, my, 0.1);
    const radian = findTangent(this, { x, y }) + 0.5 * Math.PI;
    const factor = mapRange(Math.hypot(mx - this.x, my - this.y), 0, Math.hypot(width, height), 0, 1);
    const dx = Math.cos(radian) * factor, dy = Math.sin(radian) * factor;
    this.x = x + dx; this.y = y + dy;
    return Math.hypot(dx, dy);
  }
  followBody(target, targetOfTarget, gap, smallestAngle, oscillate) {
    this.pull(target, gap, oscillate);
    if (targetOfTarget) this.constrainAngle(target, targetOfTarget, gap, smallestAngle);
  }
  teleport(x, y) { this.x = x; this.y = y; }
  pull(target, gap, oscillate) {
    let radian = findTangent(target, this);
    if (oscillate) radian += oscillate;
    this.x = target.x + gap * Math.cos(radian); this.y = target.y + gap * Math.sin(radian);
  }
  constrainAngle(center, other, gap, smallestAngle) {
    const delta = findAngleBetween(center, this, other);
    if (delta < smallestAngle) {
      const otherRadian = findTangent(center, other);
      const radian = isOnLeft(center, other, this) ? otherRadian + smallestAngle : otherRadian - smallestAngle;
      this.x = center.x + gap * Math.cos(radian); this.y = center.y + gap * Math.sin(radian);
    }
    if (delta !== Math.PI) { // ease back toward straight
      const ideal = findTangent(other, center) + Math.PI, current = findTangent(center, this);
      const diff = Math.abs(ideal - current);
      const radian = isOnLeft(center, other, this) ? current + diff * 0.001 : current - diff * 0.001;
      this.x = center.x + gap * Math.cos(radian); this.y = center.y + gap * Math.sin(radian);
    }
  }
}

class Chain {
  constructor(x, y, gap, angleDeg, sizes) {
    this.gap = gap; this.smallestAngle = angleDeg * Math.PI / 180; this.frameCount = 0;
    this.circles = sizes.map((s, i) => new Circle(x + gap * i, y, s));
  }
  freeMove(x, y, width, height) {
    const acc = this.circles[0].followMouse(x, y, width, height);
    this.frameCount += 25 * Math.log(0.3 * acc + 1);
    const scale = (Math.PI / 5) * Math.log(2 * acc + 1);
    const n = this.circles.length;
    for (let i = 1; i < n; i++) {
      const osc = Math.sin(this.frameCount + i * n * Math.PI * 1.1368) * scale * mapRange(i, 0, n, 0.5, 3);
      this.circles[i].followBody(this.circles[i - 1], this.circles[i - 2], this.gap, this.smallestAngle, osc);
    }
  }
  constrainMove(x, y, idealRadian, strength = 0.7) {
    const c = this.circles;
    c[0].teleport(x, y);
    const ideal = { x: x + this.gap * Math.cos(idealRadian), y: y + this.gap * Math.sin(idealRadian) };
    const origin = { x, y };
    const delta = findAngleBetween(origin, c[1], ideal);
    const radian = findTangent(origin, c[1]) + (isOnLeft(origin, ideal, c[1]) ? -1 : 1) * delta * strength;
    c[1].teleport(x + this.gap * Math.cos(radian), y + this.gap * Math.sin(radian));
    for (let i = 2; i < c.length; i++) c[i].followBody(c[i - 1], c[i - 2], this.gap, this.smallestAngle);
  }
  simpleMove(x, y, width, height) {
    const c = this.circles;
    c[0].followMouse(x, y, width, height);
    for (let i = 1; i < c.length; i++) c[i].followBody(c[i - 1], c[i - 2], this.gap, this.smallestAngle);
  }
  drawOutline(ctx, pathOnly = false) {
    const c = this.circles, n = c.length, pts = [];
    const at = (circle, radian) => ({ x: circle.x + (circle.d / 2) * Math.cos(radian), y: circle.y + (circle.d / 2) * Math.sin(radian) });
    for (let i = 0; i < n; i++) {
      let radian;
      if (i !== 0 && i !== n - 1) {
        const delta = findAngleBetween(c[i], c[i + 1], c[i - 1]), alpha = findTangent(c[i], c[i - 1]);
        radian = isOnLeft(c[i], c[i + 1], c[i - 1]) ? alpha - delta / 2 : alpha - (2 * Math.PI - delta) / 2;
      } else if (i === 0) radian = findTangent(c[i], c[i + 1]) + 0.5 * Math.PI;
      else radian = findTangent(c[i], c[i - 1]) - 0.5 * Math.PI;
      if (i === 0) pts.push(at(c[i], findTangent(c[i], c[i + 1]) - 0.5 * Math.PI));
      pts.push(at(c[i], radian));
    }
    for (let i = n - 1; i >= 0; i--) {
      let radian;
      if (i !== 0 && i !== n - 1) {
        const delta = findAngleBetween(c[i], c[i - 1], c[i + 1]), alpha = findTangent(c[i], c[i + 1]);
        radian = isOnLeft(c[i], c[i - 1], c[i + 1]) ? alpha - delta / 2 : alpha - (2 * Math.PI - delta) / 2;
        if (i === 1) pts.unshift(at(c[i], radian));
      } else if (i === 0) radian = findTangent(c[i], c[i + 1]) - 0.5 * Math.PI;
      else radian = findTangent(c[i], c[i - 1]) + 0.5 * Math.PI;
      pts.push(at(c[i], radian));
    }
    const L = pts.length;
    ctx.beginPath();
    ctx.moveTo((pts[0].x + pts[L - 1].x) / 2, (pts[0].y + pts[L - 1].y) / 2);
    for (let i = 1; i < L - 2; i++) ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    ctx.closePath();
    if (pathOnly) return;
    ctx.stroke();
    ctx.fill();
  }
}

class Cube { // the invisible wanderer that each fish chases
  constructor(x, y, vMax) {
    this.x = x; this.y = y; this.vMax = vMax; this.vMin = vMax * 0.1; this.vDash = vMax * 2;
    this.vX = rand(0, vMax); this.vY = rand(0, vMax);
    this.w = W * 0.01; this.h = this.w;
    this.dirX = Math.random() < 0.5 ? 1 : -1; this.dirY = Math.random() < 0.5 ? 1 : -1;
    this.pBoost = 0.005; this.pTurn = 0.001;
    this.chain = new Chain(x, y, vMax, 160, new Array(12).fill(0));
  }
  update(xb, yb, checkBound = true) {
    if (Math.random() < this.pBoost || this.vX - this.vMin <= 0.002) { this.vX = rand(this.vMax / 2, this.vMax); this.dirX *= Math.random() < 0.2 ? -1 : 1; }
    if (Math.random() < this.pBoost || this.vY - this.vMin <= 0.002) { this.vY = rand(this.vMax / 2, this.vMax); this.dirY *= Math.random() < 0.2 ? -1 : 1; }
    if (this.vX > this.vMin) this.vX -= (this.vX - this.vMin) * rand(0.01, 0.02);
    if (this.vY > this.vMin) this.vY -= (this.vY - this.vMin) * rand(0.01, 0.02);
    if (Math.random() < this.pTurn) this.dirX *= -1;
    if (Math.random() < this.pTurn) this.dirY *= -1;
    this.x += this.vX * this.dirX; this.y += this.vY * this.dirY;
    if (checkBound) {
      if (this.x + this.w / 2 >= xb) { this.x = xb - this.w / 2; this.dirX *= -1; }
      else if (this.x - this.w / 2 <= 0) { this.x = this.w / 2; this.dirX *= -1; }
      else if (this.y + this.h / 2 >= yb) { this.y = yb - this.h / 2; this.dirY *= -1; }
      else if (this.y - this.h / 2 <= 0) { this.y = this.h / 2; this.dirY *= -1; }
    }
    this.chain.simpleMove(this.x, this.y, xb, yb);
  }
  dash(radian) {
    const vx = this.vDash * Math.cos(radian), vy = this.vDash * Math.sin(radian);
    this.vX = Math.abs(vx); this.vY = Math.abs(vy); this.dirX = vx >= 0 ? 1 : -1; this.dirY = vy >= 0 ? 1 : -1;
  }
  chase(x, y) {
    let dx = x - this.x, dy = y - this.y;
    const mag = Math.hypot(dx, dy);
    if (mag < 1) return;
    if (mag > this.vMax) { dx *= (this.vMax / mag) * 1.2; dy *= (this.vMax / mag) * 1.2; }
    this.vX += Math.abs(dx) * 0.01; this.dirX = this.x < x ? 1 : -1;
    this.vY += Math.abs(dy) * 0.01; this.dirY = this.y < y ? 1 : -1;
  }
  getPosition() { const c = this.chain.circles; return c[c.length - 1]; }
}

const BODY_POINTS = [0.326, 0.641, 0.817, 0.9, 0.97, 0.957, 0.872, 0.787, 0.702, 0.618, 0.516, 0.414, 0.316, 0.219];
const FIN_POINTS = [0.226, 0.217, 0.334, 0.476, 0.424, 0.355, 0.11];
const TAIL_POINTS = [0.326, 0.321, 0.32, 0.294, 0.283, 0.216, 0.155, 0.09];
const BACKFIN_POINTS = [0.5, 0.5, 0.5];

class Fish {
  constructor(x, y, length, width) {
    this.gap = length / BODY_POINTS.length;
    this.body = new Chain(x, y, this.gap, 165, BODY_POINTS.map(d => d * width));
    this.cube = new Cube(x, y, width * 0.15);
    this.bounds = { left: x, right: x, top: y, bottom: y };
    const finRadian = Math.PI / 1.8;
    this.fins = [2, 2, 6, 6].map((position, index) => {
      const f = BODY_POINTS[position] * 0.8;
      const sizes = FIN_POINTS.map(d => d * width * (index <= 1 ? 1.5 : 1) * f);
      return { chain: new Chain(x, y, this.gap * 2.5 * (width / length), (index <= 1 ? 175 : 155) + 20 * (width / length), sizes), position, radian: finRadian * (index % 2 === 0 ? 1 : -1) * f };
    });
    this.tails = [12, 12].map((position, index) => ({
      chain: new Chain(x, y, this.gap * 0.5 * rand(0.7, 0.9), 120, TAIL_POINTS.map(d => width * d)),
      radian: rand(0, Math.PI / 5) * (index % 2 === 0 ? 1 : -1), position
    }));
    this.backFins = [3].map(position => ({ chain: new Chain(x, y, this.gap * 1.5, 120, BACKFIN_POINTS.map(() => 0)), radian: 0, position }));
    this.rippleCooldown = rand(400, 800); this.lastRipple = performance.now();
  }
  update() { this.cube.update(W, H, true); }
  move() {
    const { x, y } = this.cube.getPosition();
    const bc = this.body.circles;
    this.body.freeMove(x, y, W, H);
    this.backFins.forEach(b => b.chain.constrainMove(bc[b.position].x, bc[b.position].y, findTangent(bc[b.position], bc[b.position + 1]) + b.radian, 0));
    this.fins.forEach((f, i) => f.chain.constrainMove(bc[f.position].x, bc[f.position].y, findTangent(bc[f.position], bc[f.position + 1]) + f.radian, i <= 1 ? 0.3 : 0.8));
    this.tails.forEach(t => t.chain.constrainMove(bc[t.position].x, bc[t.position].y, findTangent(bc[t.position], bc[t.position + 1]) + t.radian, 0.3));
    const xs = bc.map(c => c.x), ys = bc.map(c => c.y);
    this.bounds = { left: Math.min(...xs) - this.gap, right: Math.max(...xs) + this.gap, top: Math.min(...ys) - this.gap, bottom: Math.max(...ys) + this.gap };
  }
  chase(x, y) { this.cube.chase(x, y); }
  draw(ctx, lw) {
    const C = this.look;
    ctx.lineJoin = 'round';
    // translucent fins and tail streamers
    ctx.strokeStyle = C.finLine; ctx.lineWidth = lw * 0.75;
    ctx.fillStyle = C.fin;
    this.fins.forEach(f => f.chain.drawOutline(ctx));
    this.tails.forEach(t => t.chain.drawOutline(ctx));
    // body, then its markings clipped to the body
    ctx.strokeStyle = C.outline; ctx.lineWidth = lw;
    ctx.fillStyle = C.body; this.body.drawOutline(ctx);
    if (C.patch && this.patches.length) {
      ctx.save(); this.body.drawOutline(ctx, true); ctx.clip();
      ctx.fillStyle = C.patch;
      const bc = this.body.circles;
      this.patches.forEach(p => {
        const c = bc[p.i], n = bc[Math.min(bc.length - 1, p.i + 1)], ang = findTangent(c, n);
        const ox = -Math.sin(ang) * c.d * p.s, oy = Math.cos(ang) * c.d * p.s;
        ctx.beginPath(); ctx.ellipse(c.x + ox, c.y + oy, this.gap * 1.6 * (p.r + 0.4), c.d * p.r, ang, 0, TAU); ctx.fill();
      });
      ctx.restore();
      ctx.strokeStyle = C.outline; this.body.drawOutline(ctx, true); ctx.stroke();
    }
    // dorsal fin
    ctx.lineWidth = lw / 2; ctx.fillStyle = C.fin; ctx.strokeStyle = C.finLine;
    this.backFins.forEach(b => {
      const pts = this.body.circles, end = b.position + BACKFIN_POINTS.length + 1;
      const tip = b.chain.circles[BACKFIN_POINTS.length - 1], start = pts[b.position + 1], stop = pts[end];
      ctx.beginPath(); ctx.moveTo(start.x, start.y);
      ctx.quadraticCurveTo(tip.x, tip.y, stop.x, stop.y);
      for (let i = end; i >= b.position + 2; i--) ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i - 1].x) / 2, (pts[i].y + pts[i - 1].y) / 2);
      ctx.quadraticCurveTo(pts[b.position + 2].x, pts[b.position + 2].y, start.x, start.y);
      ctx.fill(); ctx.stroke();
    });
    // eyes
    ctx.fillStyle = C.eye; ctx.strokeStyle = C.body;
    const c0 = this.body.circles[0], c1 = this.body.circles[1], r = findTangent(c0, c1);
    [r + Math.PI / 4, r - Math.PI / 4].forEach(er => {
      const d = this.body.circles[2].d * 0.5;
      ctx.beginPath(); ctx.arc(c0.x + d * Math.cos(er), c0.y + d * Math.sin(er), (this.gap * 0.4) / 2, 0, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
    });
  }
  triggerDash() { this.cube.dash(Math.atan2(this.cube.vY * this.cube.dirY, this.cube.vX * this.cube.dirX)); }
  triggerDirectionalDash(x, y) {
    const cx = (this.bounds.left + this.bounds.right) / 2, cy = (this.bounds.top + this.bounds.bottom) / 2;
    this.cube.dash(findTangent({ x: cx, y: cy }, { x, y }) + Math.PI);
  }
  velocity() { return Math.hypot(this.cube.vX, this.cube.vY); }
  isDashing() { return this.velocity() > this.cube.vMax; }
  contains(x, y) { return x > this.bounds.left && x < this.bounds.right && y > this.bounds.top && y < this.bounds.bottom; }
  overlaps(o) { const a = this.bounds, b = o.bounds; return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top); }
  rescale(sx, sy) {
    const all = [this.body, this.cube.chain, ...this.fins.map(f => f.chain), ...this.tails.map(t => t.chain), ...this.backFins.map(b => b.chain)];
    all.forEach(ch => ch.circles.forEach(c => { c.x *= sx; c.y *= sy; }));
    this.cube.x *= sx; this.cube.y *= sy;
  }
}

// Wraps a Fish with the pond's behaviours: being called to food, startled by stones, dashing on hover.
class Koi {
  constructor() {
    const fishSize = Math.hypot(W, H) * 0.015 * rand(0.8, 1.2);
    const length = fishSize * rand(6, 8.5);
    this.fish = new Fish(rand(0, W), rand(barBottom(), H), length, length * rand(0.2, 0.24));
    Object.assign(this.fish, pickKoiLook());
    this.react = rand(0.3, 1); // each fish has its own desire to react
    this.attractT = 0; this.tx = 0; this.ty = 0; this.hovered = false;
  }
  get x() { return this.fish.body.circles[0].x; }
  get y() { return this.fish.body.circles[0].y; }
  get a() { const c = this.fish.body.circles; return findTangent(c[1], c[0]); }
  get wid() { return this.fish.body.circles[4].d; }
  call(x, y) {
    if (Math.random() > this.react + 0.15) return;
    gsap.delayedCall(rand(0.1, 1.0) * (1.2 - this.react), () => { this.attractT = rand(4, 7); this.tx = x; this.ty = y + this.wid; });
  }
  startle(x, y) { if (Math.hypot(this.x - x, this.y - y) < minD * 0.3) this.fish.triggerDirectionalDash(x, y); }
  fixedUpdate(step) {
    if (this.attractT > 0) {
      this.attractT -= step;
      const f = food.length ? nearestFood(this.x, this.y) : null;
      if (f && Math.hypot(f.x - this.x, f.y - this.y) < minD * 0.6) { this.fish.chase(f.x, f.y); this.attractT = Math.max(this.attractT, 0.5); }
      else this.fish.chase(this.tx, this.ty);
    }
    this.fish.update();
  }
  rescale(sx, sy) { this.fish.rescale(sx, sy); this.tx *= sx; this.ty *= sy; }
}

// fixed-rate part of the simulation (60 Hz, like the original)
function fishStep(step) {
  koi.forEach((k, i) => {
    k.fixedUpdate(step);
    if (!k.fish.isDashing()) return;
    koi.forEach((o, j) => { if (i !== j && k.fish.overlaps(o.fish)) o.fish.triggerDash(); }); // a dashing fish startles the ones it bumps
    const now = performance.now();
    if (now - k.fish.lastRipple > k.fish.rippleCooldown) {
      const c = k.fish.body.circles[Math.floor(k.fish.body.circles.length / 2)];
      const v = k.fish.velocity(), vm = k.fish.cube.vMax;
      addRipple(c.x, c.y, clamp((v - vm) / vm, 0.15, 0.6), { rings: 1, life: 3 });
      k.fish.lastRipple = now; k.fish.rippleCooldown = rand(400, 800);
    }
  });
}

/* ================= lily pads + lotus ================= */
function makePads() {
  const list = [];
  const big = [0.055, 0.075], mid = [0.035, 0.05], small = [0.016, 0.027];
  const top = barBottom();
  const ok = (x, y, r) => {
    if (x < -r * 0.4 || x > W + r * 0.4 || y < top - r * 0.3 || y > H + r * 0.4) return false;
    // keep the name readable: only small pads may sit over it
    const nx = clamp(x, nameBox.x, nameBox.x + nameBox.w), ny = clamp(y, nameBox.y, nameBox.y + nameBox.h);
    const overlap = Math.hypot(x - nx, y - ny) < r * 0.85;
    if (overlap && (r > minD * 0.026 || Math.random() < 0.8)) return false;
    if (Math.hypot(x - lotusSpot.x, y - lotusSpot.y) < minD * 0.08 + r) return false;
    return list.every(p => Math.hypot(p.ax - x, p.ay - y) > (p.r + r) * 0.98);
  };
  const add = (x, y, r) => {
    if (!ok(x, y, r)) return false;
    list.push({
      ax: x, ay: y, x, y, vx: 0, vy: 0, r, rot: rand(0, TAU), vr: 0,
      notch: rand(0.35, 0.6), col: PAL.pads[Math.floor(Math.random() * PAL.pads.length)],
      seed: rand(0, 100), drift: rand(1, 3), scale: 0, lotus: false
    });
    return true;
  };
  // scatter pads evenly over the whole pond: one per cell of a jittered grid, in a mix of sizes
  const target = clamp(Math.round((W * (H - top)) / 22000), 14, 44);
  const cell = Math.sqrt((W * (H - top)) / target);
  const cols = Math.ceil(W / cell), rows = Math.ceil((H - top) / cell);
  const cells = [];
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) cells.push([cx, cy]);
  cells.sort(() => Math.random() - 0.5);
  for (const [cx, cy] of cells) {
    if (Math.random() < 0.18) continue; // leave some open water
    const pick = Math.random();
    const size = pick < 0.18 ? big : pick < 0.52 ? mid : small;
    for (let t = 0; t < 6; t++) {
      const r = minD * rand(...size);
      const x = (cx + rand(0.15, 0.85)) * cell, y = top + (cy + rand(0.15, 0.85)) * cell;
      if (add(x, y, r)) {
        // now and then a little pad keeps it company
        if (Math.random() < 0.3) {
          const sr = minD * rand(...small), a = rand(0, TAU);
          add(x + Math.cos(a) * (r + sr + 2), y + Math.sin(a) * (r + sr + 2), sr);
        }
        break;
      }
    }
  }
  // flowers: one between the words (from the sketch) and a couple on large pads
  list.push({ ax: lotusSpot.x, ay: lotusSpot.y, x: lotusSpot.x, y: lotusSpot.y, vx: 0, vy: 0, r: minD * 0.05, rot: rand(0, TAU), vr: 0, seed: rand(0, 100), drift: 3, scale: 0, lotus: true, flowerOnly: true });
  list.filter(p => !p.lotus && p.r > minD * 0.055).slice(0, 2).forEach(p => list.push({ ...p, r: p.r * 0.42, lotus: true, flowerOnly: true, host: p, ax: p.ax + p.r * 0.25, ay: p.ay - p.r * 0.1, seed: rand(0, 100) }));
  return list;
}

function updatePads(dt, time) {
  for (const p of pads) {
    // each pad drifts lazily around its home spot
    const hx = p.ax + Math.sin(time * 0.07 + p.seed) * p.drift;
    const hy = p.ay + Math.cos(time * 0.05 + p.seed * 1.3) * p.drift;
    let fx = (hx - p.x) * 1.4, fy = (hy - p.y) * 1.4;
    // a fish passing underneath nudges the pad (as in the original sketch)
    for (const k of koi) {
      const b = k.fish.bounds, cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
      if (d < k.wid * 2 + p.r) { const f = (k.fish.velocity() * 60 / d) * 6; fx += (dx / d) * f; fy += (dy / d) * f; }
    }
    // ripples push pads outward as the ring passes underneath
    for (const r of ripples) {
      const dx = p.x - r.x, dy = p.y - r.y, d = Math.hypot(dx, dy) || 1;
      const x = d - r.radius, band = 34 + r.radius * 0.08;
      if (Math.abs(x) > band * 2) continue;
      const f = Math.exp(-(x * x) / (band * band)) * r.amp * 120 / Math.max(0.6, p.r / (minD * 0.05));
      fx += (dx / d) * f; fy += (dy / d) * f;
      p.vr += Math.sign(Math.sin(p.seed)) * f * 0.00025 * dt * 60;
    }
    const damp = Math.exp(-dt * 2.2);
    p.vx = (p.vx + fx * dt) * damp; p.vy = (p.vy + fy * dt) * damp;
    p.vr = (p.vr + Math.sin(time * 0.2 + p.seed) * 0.0015) * Math.exp(-dt * 1.5);
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
  }
}

function drawPad(c, p) {
  const r = p.r * p.scale;
  if (r < 0.5) return;
  c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
  // flat pad with a notch, filled with fine diagonal stripes (the stripes stay screen-aligned, like the reference)
  c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, p.notch / 2, TAU - p.notch / 2); c.closePath();
  c.fillStyle = p.col; c.fill();
  c.clip();
  c.rotate(-p.rot);
  c.strokeStyle = PAL.stripe; c.lineWidth = 1;
  c.beginPath();
  for (let k = -2 * r; k < 2 * r; k += 3.2) { c.moveTo(k - r, -r); c.lineTo(k + r, r); }
  c.stroke();
  c.restore();
}

function drawLotus(c, p) {
  const r = p.r * p.scale;
  if (r < 0.5) return;
  c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
  // flat, unoutlined petals in two pale tones, to sit with the flat pads
  const petal = (len, wid, a) => {
    c.save(); c.rotate(a);
    c.beginPath(); c.moveTo(0, 0);
    c.quadraticCurveTo(wid, -len * 0.45, 0, -len);
    c.quadraticCurveTo(-wid, -len * 0.45, 0, 0);
    c.fill(); c.restore();
  };
  for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#dfe9e4' : '#cfdcd6'; petal(r, r * 0.45, (i / 8) * TAU); }
  for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#eef4f1'; petal(r * 0.66, r * 0.34, (i / 6) * TAU + 0.26); }
  c.fillStyle = PAL.pads[0];
  c.beginPath(); c.arc(0, 0, r * 0.17, 0, TAU); c.fill();
  c.restore();
}

/* ================= setup, resize, loop ================= */
function resize(first = false) {
  const oldW = W || window.innerWidth, oldH = H || window.innerHeight;
  W = pond.clientWidth; H = pond.clientHeight;
  PIX = clamp(Math.round(Math.max(W, H) / 440), 2, 4); // about 440 "LCD pixels" across the long side
  DPR = 1 / PIX;
  minD = Math.min(W, H) * 0.6 + Math.max(W, H) * 0.25;
  unit = minD * 0.085;
  surface.width = Math.round(W * DPR); surface.height = Math.round(H * DPR);
  SHARP = Math.min(window.devicePixelRatio || 1, 2);
  padCanvas.width = Math.round(W * SHARP); padCanvas.height = Math.round(H * SHARP);
  if (water) {
    water.resize(W, H, DPR);
    const { bed, name } = buildBed();
    water.setTextures(bed, name);
  } else {
    // no WebGL: paint the bed and name flat, without the refraction
    const { bed, name } = buildBed();
    waterCanvas.width = bed.width; waterCanvas.height = bed.height;
    const c2 = waterCanvas.getContext('2d');
    if (c2) { c2.drawImage(bed, 0, 0); c2.drawImage(name, 0, 0); }
  }
  if (first) {
    const count = Math.round(clamp((W * H) / 120000, 5, 11));
    koi = Array.from({ length: count }, () => new Koi());
    pads = makePads(); makeSpecks();
  } else {
    const sx = W / oldW, sy = H / oldH;
    koi.forEach(k => k.rescale(sx, sy));
    pads = makePads(); pads.forEach(p => { p.scale = 1; });
  }
}

try { water = createWater(waterCanvas); } catch (e) { water = null; }

/* ================= specks + food ================= */
// tiny motes drifting in the water, and food pellets that the bar buttons scatter
let specks = [];
const food = [];
function makeSpecks() {
  specks = Array.from({ length: Math.round(clamp((W * H) / 9000, 40, 160)) }, () => ({
    x: rand(0, W), y: rand(0, H), vx: 0, vy: 0, s: rand(0.8, 1.8), a: rand(0.15, 0.45), seed: rand(0, 100)
  }));
}
function scatterFood(x, y) {
  const n = 10 + Math.floor(rand(0, 6));
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), d = rand(0, minD * 0.06);
    food.push({ x, y, tx: x + Math.cos(a) * d, ty: y + Math.sin(a) * d * 0.8, t: 0, life: rand(14, 20), s: rand(1.4, 2.2) });
  }
}
function nearestFood(x, y) {
  let best = null, bd = Infinity;
  for (const f of food) { const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = f; } }
  return best;
}
function updateSpecks(dt, time) {
  for (const s of specks) {
    s.vx += Math.sin(time * 0.15 + s.seed) * 0.6 * dt; s.vy += Math.cos(time * 0.12 + s.seed * 1.7) * 0.6 * dt;
    for (const r of ripples) {
      const dx = s.x - r.x, dy = s.y - r.y, d = Math.hypot(dx, dy) || 1, x = d - r.radius;
      if (Math.abs(x) < 30) { const f = Math.exp(-(x * x) / 300) * r.amp * 40; s.vx += (dx / d) * f * dt; s.vy += (dy / d) * f * dt; }
    }
    s.vx *= Math.exp(-dt * 1.2); s.vy *= Math.exp(-dt * 1.2);
    s.x += s.vx * dt * 10; s.y += s.vy * dt * 10;
    if (s.x < 0) s.x += W; if (s.x > W) s.x -= W; if (s.y < 0) s.y += H; if (s.y > H) s.y -= H;
  }
  for (let i = food.length - 1; i >= 0; i--) {
    const f = food[i];
    f.t += dt;
    const k = Math.min(1, f.t / 0.6);
    f.x += (f.tx - f.x) * k * 0.15; f.y += (f.ty - f.y) * k * 0.15;
    // a koi mouth passing over a pellet eats it
    const eater = koi.find(q => Math.hypot(q.x + Math.cos(q.a) * q.wid * 0.5 - f.x, q.y + Math.sin(q.a) * q.wid * 0.5 - f.y) < q.wid * 0.6);
    if (eater || f.t > f.life) {
      if (eater) addRipple(f.x, f.y, 0.2, { rings: 1, life: 2.4, speed: minD * 0.06 });
      food.splice(i, 1);
    }
  }
}
function drawSpecks() {
  for (const s of specks) { ctx.fillStyle = `rgba(${PAL.speck},${s.a})`; ctx.fillRect(Math.round(s.x / PIX) * PIX, Math.round(s.y / PIX) * PIX, PIX, PIX); }
  for (const f of food) {
    const fade = Math.min(1, (f.life - f.t) / 2);
    ctx.fillStyle = `rgba(${PAL.speck},${(0.85 * fade).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, TAU); ctx.fill();
  }
}

let fishClock = 0;
function frame(time, dt) {
  frameInner(time, dt);
}
function frameInner(time, dt) {
  updateRipples(dt);
  // the original runs its steering at a fixed 60 Hz and moves the bodies every animation frame
  fishClock += dt;
  for (let s = 0; fishClock >= 1 / 60 && s < 4; s++) { fishStep(1 / 60); fishClock -= 1 / 60; }
  if (fishClock > 1 / 15) fishClock = 0;
  koi.forEach(k => k.fish.move());
  updatePads(dt, time);
  updateSpecks(dt, time);
  if (water) water.render(time, ripples, reveal.name);
  // low-res layer: specks and ripples
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.globalAlpha = reveal.life;
  drawSpecks();
  drawRipples();
  ctx.globalAlpha = 1;
  // sharp layer: fish, then lily pads + lotus floating above them
  pctx.setTransform(SHARP, 0, 0, SHARP, 0, 0);
  pctx.clearRect(0, 0, W, H);
  pctx.globalAlpha = reveal.life;
  koi.forEach(k => k.fish.draw(pctx, 2 / SHARP));
  pads.forEach(p => (p.lotus ? null : drawPad(pctx, p)));
  pads.forEach(p => (p.lotus ? drawLotus(pctx, p) : null));
  pctx.globalAlpha = 1;
}


/* ================= interaction ================= */
let touched = false;
function onFirstTouch() {
  if (touched) return;
  touched = true;
  gsap.to(hint, { opacity: 0, duration: 0.6 });
}
function stone(x, y) {
  addRipple(x, y, 1, { rings: 3 });
  gsap.delayedCall(0.3, () => addRipple(x, y, 0.45, { rings: 2, life: 4.2 }));
  koi.forEach(k => k.startle(x, y));
  onFirstTouch();
}
pond.addEventListener('pointerdown', e => {
  const r = pond.getBoundingClientRect();
  stone(e.clientX - r.left, e.clientY - r.top);
});
// hovering over a fish makes it dash off, like the original
pond.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  const r = pond.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  koi.forEach(k => {
    const inside = k.fish.contains(x, y);
    if (inside && !k.hovered) k.fish.triggerDash();
    k.hovered = inside;
  });
});

// buttons in the top bar tap the water below them and call the fish
function callFish(el) {
  const b = el.getBoundingClientRect(), pr = pond.getBoundingClientRect();
  const x = b.left + b.width / 2 - pr.left;
  const y = Math.max(barBottom(), b.bottom) - pr.top + minD * 0.06;
  [0, 0.4, 0.8].forEach((d, i) => gsap.delayedCall(d, () => addRipple(x, y, 0.75 - i * 0.12, { rings: 2, life: 5 })));
  scatterFood(x, y);
  koi.forEach(k => k.call(x, y));
  gsap.fromTo(el, { scale: 0.92 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.45)' });
  onFirstTouch();
}
document.querySelectorAll('.link, .resume').forEach(el => el.addEventListener('click', () => callFish(el)));

// phone menu
const menuBtn = document.getElementById('menu-btn'), sheet = document.getElementById('sheet');
const setMenu = open => {
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.textContent = open ? 'Close' : 'Menu';
  if (open) {
    sheet.hidden = false;
    gsap.fromTo(sheet, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' });
    gsap.fromTo(sheet.children, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.05, ease: 'power3.out' });
  } else {
    gsap.to(sheet, { opacity: 0, y: -12, duration: 0.25, ease: 'power2.in', onComplete: () => { sheet.hidden = true; } });
  }
};
menuBtn.addEventListener('click', () => { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
sheet.addEventListener('click', e => { if (e.target.closest('.link')) setTimeout(() => setMenu(false), 450); });

// magnetic buttons (React Bits "Magnet", rebuilt with GSAP)
if (window.matchMedia('(hover: hover)').matches && !reduceMotion) {
  document.querySelectorAll('.bar .link, .bar .resume, .mark').forEach(el => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3' });
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * 0.25); yTo((e.clientY - r.top - r.height / 2) * 0.35); });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' }));
  });
}

// Lenis: ready for when the page grows past the pond
if (window.Lenis && !reduceMotion) {
  const lenis = new window.Lenis({ lerp: 0.1 });
  gsap.ticker.add(t => lenis.raf(t * 1000));
}

/* ================= start ================= */
await Promise.race([
  Promise.all([document.fonts.load('400 100px "Young Serif"'), document.fonts.load('500 16px "Instrument Sans"')]),
  new Promise(r => setTimeout(r, 2500))
]);
// don't build the pond until it has a real size (it can be 0×0 for a moment while the page lays out)
await new Promise(res => {
  if (pond.clientWidth && pond.clientHeight) return res();
  const ro = new ResizeObserver(() => { if (pond.clientWidth && pond.clientHeight) { ro.disconnect(); res(); } });
  ro.observe(pond);
});
resize(true);
let resizeQueued = false;
new ResizeObserver(() => {
  if (resizeQueued || !pond.clientWidth || !pond.clientHeight) return;
  if (pond.clientWidth === W && pond.clientHeight === H) return;
  resizeQueued = true;
  requestAnimationFrame(() => { resizeQueued = false; resize(); });
}).observe(pond);

// opening: the bar settles in, the name surfaces, pads unfurl, the first drop lands
gsap.from(bar, { y: -30, opacity: 0, duration: 0.9, ease: 'power3.out', delay: 0.2 });
// the name rises letter by letter (React Bits "SplitText" style, in GSAP)
gsap.fromTo('#title .ch', { yPercent: 60, opacity: 0, filter: 'blur(6px)' }, { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'power3.out', stagger: 0.06, delay: 0.35 });
gsap.to(reveal, { life: 1, duration: 1.4, ease: 'power2.out', delay: 0.5 });
gsap.to(pads, { scale: 1, duration: 1.1, ease: 'back.out(1.6)', stagger: { each: 0.03, from: 'random' }, delay: 0.6 });
gsap.to(hint, { opacity: 1, duration: 0.8, delay: 2.4 });
gsap.delayedCall(1.1, () => addRipple(W * 0.5, H * 0.55, 0.8));

let ambient = 3;
gsap.ticker.add((time, deltaMs) => {
  const dt = Math.min(0.05, deltaMs / 1000);
  ambient -= dt;
  if (ambient <= 0) { ambient = rand(3, 7); addRipple(rand(0, W), rand(barBottom(), H), rand(0.15, 0.3), { rings: 1, life: 3.6, speed: minD * 0.09 }); }
  frame(time, dt);
});
