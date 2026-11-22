/* "Recently played" on the home page: a small record player fed live by Last.fm.
   When something is playing right now the record spins, the needle drops and the little meter moves;
   otherwise it rests and says when the last song finished. It refreshes about once a minute while on screen.
   Set data-lastfm-user and data-lastfm-key on #listening (see index.html); without them the placeholders stay. */
const box = document.getElementById('listening');
if (box) {
  const user = box.dataset.lastfmUser?.trim(), key = box.dataset.lastfmKey?.trim();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const song = box.querySelector('.h-song'), artist = box.querySelector('.h-artist');
  const state = box.querySelector('.h-listen-state'), art = box.querySelector('.h-art'), list = box.querySelector('.h-recent');
  let last = '', timer = 0, visible = false;

  const ago = uts => {
    const s = Math.max(0, Date.now() / 1000 - uts);
    if (s < 90) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = Math.round(s / 86400); return d === 1 ? 'yesterday' : `${d} days ago`;
  };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function show(tracks) {
    if (!tracks.length) return;
    const [now, ...rest] = tracks;
    const playing = now['@attr']?.nowplaying === 'true';
    const id = `${now.name}|${now.artist['#text']}|${playing}`;
    box.classList.toggle('playing', playing);
    state.textContent = playing ? 'Listening right now' : `Last played ${now.date ? ago(+now.date.uts) : 'recently'}`;
    if (id === last) return; // nothing new: just keep the time fresh
    const swap = () => {
      song.textContent = now.name; song.href = now.url || 'https://www.last.fm/';
      artist.textContent = now.artist['#text'];
      const img = (now.image || []).find(i => i.size === 'large')?.['#text'] || '';
      art.setAttribute('href', img);
      list.replaceChildren(...rest.slice(0, 3).map(t => {
        const li = el('li'); li.append(el('span', 't', t.name), el('span', 'a', t.artist['#text']));
        if (t.date) li.append(el('time', 'w', ago(+t.date.uts)));
        return li;
      }));
    };
    if (!last || reduce) swap();
    else { // a new song: the text slides out, the label changes, the text slides back in
      box.classList.add('changing');
      setTimeout(() => { swap(); box.classList.remove('changing'); }, 260);
    }
    last = id;
  }

  async function refresh() {
    clearTimeout(timer);
    if (!visible || document.hidden) return;
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
      const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(user)}&api_key=${encodeURIComponent(key)}&format=json&limit=5`;
      const res = await fetch(url, { signal: ctl.signal });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        const tracks = data?.recenttracks?.track;
        show(Array.isArray(tracks) ? tracks : tracks ? [tracks] : []);
      }
    } catch { /* offline or rate-limited: keep what's showing and try again later */ }
    timer = setTimeout(refresh, 60000);
  }

  if (user && key) {
    box.classList.add('live');
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) refresh(); else clearTimeout(timer); }, { rootMargin: '200px 0px' }).observe(box);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) refresh(); });
  } else {
    box.classList.add('demo'); // placeholders only; the record still turns slowly so the idea reads
  }
}
