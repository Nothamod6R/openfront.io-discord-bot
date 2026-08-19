import { createServer, type Server } from 'node:http';
import type { Logger } from './logger.js';

/**
 * Starts a minimal HTTP server exposing a `GET /health` endpoint used by
 * container orchestrators and uptime checks. Returns the server handle.
 */
export function startHealthServer(port: number, logger: Logger): Server {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() }));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'not_found' }));
  });

  server.listen(port, () => {
    logger.info(`Health server listening on port ${port}`);
  });
  server.on('error', (err) => {
    logger.error(`Health server error: ${err.message}`);
  });
  return server;
}