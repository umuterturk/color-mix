import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { createAppServer, type ServerOptions } from '../server/createServer.ts';
import { parseRound } from '../shared/parse.ts';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.closeAllConnections();
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

async function listen(options: ServerOptions = {}): Promise<number> {
  const server = createAppServer(options);
  servers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return address.port;
}

test('GET /api/health reports the service', async () => {
  const port = await listen();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ ok: true, service: 'color-mix' });
});

test('GET /api/round deals a playable round and hides the recipe', async () => {
  const port = await listen({ rng: () => 0.35 });
  const response = await fetch(`http://127.0.0.1:${port}/api/round`);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const body: unknown = await response.json();
  expect(body).not.toHaveProperty('counts');
  expect(body).not.toHaveProperty('recipe');
  expect(parseRound(body)).not.toBeNull();
});

test('unknown API paths return 404 JSON', async () => {
  const port = await listen();
  const response = await fetch(`http://127.0.0.1:${port}/api/missing`);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'not found' });
});

test('a failing round planner returns 500 without dropping the socket', async () => {
  const port = await listen({
    rng: () => {
      throw new Error('boom');
    },
  });
  const response = await fetch(`http://127.0.0.1:${port}/api/round`);
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'server error' });
});

test('serves the built client and blocks path traversal', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'color-mix-'));
  try {
    await writeFile(join(dir, 'index.html'), '<!doctype html><title>color mix</title>');
    await writeFile(join(dir, 'secret.txt'), 'hidden');
    const port = await listen({ clientDist: dir });

    const home = await fetch(`http://127.0.0.1:${port}/`);
    expect(home.status).toBe(200);
    expect(home.headers.get('content-type')).toContain('text/html');
    expect(home.headers.get('cache-control')).toBe('no-cache');
    expect(await home.text()).toContain('color mix');

    const secret = await fetch(`http://127.0.0.1:${port}/secret.txt`);
    expect(secret.status).toBe(200);

    const escaped = await fetch(`http://127.0.0.1:${port}/..%2f..%2fetc/passwd`);
    expect(escaped.status).toBe(400);
    const body = await escaped.text();
    expect(body).not.toContain('root:');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
