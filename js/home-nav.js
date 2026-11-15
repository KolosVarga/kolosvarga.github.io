/* On the pond, a nav link first taps the water (pond.js sends a ripple and calls the koi),
   then we follow the link a moment later so the visitor sees the fish turn toward it.
   "About" (and the mark / "Back to the pond") scroll within the page instead.
   Modified clicks (new tab etc.) and reduced motion go straight through. */
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const barH = () => (document.getElementById('bar')?.getBoundingClientRect().bottom || 70) + 12;

function scrollToHash(hash) {
  const target = hash === '#top' ? 0 : document.querySelector(hash);
  if (target === null) return false;
  if (window.lenis) window.lenis.scrollTo(target, { offset: target === 0 ? 0 : -barH(), duration: 1.4 });
  else if (target === 0) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - barH(), behavior: reduce ? 'auto' : 'smooth' });
  history.replaceState(null, '', hash === '#top' ? location.pathname : hash);
  return true;
}

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (scrollToHash(a.getAttribute('href'))) e.preventDefault();
  });
});

document.querySelectorAll('.bar a.link:not([href^="#"]), .bar a.resume').forEach(a => {
  a.addEventListener('click', e => {
    if (reduce || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setTimeout(() => { window.location.href = a.href; }, 520);
  });
});

// arriving from another page with #about: wait for the pond to lay out, then glide down
if (location.hash === '#about') {
  history.scrollRestoration = 'manual';
  setTimeout(() => scrollToHash('#about'), reduce ? 0 : 450);
}
