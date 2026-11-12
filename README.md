# color-mix

A portrait color-matching game. The client is React and Vite. Motion is GSAP. A small Node server deals each swatch.

## Run both

```bash
npm install
npm run dev
```

- Game: http://127.0.0.1:5173
- API: http://127.0.0.1:8787/api/health

`npm run dev` starts the API and the client together. The client proxies `/api` to the Node server. Vite prints a network URL you can open on a phone. Hold the phone upright.

## Production

```bash
npm run build
npm start
```

Serves the built client and the API on http://127.0.0.1:8787.

## Test

```bash
npm test
```
