/* Resume: the caliper in the margin opens as you read, and reports how far you have scrolled (at 96 px per inch). */
import { reduceMotion, gsap } from './site.js';

const ticks = document.getElementById('cal-ticks');
const jaw = document.getElementById('cal-jaw');
const read = document.getElementById('cal-read');
if (ticks && jaw) {
  const NS = 'http://www.w3.org/2000/svg';
  for (let i = 0; i <= 34; i++) {
    const x = 40 + i * 6, l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', x); l.setAttribute('x2', x); l.setAttribute('y1', 20); l.setAttribute('y2', i % 5 ? 25 : 29);
    l.setAttribute('class', 'tick'); ticks.appendChild(l);
  }
  const TRAVEL = 172;
  const setJaw = gsap && !reduceMotion ? gsap.quickTo(jaw, 'x', { duration: 0.6, ease: 'power3' }) : x => jaw.setAttribute('transform', `translate(${x} 0)`);
  let last = -1;
  const update = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const y = window.scrollY, k = Math.min(1, y / max);
    setJaw(k * TRAVEL);
    const mm = (y / 96) * 25.4;
    if (Math.abs(mm - last) > 0.05) { read.textContent = `${mm.toFixed(1)} mm read so far`; last = mm; }
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
}
