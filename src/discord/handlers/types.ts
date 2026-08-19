import type { OpenFrontApiClient } from '../../openfront/client.js';
import type { PaginatorRegistry } from '../pagination.js';

export interface HandlerContext {
  client: OpenFrontApiClient;
  paginators: PaginatorRegistry;
}

/** Returns the last 24h time window used by clan commands (ISO timestamps). */
export function last24hWindow(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}