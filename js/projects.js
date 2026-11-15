/* Projects: moving contour lines in the header (a topographic map of a slowly breathing field,
   bent by the cursor), and engineering sketches that draw themselves in as each story arrives. */
import { visibleLoop, onReveal, drawIn, primeDraw, reduceMotion, finePointer } from './site.js';

/* ---------- sketches ---------- */
document.querySelectorAll('[data-sketch]').forEach(el => {
  const svgs = [...el.querySelectorAll('svg.sketch')];
  svgs.forEach(primeDraw);
  onReveal(el, () => svgs.forEach((s, i) => drawIn(s, { delay: 0.2 + i * 0.18, duration: 1.5 })));
});

/* ---------- contour lines (marching squares) ---------- */
const canvas = document.getElementById('contours');
const head = canvas.parentElement;
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1, G = 14, cols = 0, rows = 0, field = new Float32Array(0);
const hills = Array.from({ length: 8 }, (_, i) => ({ // hills and valleys drifting on slow Lissajous paths
  ax: 0.08 + (i * 0.131) % 0.9, ay: 0.18 + ((i * 37) % 7) * 0.1, rx: 0.05 + (i % 3) * 0.03, ry: 0.05 + (i % 2) * 0.05,
  s: 0.085 + (i % 3) * 0.04, a: (i % 3 === 2 ? -0.7 : 1) * (0.8 + (i % 2) * 0.4), fx: 0.031 + i * 0.006, fy: 0.023 + i * 0.005, p: i * 1.7
}));
const mouse = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, amp: 0, target: 0 };

function resize() {
  const r = head.getBoundingClientRect();
  W = r.width; H = r.height; DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  G = W < 700 ? 12 : 14;
  cols = Math.ceil(W / G) + 1; rows = Math.ceil(H / G) + 1;
  field = new Float32Array(cols * rows);
}

function compute(t) {
  const min = Math.min(W, H);
  const hs = hills.map(h => ({
    x: (h.ax + Math.sin(t * h.fx + h.p) * h.rx) * W,
    y: (h.ay + Math.cos(t * h.fy + h.p * 1.3) * h.ry) * H,
    s2: (h.s * Math.max(W, H)) ** 2, a: h.a
  }));
  const ms2 = (min * 0.16) ** 2;
  for (let j = 0; j < rows; j++) {
    const y = j * G;
    for (let i = 0; i < cols; i++) {
      const x = i * G;
      let v = 0.18 * Math.sin(x * 0.0042 + t * 0.06) * Math.cos(y * 0.0051 - t * 0.05);
      for (const h of hs) { const dx = x - h.x, dy = y - h.y; v += h.a * Math.exp(-(dx * dx + dy * dy) / h.s2); }
      if (mouse.amp > 0.01) { const dx = x - mouse.x, dy = y - mouse.y; v -= mouse.amp * Math.exp(-(dx * dx + dy * dy) / ms2); }
      field[j * cols + i] = v;
    }
  }
}

const LEVELS = Array.from({ length: 16 }, (_, k) => -0.6 + k * 0.12);
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.lineWidth = 1;
  LEVELS.forEach((lv, k) => {
    const major = k % 5 === 3;
    ctx.strokeStyle = major ? 'rgba(47,191,147,0.42)' : 'rgba(217,236,229,0.11)';
    ctx.beginPath();
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = field[j * cols + i], b = field[j * cols + i + 1], c = field[(j + 1) * cols + i + 1], d = field[(j + 1) * cols + i];
        const idx = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x = i * G, y = j * G;
        const top = [x + G * (lv - a) / (b - a), y], right = [x + G, y + G * (lv - b) / (c - b)];
        const bottom = [x + G * (lv - d) / (c - d), y + G], left = [x, y + G * (lv - a) / (d - a)];
        const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
        switch (idx) {
          case 1: case 14: seg(left, bottom); break;
          case 2: case 13: seg(bottom, right); break;
          case 3: case 12: seg(left, right); break;
          case 4: case 11: seg(top, right); break;
          case 5: seg(left, top); seg(bottom, right); break;
          case 6: case 9: seg(top, bottom); break;
          case 7: case 8: seg(left, top); break;
          case 10: seg(left, bottom); seg(top, right); break;
        }
      }
    }
    ctx.stroke();
  });
}

resize();
new ResizeObserver(() => { resize(); compute(performance.now() / 1000); draw(); }).observe(head);
compute(12); draw();

if (!reduceMotion) {
  if (finePointer) {
    head.addEventListener('pointermove', e => {
      const r = head.getBoundingClientRect();
      mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top;
      if (mouse.x < -1e3) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
      mouse.target = 0.75;
    });
    head.addEventListener('pointerleave', () => { mouse.target = 0; });
  }
  visibleLoop(head, (t, dt) => {
    // the cursor's dent follows with a little lag and fades when the cursor rests
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 4);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 4);
    mouse.amp += (mouse.target - mouse.amp) * Math.min(1, dt * 1.6);
    compute(t + 12); draw();
  }, { fps: 30 });
}
