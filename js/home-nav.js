/* On the pond, a nav link first taps the water (pond.js sends a ripple and calls the koi),
   then we follow the link a moment later so the visitor sees the fish turn toward it.
   Modified clicks (new tab etc.) and reduced motion go straight through. */
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll('.bar a.link, .bar a.resume, .sheet a.link').forEach(a => {
  a.addEventListener('click', e => {
    if (reduce || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setTimeout(() => { window.location.href = a.href; }, 520);
  });
});
