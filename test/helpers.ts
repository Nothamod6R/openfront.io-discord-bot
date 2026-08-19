import { readFileSync } from 'node:fs';
import { noopLogger } from '../src/logger.js';
import { TtlCache } from '../src/openfront/cache.js';
import { OpenFrontApiClient } from '../src/openfront/client.js';
import { TokenBucketRateLimiter } from '../src/openfront/rateLimiter.js';

export function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export type MockFetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

export interface ClientHarness {
  client: OpenFrontApiClient;
  cache: TtlCache;
  rateLimiter: TokenBucketRateLimiter;
  calls: Array<{ url: string; init?: RequestInit }>;
}

export interface MakeClientOptions {
  handler?: MockFetchHandler;
  rps?: number;
  burst?: number;
  maxRetries?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  jitter?: () => number;
  baseUrl?: string;
  backoffMaxMs?: number;
  ttls?: Partial<Record<string, number>>;
}

const DEFAULT_TTLS = {
  games: 300_000,
  gameDetail: 600_000,
  player: 900_000,
  playerGames: 300_000,
  playerSessions: 300_000,
  clan: 300_000,
  clanSessions: 300_000,
  leaderboard: 600_000,
};

/** Builds a client with an in-memory cache, rate limiter and mock fetch. */
export function makeClient(options: MakeClientOptions = {}): ClientHarness {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchFn: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    if (!options.handler) {
      return jsonResponse(null, 404);
    }
    return options.handler(url, init);
  };

  const cache = new TtlCache(60_000);
  const rateLimiter = new TokenBucketRateLimiter({
    rps: options.rps ?? 1000,
    burst: options.burst ?? 1000,
  });

  const client = new OpenFrontApiClient({
    baseUrl: options.baseUrl ?? 'https://api.openfront.io/public',
    timeoutMs: options.timeoutMs ?? 15_000,
    maxRetries: options.maxRetries ?? 0,
    cache,
    rateLimiter,
    ttls: options.ttls ?? DEFAULT_TTLS,
    logger: noopLogger,
    fetchFn,
    backoffBaseMs: 1,
    backoffMaxMs: options.backoffMaxMs ?? 100,
    jitter: options.jitter ?? (() => 0),
    sleep: options.sleep ?? (async () => undefined),
  });

  return { client, cache, rateLimiter, calls };
}

/** A deterministic clock helper for rate-limiter tests. */
export function fakeNow() {
  let now = 0;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
    set: (ms: number) => {
      now = ms;
    },
  };
}