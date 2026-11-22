/* Projects: a pixel space scene in the header (space.js), and engineering sketches that draw
   themselves in as each story arrives. */
import { onReveal, drawIn, primeDraw } from './site.js';
import './space.js';

// Native disclosures keep the page short and work with mouse, touch, Enter and Space.
// Each project is independent; a second activation closes the same project.
function openLinkedProject() {
  const id = location.hash.slice(1);
  const panel = document.getElementById(id);
  if (panel?.matches('details.project-panel')) panel.open = true;
}
openLinkedProject();
window.addEventListener('hashchange', openLinkedProject);

/* ---------- sketches ---------- */
document.querySelectorAll('[data-sketch]').forEach(el => {
  const svgs = [...el.querySelectorAll('svg.sketch')];
  svgs.forEach(primeDraw);
  onReveal(el, () => svgs.forEach((s, i) => drawIn(s, { delay: 0.2 + i * 0.18, duration: 1.5 })));
});
