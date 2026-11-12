# color-mix

A portrait color-matching game. The client is React and Vite. Motion is GSAP. A small Node server deals each swatch.

## Run both

```bash
npm install
npm run dev
```

- Game: http://127.0.0.1:5173
- API: http://127.0.0.1:8787/api/health

`npm run dev` starts the API and the client together. The dev client still requests `GET /api/round`, and Vite proxies `/api` to the Node server. Vite prints a network URL you can open on a phone. Hold the phone upright.

## Production

```bash
npm run build
npm start
```

Serves the built client and the API on http://127.0.0.1:8787. A local build leaves the Vite base at `/`. The production client deals rounds in the browser, so play does not depend on the API. The API stays available for local checks.

## GitHub Pages

The static site is https://umuterturk.github.io/color-mix/.

`.github/workflows/pages.yml` builds the client and deploys it with the official Pages actions (`configure-pages`, `upload-pages-artifact`, `deploy-pages`). The workflow passes the site base path through `PAGES_BASE_PATH` (`/color-mix/` for this project site, `/` for a user site). Pigment catalog, rounds, and mixing ship in the client bundle. The Node API does not run on Pages.

## Test

```bash
npm test
```
