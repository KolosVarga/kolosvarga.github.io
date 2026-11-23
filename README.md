# KolosVarga.github.io
Personal website. Plain HTML/CSS/JS with no build step, served by GitHub Pages.

## The intro: a koi pond
- `js/water.js`: WebGL pass that draws the pond bed (with the name) and bends it under each ripple.
- `js/pond.js`: koi, lily pads, lotus flowers, ripples, and the top bar. Clicking the water drops a "stone";
  the bar buttons tap the water and call the fish over.
- `css/style.css`: colors live in `:root`.

Below the pond the home page scrolls into a short About section and a row of links (Resume, GitHub, LinkedIn,
Email, Instagram): `css/home.css`, `js/home.js`. The links are placeholders in `index.html`.

The pond's canvases run on a little way under the About section. Rather than fading out, the pond thins out in
layers: koi stay above one line, lily pads above a slightly lower one, and ripples die out before a third
(`KOI_LINE`, `PAD_LINE`, `RIPPLE_LINE` in `js/pond.js`).

**Recently played** (`js/listening.js`) is a small record player fed by Last.fm. To make it live, connect Spotify
to Last.fm (last.fm/settings/applications), create a free API key (last.fm/api/account/create), and put your
username and key in the `data-lastfm-user` / `data-lastfm-key` attributes of `#listening` in `index.html`.

## The other rooms
Each page is its own folder with an `index.html`, so URLs stay clean (`/projects/`, `/contact/` …). `/about/` now just forwards to the About section on the home page..
Shared look and behaviour: `css/site.css` (colour tokens, type, the bar) and `js/site.js` (menu, magnetic bar,
Lenis, headline split, scroll reveals, and a loop helper that pauses canvases when they are off screen).

| Page | Small interactive identity | Files |
| --- | --- | --- |
| Projects | A pixel-art space scene: ships fly between planets, chase and shoot. Project bars expand their stories on click and close on the next click; all start closed. | `css/projects.css`, `js/space.js`, `js/projects.js` |
| Resume | cool paper, a ruler down the edge, a caliper that measures how far you have read; prints cleanly | `css/resume.css`, `js/resume.js` |
| Contact | paper scraps drifting on water, which you can grab and toss | `css/contact.css`, `js/contact.js` |

On the pond, `js/home-nav.js` lets a nav click ripple the water for half a second before following the link,
and scrolls to About instead of leaving the page.
Every animation pauses off screen and is skipped with `prefers-reduced-motion`.

**Filling it in:** everything in `[square brackets]` is yours to replace, and `<!-- EDIT -->` comments mark the spots.
Photos go in `assets/` (see `assets/README.md`). Email and profile links appear in each page's footer and on Contact.

Libraries load from CDNs: GSAP (UI motion) and Lenis (smooth scrolling).
The magnetic buttons are a plain-GSAP version of the React Bits "Magnet" component, since React Bits requires React.

The previous jazz-bar version is kept in `_archive/` (GitHub Pages doesn't publish folders starting with `_`).

## Preview locally
```
powershell -ExecutionPolicy Bypass -File .claude/serve.ps1
```
Then open http://localhost:8080.

## MCP servers
`.mcp.json` lists the MCP servers Claude Code connects to for this project.

## Claude Code skills
`.claude/skills/` holds Emil Kowalski's design-engineering skills (from `emilkowalski/skills`, MIT; see
`.claude/skills/LICENSE-emilkowalski`). They guide animation and interaction work in this repo.
