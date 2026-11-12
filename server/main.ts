import { fileURLToPath } from 'node:url';
import { createAppServer } from './createServer.ts';

const parsedPort = Number(process.env.PORT ?? 8787);
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 8787;
const host = process.env.HOST ?? '0.0.0.0';
const clientDist = process.env.CLIENT_DIST ?? fileURLToPath(new URL('../client/dist/', import.meta.url));

const server = createAppServer({ clientDist });

server.listen(port, host, () => {
  console.log(`color-mix server http://127.0.0.1:${port}`);
});
