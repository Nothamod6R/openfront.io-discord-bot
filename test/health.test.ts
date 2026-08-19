import { afterAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { noopLogger } from '../src/logger.js';
import { startHealthServer } from '../src/health.js';

describe('health server', () => {
  const server = startHealthServer(0, noopLogger);
  let port = 0;

  afterAll(() => {
    server.close();
  });

  it('listens and responds to GET /health', async () => {
    const address = server.address() as AddressInfo;
    port = address.port;
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.timestamp).toBe('string');
  });

  it('responds 404 for unknown paths', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/nope`);
    expect(res.status).toBe(404);
  });
});