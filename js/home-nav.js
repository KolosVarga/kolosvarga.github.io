/* On the pond, links to places on this page (Home, the mark, "Back to the pond") scroll smoothly
   instead of jumping. Links to other pages are left to the browser. */
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

// arriving from another page with #about: wait for the pond to lay out, then glide down
if (location.hash === '#about') {
  history.scrollRestoration = 'manual';
  setTimeout(() => scrollToHash('#about'), reduce ? 0 : 450);
}
