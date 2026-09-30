# SASEHacks hill tour

The scroll-told landing page for SASEHacks (OU SASE × Hacklahoma): a camera tour over a painted hilltop town, ending in the courtyard with one Register call to action.

- `index.html`: markup and event facts (`window.SH_EVENT`)
- `tour.js`: camera, panels, gate, and scroll handling
- `tour-gl.js`: WebGL painter, which runs in a worker; the page falls back to `<img>` layers if it can't run, and `?nogl` forces that
- `tour.css`, `tour-data.js`, `assets.js`, `art/`

Run it locally with `python -m http.server`. Opening `index.html` straight from disk works, but it uses the `<img>` fallback.
