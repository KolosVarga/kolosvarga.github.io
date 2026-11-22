/* Home, beyond the pond itself: keeps "Engineer" tucked under the name, reveals the About section
   as it scrolls in, and cycles the "wondering" line.
   pond.js is left alone; this only reads where it put the name. */
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
root.classList.add('js-home');

/* ---------- subtitle under the name ---------- */
const title = document.getElementById('title');
const sub = document.getElementById('subtitle');
function placeSub() {
  const size = parseFloat(title.style.fontSize) || parseFloat(getComputedStyle(title).fontSize);
  if (!size) return;
  // the name's box is tight (line-height 0.9), and the "g" in Varga hangs below it, so leave room for the descender
  const top = title.offsetTop + title.offsetHeight + size * 0.2;
  sub.style.top = `${top}px`;
  sub.style.fontSize = `${Math.max(19, Math.min(52, size * 0.22))}px`;
}
// pond.js sizes and places the name whenever the pond resizes; follow it
new MutationObserver(placeSub).observe(title, { attributes: true, attributeFilter: ['style', 'class'] });
new ResizeObserver(placeSub).observe(title);
placeSub();

const showSub = () => {
  if (reduce) { sub.style.opacity = '1'; return; }
  sub.animate(
    [{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(5px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: 1000, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' }
  );
};
// after the name has surfaced (pond.js starts its letters at ~0.35s and they settle by ~1.6s)
document.fonts.ready.then(() => setTimeout(showSub, reduce ? 0 : 1250));

/* ---------- reveals ---------- */
const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    io.unobserve(en.target);
    // siblings arriving together get a short, uneven stagger
    const i = Number(en.target.dataset.i || 0);
    en.target.style.transitionDelay = reduce ? '0ms' : `${[0, 60, 110, 150, 185][Math.min(i, 4)]}ms`;
    en.target.classList.add('in');
  });
}, { rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('[data-in]').forEach(el => {
  const group = [...el.parentElement.querySelectorAll(':scope > [data-in]')];
  el.dataset.i = String(group.indexOf(el));
  io.observe(el);
});

/* ---------- the wondering line ---------- */
const btn = document.querySelector('.h-wonder');
const q = btn?.querySelector('.h-wonder-q');
const list = [...(document.getElementById('wonders')?.content.children || [])].map(s => s.textContent.trim());
let wi = 0, timer = 0;
function nextWonder() {
  if (!q || list.length < 2) return;
  wi = (wi + 1) % list.length;
  q.classList.add('out');
  setTimeout(() => { q.textContent = list[wi]; q.classList.remove('out'); }, reduce ? 120 : 240);
}
function schedule() { clearInterval(timer); if (!reduce) timer = setInterval(nextWonder, 5200); }
btn?.addEventListener('click', () => { nextWonder(); schedule(); });
// only cycle on its own while it's actually on screen
if (btn) new IntersectionObserver(([en]) => { if (en.isIntersecting) schedule(); else clearInterval(timer); }).observe(btn);
