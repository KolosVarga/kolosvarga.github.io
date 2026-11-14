# KolosVarga.github.io
Personal website. Plain HTML/CSS/JS with no build step, served by GitHub Pages.

## The intro: a koi pond
- `js/water.js`: WebGL pass that draws the pond bed (with the name) and bends it under each ripple.
- `js/pond.js`: koi, lily pads, lotus flowers, ripples, and the top bar. Clicking the water drops a "stone";
  the bar buttons tap the water and call the fish over.
- `css/style.css`: colors live in `:root`.

Libraries load from CDNs: GSAP (UI motion) and Lenis (smooth scrolling, ready for when more sections are added).
The magnetic buttons are a plain-GSAP version of the React Bits "Magnet" component, since React Bits requires React.

The previous jazz-bar version is kept in `_archive/` (GitHub Pages doesn't publish folders starting with `_`).

## Preview locally
```
powershell -ExecutionPolicy Bypass -File .claude/serve.ps1
```
Then open http://localhost:8080.

## Playwright MCP
`.mcp.json` registers the Playwright MCP server for Claude Code. It runs through `npx`, so it needs Node.js installed.
