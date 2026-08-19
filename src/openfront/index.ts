import type { Config } from '../config.js';
import { createLogger } from '../logger.js';
import { TtlCache } from './cache.js';
import { OpenFrontApiClient } from './client.js';
import { TokenBucketRateLimiter } from './rateLimiter.js';

/**
 * Builds the OpenFront API client (with cache, rate limiter and logger)
 * from validated application configuration.
 */
export function buildClient(config: Config): OpenFrontApiClient {
  const logger = createLogger(config.logLevel as never);

  const cache = new TtlCache(60_000);
  const rateLimiter = new TokenBucketRateLimiter({
    rps: config.rateLimitRps,
    burst: config.rateLimitBurst,
  });

  return new OpenFrontApiClient({
    baseUrl: config.apiBaseUrl,
    timeoutMs: config.apiTimeoutMs,
    maxRetries: config.apiMaxRetries,
    cache,
    rateLimiter,
    ttls: {
      games: config.cacheTtlGamesMs,
      gameDetail: config.cacheTtlGameDetailMs,
      player: config.cacheTtlPlayerMs,
      playerGames: config.cacheTtlPlayerGamesMs,
      playerSessions: config.cacheTtlPlayerGamesMs,
      clan: config.cacheTtlClanMs,
      clanSessions: config.cacheTtlClanSessionsMs,
      leaderboard: config.cacheTtlLeaderboardMs,
    },
    logger,
  });
}

export { OpenFrontApiClient, TokenBucketRateLimiter, TtlCache };