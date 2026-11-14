import * as THREE from 'three';

export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isTouch = window.matchMedia('(hover: none)').matches;
export const lowPower = isTouch || (navigator.hardwareConcurrency || 8) <= 4 || window.innerWidth < 720;

export const TAU = Math.PI * 2;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const seg = (t, a, b) => ease((t - a) / (b - a));
export const rand = (a, b) => a + Math.random() * (b - a);

/** How far the page has scrolled through a tall (sticky) section, 0..1. */
export function sectionProgress(el) {
  const r = el.getBoundingClientRect();
  const total = r.height - window.innerHeight;
  if (total <= 0) return r.top < 0 ? 1 : 0;
  return clamp(-r.top / total, 0, 1);
}

const views = [];

/** One renderer + scene + camera bound to a DOM element. Only renders while on screen. */
export class View {
  constructor(host, { shadows = false, dprMax = 1.75 } = {}) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: !lowPower, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : dprMax));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'gl';
    host.prepend(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
    this.visible = false;
    this.w = 1; this.h = 1;
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    new ResizeObserver(() => this.resize()).observe(host);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }, { rootMargin: '120px' }).observe(host);
    host.addEventListener('pointermove', e => {
      const r = host.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    });
    host.addEventListener('pointerleave', () => { this.pointer.x = 0; this.pointer.y = 0; });
    this.resize();
    views.push(this);
  }
  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.onResize?.(w, h);
  }
}

let last = performance.now(), time = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const adt = reduceMotion ? 0 : dt; // ambient animation pauses for reduced motion
  time += adt;
  for (const v of views) {
    if (!v.visible || v.active === false) continue;
    v.pointer.sx = lerp(v.pointer.sx, v.pointer.x, 1 - Math.exp(-dt * 4));
    v.pointer.sy = lerp(v.pointer.sy, v.pointer.y, 1 - Math.exp(-dt * 4));
    v.update?.(time, adt, dt);
    if (v.render) v.render(); else v.renderer.render(v.scene, v.camera);
  }
}
export function start() { requestAnimationFrame(loop); }
