# KolosVarga.github.io
Personal website. Plain HTML/CSS/JS with no build step, served by GitHub Pages.

## The intro: a koi pond
- `js/water.js`: WebGL pass that draws the pond bed (with the name) and bends it under each ripple.
- `js/pond.js`: koi, lily pads, lotus flowers, ripples, and the top bar. Clicking the water drops a "stone";
  the bar buttons tap the water and call the fish over.
- `css/style.css`: colors live in `:root`.

## The other rooms
Each page is its own folder with an `index.html`, so URLs stay clean (`/projects/`, `/about/` …).
Shared look and behaviour: `css/site.css` (colour tokens, type, the bar) and `js/site.js` (menu, magnetic bar,
Lenis, headline split, scroll reveals, and a loop helper that pauses canvases when they are off screen).

| Page | Small interactive identity | Files |
| --- | --- | --- |
| Projects | contour lines that drift and bend around the cursor; sketches that draw themselves in | `css/projects.css`, `js/projects.js` |
| Resume | cool paper, a ruler down the edge, a caliper that measures how far you have read; prints cleanly | `css/resume.css`, `js/resume.js` |
| About | a breaking wave built from keyboard symbols; spray lands on the headline | `css/about.css`, `js/wave.js` |
| Hobbies | a pixel pond: frogs hop between pads and go for dragonflies; fish idle below | `css/hobbies.css`, `js/hobbies.js` |
| Contact | paper scraps drifting on water, which you can grab and toss | `css/contact.css`, `js/contact.js` |

On the pond, `js/home-nav.js` lets a nav click ripple the water for half a second before following the link.
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
