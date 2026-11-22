/* Hand-painted look: banded toon shading, inked outlines, canvas-painted textures. */
import * as THREE from 'three';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);

function makeGradient(levels) {
  const data = new Uint8Array(levels.length * 4);
  levels.forEach((l, i) => data.set([l, l, l, 255], i * 4));
  const t = new THREE.DataTexture(data, levels.length, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
export const GM = makeGradient([70, 150, 210, 255]);
export const GM_SOFT = makeGradient([60, 110, 158, 200, 232, 255]);

export const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: GM, ...o });
export const soft = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: GM_SOFT, ...o });

/** Hand-painted texture: a base colour covered in loose, semi-transparent brush dabs. */
export function painted(w, h, base, palette, { strokes = 900, size = [6, 22], alpha = 0.22, angle = 0, jitter = 0.5, extra } = {}) {
  const t = canvasTex(w, h, (c) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < strokes; i++) {
      c.globalAlpha = alpha * rnd(0.4, 1);
      c.fillStyle = palette[Math.floor(Math.random() * palette.length)];
      const r = rnd(size[0], size[1]);
      c.beginPath();
      c.ellipse(rnd(0, w), rnd(0, h), r, r * rnd(0.25, 0.5), angle + rnd(-jitter, jitter), 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    extra?.(c, w, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const olCache = new Map();
export function outlineMat(color = 0x140906, t = 0.012) {
  const key = `${color}_${t}`;
  if (olCache.has(key)) return olCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>\n transformed += normalize(normal) * ${t.toFixed(4)};`);
  };
  m.customProgramCacheKey = () => 'ol' + t;
  olCache.set(key, m);
  return m;
}
/** Adds an inked outline (inverted hull) to a mesh. */
export function outline(mesh, t = 0.012, color) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat(color, t));
  o.raycast = () => {};
  mesh.add(o);
  return mesh;
}

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function glowTexture() {
  return canvasTex(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
}

export function smokeTexture() {
  return canvasTex(256, 256, (c, w, h) => {
    for (let i = 0; i < 40; i++) {
      const x = w / 2 + rnd(-60, 60), y = h / 2 + rnd(-60, 60), r = rnd(30, 80);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.08)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
  });
}

/** Big Ghibli-style cumulus cloud, painted with layered puffs. */
export function cumulusTexture() {
  return canvasTex(512, 256, (c, w, h) => {
    const puffs = [];
    for (let i = 0; i < 26; i++) {
      const x = w * rnd(0.14, 0.86);
      const r = rnd(28, 78) * (1.1 - Math.abs(x / w - 0.5) * 1.4);
      const y = h * 0.68 - r * rnd(0.3, 0.9);
      puffs.push([x, y, r]);
    }
    puffs.forEach(([x, y, r]) => { c.fillStyle = '#b4c9d8'; c.beginPath(); c.arc(x + 4, y + 10, r, 0, TAU); c.fill(); });
    puffs.forEach(([x, y, r]) => {
      const g = c.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.65, '#f5f8f9'); g.addColorStop(1, '#d6e3eb');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    });
    c.globalCompositeOperation = 'destination-out';
    const fade = c.createLinearGradient(0, h * 0.62, 0, h * 0.78);
    fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = fade; c.fillRect(0, h * 0.62, w, h);
  });
}

/** Ink-outlined musical symbols, white so sprites can be tinted. */
export function noteTextures() {
  const INK = '#1a0d08';
  const make = drawFn => canvasTex(128, 128, c => {
    c.lineCap = 'round'; c.lineJoin = 'round';
    drawFn(c, INK, 7);
    drawFn(c, '#ffffff', 0);
  });
  const head = (c, x, y, e) => { c.beginPath(); c.ellipse(x, y, 16 + e / 2, 11 + e / 2, -0.42, 0, TAU); c.fill(); };
  const ln = (c, w, pts) => { c.lineWidth = w; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke(); };
  const eighth = make((c, col, e) => {
    c.fillStyle = c.strokeStyle = col;
    head(c, 46, 94, e);
    ln(c, 6 + e, [60, 90, 60, 22]);
    c.lineWidth = 7 + e; c.beginPath(); c.moveTo(60, 22); c.bezierCurveTo(70, 42, 96, 44, 86, 74); c.stroke();
  });
  const beamed = make((c, col, e) => {
    c.fillStyle = c.strokeStyle = col;
    head(c, 32, 98, e); head(c, 86, 88, e);
    ln(c, 6 + e, [46, 94, 46, 30]); ln(c, 6 + e, [100, 84, 100, 20]);
    ln(c, 13 + e, [46, 30, 100, 20]);
  });
  const quarter = make((c, col, e) => {
    c.fillStyle = c.strokeStyle = col;
    head(c, 54, 94, e);
    ln(c, 6 + e, [68, 90, 68, 20]);
  });
  const sharp = make((c, col, e) => {
    c.strokeStyle = col;
    ln(c, 6 + e, [52, 18, 50, 110]); ln(c, 6 + e, [78, 14, 76, 106]);
    ln(c, 12 + e, [34, 54, 94, 42]); ln(c, 12 + e, [34, 86, 94, 74]);
  });
  const flat = make((c, col, e) => {
    c.strokeStyle = col;
    ln(c, 6 + e, [50, 12, 50, 108]);
    c.lineWidth = 8 + e; c.beginPath(); c.moveTo(50, 108); c.bezierCurveTo(104, 82, 94, 46, 50, 74); c.stroke();
  });
  return [eighth, beamed, quarter, eighth, beamed, sharp, flat];
}
