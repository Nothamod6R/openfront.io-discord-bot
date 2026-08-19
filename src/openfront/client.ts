import { TtlCache } from './cache.js';
import { RequestDeduplicator } from './deduplicator.js';
import {
  MalformedResponseError,
  NetworkError,
  NotFoundError,
  OpenFrontError,
  RateLimitedError,
  RetriesExhaustedError,
  ServerError,
  TimeoutError,
  ValidationError,
} from './errors.js';
import type { Logger } from '../logger.js';
import { noopLogger } from '../logger.js';
import type {
  ClanLeaderboard,
  ClanResponse,
  ClanSessionsResponse,
  ContentRange,
  EndpointBucket,
  GameDetail,
  GameMode,
  GameSummary,
  GameType,
  Player,
  PlayerGamesFilter,
  PlayerGamesResponse,
  PlayerGamesType,
  PlayerSession,
  RankedType,
} from '../models/types.js';
import {
  parseContentRange,
  parseJsonBody,
  isArray,
  isRecord,
} from './parsers.js';
import { TokenBucketRateLimiter } from './rateLimiter.js';
import {
  assertClanTag,
  assertGameId,
  assertPlayerId,
  assertTimeRange,
  isFiniteNumber,
} from './validation.js';

const MAX_GAMES_RANGE_MS = 2 * 86_400_000;
const MAX_CLAN_RANGE_MS = 1 * 86_400_000;

const GAME_TYPES: readonly GameType[] = ['Private', 'Public', 'Singleplayer'];
const GAME_MODES: readonly string[] = ['Free For All', 'Team'];
const RANKED_TYPES: readonly RankedType[] = ['unranked', '1v1', '2v2'];
const PLAYER_GAME_FILTERS: readonly PlayerGamesFilter[] = ['ffa', 'team', 'hvn', 'ranked'];
const PLAYER_GAME_TYPES: readonly PlayerGamesType[] = ['public', 'private', 'singleplayer'];

/** Internal cached envelope: preserves response headers for pagination. */
interface CachedEnvelope<T> {
  data: T;
  contentRange: ContentRange | null;
}

export interface GamesOptions {
  start: string;
  end: string;
  type?: GameType;
  mode?: GameMode | string;
  rankedType?: RankedType;
  playerTeams?: string;
  limit?: number;
  offset?: number;
}

export interface GamesResult {
  games: GameSummary[];
  contentRange: ContentRange | null;
}

export interface PlayerGamesOptions {
  filter?: PlayerGamesFilter;
  type?: PlayerGamesType;
  cursor?: string;
}

export interface ClanStatsOptions {
  start: string;
  end: string;
}

export interface ClanSessionsOptions extends ClanStatsOptions {
  page?: number;
  limit?: number;
}

