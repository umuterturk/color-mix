import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { normalizeLevel, planLevel } from '../shared/levels.ts';
import { planRound } from '../shared/round.ts';

export type ServerOptions = {
  clientDist?: string;
  rng?: () => number;
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
    'x-content-type-options': 'nosniff',
  });
  res.end(payload);
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

function requestPath(req: IncomingMessage): string {
  const raw = req.url ?? '/';
  const query = raw.indexOf('?');
  return query === -1 ? raw : raw.slice(0, query);
}

function queryLevel(req: IncomingMessage): number | null {
  const raw = req.url ?? '/';
  const query = raw.indexOf('?');
  if (query === -1) return null;
  const level = new URLSearchParams(raw.slice(query + 1)).get('level');
  if (level === null || level === '') return null;
  const parsed = Number(level);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function safeFile(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const parts = decoded.split('/').filter((part) => part.length > 0);
  if (parts.some((part) => part === '..' || part === '.')) return null;
  const full = parts.length === 0 ? join(root, 'index.html') : join(root, ...parts);
  const rooted = root.endsWith(sep) ? root : root + sep;
  if (full !== root && !full.startsWith(rooted)) return null;
  return full;
}

function cacheControl(root: string, filePath: string): string {
  if (extname(filePath) === '.html') return 'no-cache';
  const relative = filePath.slice(root.length);
  if (relative.includes(`${sep}assets${sep}`)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

function sendFile(res: ServerResponse, filePath: string, cache: string): void {
  let size = 0;
  try {
    size = statSync(filePath).size;
  } catch {
    sendText(res, 404, 'not found');
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': cache,
    'x-content-type-options': 'nosniff',
  });
  createReadStream(filePath)
    .on('error', () => {
      res.destroy();
    })
    .pipe(res);
}

function serveStatic(root: string, urlPath: string, res: ServerResponse): void {
  const full = safeFile(root, urlPath);
  if (!full) {
    sendText(res, 400, 'bad path');
    return;
  }
  if (existsSync(full) && statSync(full).isFile()) {
    sendFile(res, full, cacheControl(root, full));
    return;
  }
  if (extname(urlPath)) {
    sendText(res, 404, 'not found');
    return;
  }
  const index = join(root, 'index.html');
  if (existsSync(index)) {
    sendFile(res, index, 'no-cache');
    return;
  }
  sendText(res, 404, 'client not built');
}

export function createAppServer(options: ServerOptions = {}): Server {
  const rng = options.rng ?? Math.random;
  const clientDist = options.clientDist ? normalize(options.clientDist) : undefined;

  return createServer((req, res) => {
    try {
      const path = requestPath(req);
      if (path === '/api/health') {
        sendJson(res, 200, { ok: true, service: 'color-mix' });
        return;
      }
      if (path === '/api/round') {
        const level = queryLevel(req);
        const { publicRound } = level === null ? planRound(rng) : planLevel(normalizeLevel(level));
        sendJson(res, 200, publicRound);
        return;
      }
      if (path.startsWith('/api/')) {
        sendJson(res, 404, { error: 'not found' });
        return;
      }
      if (!clientDist) {
        sendText(res, 404, 'not found');
        return;
      }
      serveStatic(clientDist, path, res);
    } catch {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      sendJson(res, 500, { error: 'server error' });
    }
  });
}
