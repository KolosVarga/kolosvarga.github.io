/* Hobbies: painted sailing harbor, and the interactive music staff. */
import { reduceMotion, rand, clamp } from './site.js';
import './harbor.js';

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