export interface OpenFrontClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  maxRetries?: number;
  cache: TtlCache;
  rateLimiter: TokenBucketRateLimiter;
  /** TTL (ms) per endpoint bucket. */
  ttls: Record<EndpointBucket, number>;
  logger?: Logger;
  fetchFn?: typeof fetch;
  /** Base delay for exponential backoff in ms. */
  backoffBaseMs?: number;
  /** Upper bound for backoff delay in ms. */
  backoffMaxMs?: number;
  /** Override used by tests; defaults to a 0..1 jitter factor. */
  jitter?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class OpenFrontApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly cache: TtlCache;
  private readonly rateLimiter: TokenBucketRateLimiter;
  private readonly ttls: Record<EndpointBucket, number>;
  private readonly logger: Logger;
  private readonly fetchFn: typeof fetch;
  private readonly backoffBaseMs: number;
  private readonly backoffMaxMs: number;
  private readonly jitter: () => number;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly dedupe = new RequestDeduplicator();

  constructor(options: OpenFrontClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxRetries = options.maxRetries ?? 4;
    this.cache = options.cache;
    this.rateLimiter = options.rateLimiter;
    this.ttls = options.ttls;
    this.logger = options.logger ?? noopLogger;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.backoffBaseMs = options.backoffBaseMs ?? 500;
    this.backoffMaxMs = options.backoffMaxMs ?? 30_000;
    this.jitter = options.jitter ?? (() => Math.random());
    this.sleepFn = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  // -------------------------------------------------------------------------
  // Public endpoints
  // -------------------------------------------------------------------------

  async getGames(options: GamesOptions): Promise<GamesResult> {
    const { start, end } = assertTimeRange(options.start, options.end, MAX_GAMES_RANGE_MS, 'Games time range');
    if (options.type !== undefined && !GAME_TYPES.includes(options.type)) {
      throw new ValidationError(`Invalid game type. Must be one of: ${GAME_TYPES.join(', ')}.`);
    }
    if (options.mode !== undefined && !GAME_MODES.includes(options.mode)) {
      throw new ValidationError(`Invalid game mode. Must be one of: ${GAME_MODES.join(', ')}.`);
    }
    if (options.rankedType !== undefined && !RANKED_TYPES.includes(options.rankedType)) {
      throw new ValidationError(`Invalid ranked type. Must be one of: ${RANKED_TYPES.join(', ')}.`);
    }
    const limit = options.limit ?? 50;
    if (!isFiniteNumber(limit) || limit < 1 || limit > 1000) {
      throw new ValidationError('Result limit must be between 1 and 1000.');
    }
    const offset = options.offset ?? 0;
    if (!isFiniteNumber(offset) || offset < 0) {
      throw new ValidationError('Offset must be a non-negative integer.');
    }

    const query: Record<string, string> = { start, end };
    if (options.type) query.type = options.type;
    if (options.mode) query.mode = options.mode;
    if (options.rankedType) query.rankedType = options.rankedType;
    if (options.playerTeams) query.playerTeams = options.playerTeams;
    query.limit = String(limit);
    query.offset = String(Math.floor(offset));

    const envelope = await this.requestWithFlow<GameSummary[]>(
      '/games',
      query,
      'games',
      (body) => {
        if (!isArray(body)) throw new Error('Expected a JSON array of games');
        return body as GameSummary[];
      },
    );
    return { games: envelope.data, contentRange: envelope.contentRange };
  }

  async getGame(gameId: string): Promise<GameDetail> {
    const id = assertGameId(gameId);
    const envelope = await this.requestWithFlow<GameDetail>(
      `/game/${encodeURIComponent(id)}`,
      { turns: 'false' },
      'gameDetail',
      (body) => {
        if (!isRecord(body) || !isRecord(body.info)) {
          throw new Error('Expected an object with an "info" field');
        }
        return body as unknown as GameDetail;
      },
    );
    return envelope.data;
  }

  async getPlayer(playerId: string): Promise<Player> {
    const id = assertPlayerId(playerId);
    const envelope = await this.requestWithFlow<Player>(
      `/player/${encodeURIComponent(id)}`,
      {},
      'player',
      (body) => {
        if (!isRecord(body)) throw new Error('Expected a player object');
        return body as unknown as Player;
      },
    );
    return envelope.data;
  }

  async getPlayerGames(playerId: string, options: PlayerGamesOptions = {}): Promise<PlayerGamesResponse> {
    const id = assertPlayerId(playerId);
    if (options.filter !== undefined && !PLAYER_GAME_FILTERS.includes(options.filter)) {
      throw new ValidationError(`Invalid filter. Must be one of: ${PLAYER_GAME_FILTERS.join(', ')}.`);
    }
    if (options.type !== undefined && !PLAYER_GAME_TYPES.includes(options.type)) {
      throw new ValidationError(`Invalid type. Must be one of: ${PLAYER_GAME_TYPES.join(', ')}.`);
    }

    const query: Record<string, string> = {};
    if (options.filter) query.filter = options.filter;
    if (options.type) query.type = options.type;
    if (options.cursor) query.cursor = options.cursor;

    const envelope = await this.requestWithFlow<PlayerGamesResponse>(
      `/player/${encodeURIComponent(id)}/games`,
      query,
      'playerGames',
      (body) => {
        if (!isRecord(body) || !isArray(body.results)) {
          throw new Error('Expected an object with a "results" array');
        }
        return body as unknown as PlayerGamesResponse;
      },
    );
    return envelope.data;
  }

  async getPlayerSessions(playerId: string): Promise<PlayerSession[]> {
    const id = assertPlayerId(playerId);
    const envelope = await this.requestWithFlow<PlayerSession[]>(
      `/player/${encodeURIComponent(id)}/sessions`,
      {},
      'playerSessions',
      (body) => {
        if (!isArray(body)) throw new Error('Expected a JSON array of sessions');
        return body as PlayerSession[];
      },
    );
    return envelope.data;
  }

  async getClan(clanTag: string, options: ClanStatsOptions): Promise<ClanResponse> {
    const tag = assertClanTag(clanTag);
    const { start, end } = assertTimeRange(options.start, options.end, MAX_CLAN_RANGE_MS, 'Clan time range');
    const envelope = await this.requestWithFlow<ClanResponse>(
      `/clan/${encodeURIComponent(tag)}`,
      { start, end },
      'clan',
      (body) => {
        if (!isRecord(body) || !isRecord(body.clan)) {
          throw new Error('Expected an object with a "clan" field');
        }
        return body as unknown as ClanResponse;
      },
    );
    return envelope.data;
  }

  async getClanSessions(clanTag: string, options: ClanSessionsOptions): Promise<ClanSessionsResponse> {
    const tag = assertClanTag(clanTag);
    const { start, end } = assertTimeRange(options.start, options.end, MAX_CLAN_RANGE_MS, 'Clan sessions time range');
    const page = options.page ?? 1;
    if (!isFiniteNumber(page) || page < 1 || page > 200) {
      throw new ValidationError('Clan sessions page must be between 1 and 200.');
    }
    const limit = options.limit ?? 20;
    if (!isFiniteNumber(limit) || limit < 1 || limit > 50) {
      throw new ValidationError('Clan sessions limit must be between 1 and 50.');
    }

    const envelope = await this.requestWithFlow<ClanSessionsResponse>(
      `/clan/${encodeURIComponent(tag)}/sessions`,
      { start, end, page: String(Math.floor(page)), limit: String(Math.floor(limit)) },
      'clanSessions',
      (body) => {
        if (!isRecord(body) || !isArray(body.results)) {
          throw new Error('Expected an object with a "results" array');
        }
        return body as unknown as ClanSessionsResponse;
      },
    );
    return envelope.data;
  }

  async getClanLeaderboard(): Promise<ClanLeaderboard> {
    const envelope = await this.requestWithFlow<ClanLeaderboard>(
      '/clans/leaderboard',
      {},
      'leaderboard',
      (body) => {
        if (!isRecord(body) || !isArray(body.clans)) {
          throw new Error('Expected an object with a "clans" array');
        }
        return body as unknown as ClanLeaderboard;
      },
    );
    return envelope.data;
  }

  // -------------------------------------------------------------------------
  // Request flow: validate -> cache -> dedupe -> rate limit -> request -> cache
  // -------------------------------------------------------------------------

  /**
   * Runs the full request flow for a single logical request.
   * Cache hits never consume rate-limit tokens and never hit the network.
   */
  private async requestWithFlow<T>(
    path: string,
    query: Record<string, string>,
    bucket: EndpointBucket,
    parse: (body: unknown) => T,
  ): Promise<CachedEnvelope<T>> {
    const key = this.buildKey(path, query);
    const ttl = this.ttls[bucket];

    const cached = this.cache.get(key) as CachedEnvelope<T> | undefined;
    if (cached) return cached;

    const inFlight = this.dedupe.get(key) as Promise<CachedEnvelope<T>> | undefined;
    if (inFlight) return inFlight;

    const promise = this.dedupe.start(key, this.fetchAndCache<T>(path, query, key, bucket, ttl, parse)) as Promise<CachedEnvelope<T>>;
    return promise;
  }

  private async fetchAndCache<T>(
    path: string,
    query: Record<string, string>,
    key: string,
    bucket: EndpointBucket,
    ttl: number,
    parse: (body: unknown) => T,
  ): Promise<CachedEnvelope<T>> {
    const waitMs = await this.rateLimiter.acquire(bucket);
    if (waitMs > 0) this.logger.debug(`rate-limited ${bucket}: waited ${waitMs}ms`);

    const result = await this.executeWithRetries<T>(path, query, parse);
    this.cache.set(key, result, ttl);
    return result;
  }

  private buildKey(path: string, query: Record<string, string>): string {
    const parts = Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([k, v]) => `${k}=${v}`)
      .sort();
    return parts.length === 0 ? path : `${path}?${parts.join('&')}`;
  }

  // -------------------------------------------------------------------------
  // HTTP + retry/backoff
  // -------------------------------------------------------------------------

  private async executeWithRetries<T>(
    path: string,
    query: Record<string, string>,
    parse: (body: unknown) => T,
  ): Promise<CachedEnvelope<T>> {
    const url = this.buildUrl(path, query);

    let attempt = 0;
    let lastError: OpenFrontError | undefined;
    while (true) {
      try {
        return await this.singleFetch<T>(url, parse);
      } catch (err) {
        lastError = err instanceof OpenFrontError ? err : new NetworkError(String(err));
        if (!this.isRetryable(lastError)) {
          throw lastError;
        }
        if (attempt >= this.maxRetries) {
          // No retries are configured, or retries were exhausted.
          if (attempt === 0) throw lastError;
          throw this.buildExhaustedError(lastError);
        }
        const delay = this.computeBackoff(attempt, lastError);
        this.logger.warn(`${lastError.kind} on ${path} (attempt ${attempt + 1}/${this.maxRetries}); retrying in ${delay}ms`);
        await this.sleepFn(delay);
        attempt += 1;
      }
    }
  }

  private buildExhaustedError(lastError: OpenFrontError): RetriesExhaustedError {
    if (lastError.kind === 'rateLimited') {
      return new RetriesExhaustedError(
        `The OpenFront API is rate-limiting requests. Please try again later.`,
        { status: 429, retryAfterMs: lastError.retryAfterMs },
      );
    }
    return new RetriesExhaustedError(
      `The OpenFront API could not be reached after ${this.maxRetries + 1} attempt(s). Please try again shortly.`,
      { status: lastError.status },
    );
  }

  private buildUrl(path: string, query: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private async singleFetch<T>(
    url: string,
    parse: (body: unknown) => T,
  ): Promise<CachedEnvelope<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (err) {
      const aborted =
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError');
      if (aborted) {
        throw new TimeoutError(`The OpenFront API timed out after ${this.timeoutMs}ms.`);
      }
      throw new NetworkError('Could not reach the OpenFront API.', { cause: err });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      await this.handleHttpError(url, response);
    }

    const text = await response.text().catch((err: unknown) => {
      throw new NetworkError('Failed to read the OpenFront API response.', { cause: err });
    });
    const body = parseJsonBody(text, url);

    let data: T;
    try {
      data = parse(body);
    } catch (err) {
      throw err instanceof MalformedResponseError ? err : new MalformedResponseError(`The OpenFront API returned an unexpected response.`, { cause: err });
    }

    const contentRange = parseContentRange(response.headers.get('content-range'));
    return { data, contentRange };
  }

  private async handleHttpError(url: string, response: Response): Promise<never> {
    const status = response.status;
    let detail = '';
    try {
      const text = await response.text();
      const body = parseJsonBody(text, url);
      if (isRecord(body)) {
        detail = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : '';
      }
    } catch {
      detail = '';
    }
    const suffix = detail ? ` (${detail})` : '';

    switch (status) {
      case 429:
        throw new RateLimitedError(
          `The OpenFront API rate-limited the request.`,
          this.retryAfterMs(response),
        );
      case 400:
      case 422:
        throw new ValidationError(`The OpenFront API rejected the request.${suffix}`);
      case 404:
        throw new NotFoundError(`The requested resource was not found.`);
      case 500:
      case 502:
      case 503:
        throw new ServerError(`The OpenFront API returned a ${status} error.${suffix}`, status);
      default:
        if (status >= 500) {
          throw new ServerError(`The OpenFront API returned a ${status} error.${suffix}`, status);
        }
        throw new ValidationError(`The OpenFront API rejected the request (HTTP ${status}).${suffix}`);
    }
  }

  private retryAfterMs(response: Response): number | undefined {
    const header = response.headers.get('retry-after');
    if (!header) return undefined;
    const seconds = Number(header);
    if (isFiniteNumber(seconds) && seconds >= 0) return seconds * 1000;
    const date = new Date(header);
    if (!Number.isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
    return undefined;
  }

  private isRetryable(err: OpenFrontError): boolean {
    switch (err.kind) {
      case 'rateLimited':
      case 'serverError':
      case 'network':
      case 'timeout':
        return true;
      case 'validation':
      case 'notFound':
      case 'malformed':
      case 'retriesExhausted':
        return false;
    }
  }

  private computeBackoff(attempt: number, lastError: OpenFrontError): number {
    const retryAfter = lastError.kind === 'rateLimited' ? lastError.retryAfterMs : undefined;
    if (retryAfter !== undefined) {
      return Math.min(retryAfter, this.backoffMaxMs);
    }
    const exponential = this.backoffBaseMs * 2 ** attempt;
    const jittered = exponential * (1 + this.jitter() * 0.5);
    return Math.min(jittered, this.backoffMaxMs);
  }
}