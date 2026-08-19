import { describe, expect, it, vi } from 'vitest';
import {
  MalformedResponseError,
  NetworkError,
  NotFoundError,
  RetriesExhaustedError,
  TimeoutError,
  ValidationError,
} from '../src/openfront/errors.js';
import { jsonResponse, loadFixture, makeClient } from './helpers.js';

const GAME_DETAIL = loadFixture('game-detail.json');
const GAMES_LIST = loadFixture('games-list.json') as unknown[];
const PLAYER = loadFixture('player.json');
const PLAYER_GAMES = loadFixture('player-games.json');
const PLAYER_SESSIONS = loadFixture('player-sessions.json');
const CLAN = loadFixture('clan.json');
const CLAN_SESSIONS = loadFixture('clan-sessions.json');
const LEADERBOARD = loadFixture('clans-leaderboard.json');

const GAME_DETAIL_ID = (GAME_DETAIL as { info: { gameID: string } }).info.gameID;

function queryParams(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe('OpenFrontApiClient endpoint calls', () => {
  it('getGame builds a turns=false URL and parses the game detail', async () => {
    const { client, calls } = makeClient({ handler: () => jsonResponse(GAME_DETAIL) });
    const result = await client.getGame('mHZKwntW');
    expect(calls[0]?.url).toBe('https://api.openfront.io/public/game/mHZKwntW?turns=false');
    expect(result.info.gameID).toBe(GAME_DETAIL_ID);
    expect(result.info.config.gameMap).toBeDefined();
  });

  it('getGames builds a query with filters and reads Content-Range', async () => {
    const { client, calls } = makeClient({
      handler: () =>
        jsonResponse(GAMES_LIST, 200, { 'content-range': 'games 0-20/149610' }),
    });
    const result = await client.getGames({
      start: '2026-08-18T00:00:00.000Z',
      end: '2026-08-19T00:00:00.000Z',
      type: 'Public',
      mode: 'Team',
      rankedType: 'unranked',
      playerTeams: 'Duos',
      limit: 20,
      offset: 5,
    });
    const url = calls[0]?.url ?? '';
    const params = queryParams(url);
    expect(url).toContain('/games?');
    expect(params.get('start')).toBe('2026-08-18T00:00:00.000Z');
    expect(params.get('end')).toBe('2026-08-19T00:00:00.000Z');
    expect(params.get('type')).toBe('Public');
    expect(params.get('mode')).toBe('Team');
    expect(params.get('rankedType')).toBe('unranked');
    expect(params.get('playerTeams')).toBe('Duos');
    expect(params.get('limit')).toBe('20');
    expect(params.get('offset')).toBe('5');
    expect(Array.isArray(result.games)).toBe(true);
    expect(result.contentRange).toEqual({ unit: 'games', start: 0, end: 20, total: 149610 });
  });

  it('getGames omits optional filters that are not provided', async () => {
    const { client, calls } = makeClient({ handler: () => jsonResponse(GAMES_LIST) });
    await client.getGames({ start: '2026-08-18T00:00:00.000Z', end: '2026-08-19T00:00:00.000Z' });
    const url = calls[0]?.url ?? '';
    expect(url).not.toContain('type=');
    expect(url).not.toContain('mode=');
  });

  it('getGames returns null contentRange when the header is missing', async () => {
    const { client } = makeClient({ handler: () => jsonResponse(GAMES_LIST) });
    const result = await client.getGames({ start: '2026-08-18T00:00:00.000Z', end: '2026-08-19T00:00:00.000Z' });
    expect(result.contentRange).toBeNull();
  });

  it('getGames tolerates a malformed Content-Range header', async () => {
    const { client } = makeClient({
      handler: () => jsonResponse(GAMES_LIST, 200, { 'content-range': 'garbage' }),
    });
    const result = await client.getGames({ start: '2026-08-18T00:00:00.000Z', end: '2026-08-19T00:00:00.000Z' });
    expect(result.contentRange).toBeNull();
    expect(result.games.length).toBeGreaterThan(0);
  });

  it('getPlayer parses the player object', async () => {
    const { client } = makeClient({ handler: () => jsonResponse(PLAYER) });
    const result = await client.getPlayer('HabCsQYR');
    expect(result.publicId).toBe('HabCsQYR');
    expect(result.username).toBe('evan');
  });

  it('getPlayerGames sends filter/type/cursor and parses nextCursor', async () => {
    const { client, calls } = makeClient({ handler: () => jsonResponse(PLAYER_GAMES) });
    const result = await client.getPlayerGames('HabCsQYR', { filter: 'team', type: 'public' });
    const url = calls[0]?.url ?? '';
    expect(url).toContain('filter=team');
    expect(url).toContain('type=public');
    expect(result.results.length).toBeGreaterThan(0);
    expect(typeof result.nextCursor).toBe('string');
  });

  it('getPlayerGames sends cursor for subsequent pages', async () => {
    const { client, calls } = makeClient({ handler: () => jsonResponse(PLAYER_GAMES) });
    await client.getPlayerGames('HabCsQYR', { cursor: 'opaque-token' });
    expect(calls[0]?.url ?? '').toContain('cursor=opaque-token');
  });

  it('getPlayerSessions parses an array of sessions', async () => {
    const { client } = makeClient({ handler: () => jsonResponse(PLAYER_SESSIONS) });
    const result = await client.getPlayerSessions('HabCsQYR');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('gameId');
  });

  it('getClan sends start/end and parses the clan object', async () => {
    const { client, calls } = makeClient({ handler: () => jsonResponse(CLAN) });
    const result = await client.getClan('UN', {
      start: '2026-08-18T00:00:00.000Z',
      end: '2026-08-19T00:00:00.000Z',
    });
    const url = calls[0]?.url ?? '';
    const params = queryParams(url);
    expect(params.get('start')).toBe('2026-08-18T00:00:00.000Z');
    expect(params.get('end')).toBe('2026-08-19T00:00:00.000Z');
    expect(result.clan.clanTag).toBe('UN');
  });

  it('getClanSessions sends page/limit and parses pagination info', async () => {
    const { client, calls } = makeClient({ handler: () => jsonResponse(CLAN_SESSIONS) });
    const result = await client.getClanSessions('UN', {
      start: '2026-08-18T00:00:00.000Z',
      end: '2026-08-19T00:00:00.000Z',
      page: 2,
      limit: 5,
    });
    const url = calls[0]?.url ?? '';
    const params = queryParams(url);
    expect(params.get('page')).toBe('2');
    expect(params.get('limit')).toBe('5');
    expect(result.total).toBe(1561);
    expect(result.page).toBe(1);
  });

  it('getClanLeaderboard parses the clans array', async () => {
    const { client } = makeClient({ handler: () => jsonResponse(LEADERBOARD) });
    const result = await client.getClanLeaderboard();
    expect(result.clans.length).toBeGreaterThan(0);
    expect(result.clans[0]).toHaveProperty('clanTag');
  });
});

describe('OpenFrontApiClient validation', () => {
  it('rejects an invalid game ID before any network call', async () => {
    const { client, calls } = makeClient({ handler: () => jsonResponse(GAME_DETAIL) });
    await expect(client.getGame('a')).rejects.toBeInstanceOf(ValidationError);
    expect(calls.length).toBe(0);
  });

  it('rejects an invalid player ID', async () => {
    const { client, calls } = makeClient({ handler: () => jsonResponse(PLAYER) });
    await expect(client.getPlayer('x')).rejects.toBeInstanceOf(ValidationError);
    expect(calls.length).toBe(0);
  });

  it('rejects an invalid clan tag', async () => {
    const { client, calls } = makeClient({ handler: () => jsonResponse(CLAN) });
    await expect(
      client.getClan('t a g', { start: '2026-08-18T00:00:00.000Z', end: '2026-08-19T00:00:00.000Z' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(calls.length).toBe(0);
  });

  it('rejects an out-of-range games time window', async () => {
    const { client } = makeClient({ handler: () => jsonResponse(GAMES_LIST) });
    await expect(
      client.getGames({ start: '2026-08-01T00:00:00.000Z', end: '2026-08-19T00:00:00.000Z' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a clan time window longer than 1 day', async () => {
    const { client } = makeClient({ handler: () => jsonResponse(CLAN) });
    await expect(
      client.getClan('UN', { start: '2026-08-01T00:00:00.000Z', end: '2026-08-19T00:00:00.000Z' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects invalid games filters', async () => {
    const { client } = makeClient({ handler: () => jsonResponse(GAMES_LIST) });
    await expect(
      client.getGames({
        start: '2026-08-18T00:00:00.000Z',
        end: '2026-08-19T00:00:00.000Z',
        type: 'NotAType' as never,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects limits outside 1-1000', async () => {
    const { client } = makeClient({ handler: () => jsonResponse(GAMES_LIST) });
    await expect(
      client.getGames({ start: '2026-08-18T00:00:00.000Z', end: '2026-08-19T00:00:00.000Z', limit: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      client.getGames({ start: '2026-08-18T00:00:00.000Z', end: '2026-08-19T00:00:00.000Z', limit: 1001 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects invalid player-games filter values', async () => {
    const { client } = makeClient({ handler: () => jsonResponse(PLAYER_GAMES) });
    await expect(client.getPlayerGames('HabCsQYR', { filter: 'bad' as never })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe('OpenFrontApiClient HTTP errors', () => {
  it('maps 404 to NotFoundError', async () => {
    const { client } = makeClient({ handler: () => jsonResponse({ error: 'Not found' }, 404) });
    await expect(client.getGame('Missing123')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('maps 400 to ValidationError with API message', async () => {
    const { client } = makeClient({
      handler: () => jsonResponse({ error: 'Bad request', message: 'Invalid start' }, 400),
    });
    const err = await client.getGame('BadID').catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain('Invalid start');
  });

  it('maps 500 to ServerError and surfaces after retries are exhausted', async () => {
    const { client } = makeClient({
      maxRetries: 2,
      handler: () => jsonResponse({ error: 'boom' }, 500),
    });
    await expect(client.getGame('mHZKwntW')).rejects.toBeInstanceOf(RetriesExhaustedError);
  });

  it('retries transient 5xx then succeeds', async () => {
    let n = 0;
    const { client, calls } = makeClient({
      maxRetries: 3,
      handler: () => {
        n += 1;
        if (n === 1) return jsonResponse({ error: 'temporary' }, 502);
        return jsonResponse(GAME_DETAIL);
      },
    });
    const result = await client.getGame('mHZKwntW');
    expect(result.info.gameID).toBe(GAME_DETAIL_ID);
    expect(calls.length).toBe(2);
  });

  it('respects Retry-After on 429', async () => {
    const sleeps: number[] = [];
    const { client, calls } = makeClient({
      maxRetries: 2,
      backoffMaxMs: 100_000,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      handler: () => jsonResponse({ error: 'rate limited' }, 429, { 'retry-after': '5' }),
    });
    await expect(client.getGame('mHZKwntW')).rejects.toBeInstanceOf(RetriesExhaustedError);
    expect(sleeps.some((ms) => ms >= 5000)).toBe(true);
    expect(calls.length).toBe(3); // initial + 2 retries
  });

  it('does not retry non-retryable 4xx errors', async () => {
    const { client, calls } = makeClient({
      maxRetries: 5,
      handler: () => jsonResponse({ error: 'Bad request' }, 400),
    });
    await expect(client.getGame('mHZKwntW')).rejects.toBeInstanceOf(ValidationError);
    expect(calls.length).toBe(1);
  });

  it('retries network failures', async () => {
    let n = 0;
    const { client, calls } = makeClient({
      maxRetries: 3,
      handler: () => {
        n += 1;
        if (n === 1) throw new TypeError('fetch failed');
        return jsonResponse(GAME_DETAIL);
      },
    });
    const result = await client.getGame('mHZKwntW');
    expect(result.info.gameID).toBe(GAME_DETAIL_ID);
    expect(calls.length).toBe(2);
  });

  it('maps abort to TimeoutError', async () => {
    const { client } = makeClient({
      handler: () => {
        throw new DOMException('The operation was aborted.', 'AbortError');
      },
    });
    await expect(client.getGame('mHZKwntW')).rejects.toBeInstanceOf(TimeoutError);
  });

  it('maps other network failures to NetworkError', async () => {
    const { client } = makeClient({
      handler: () => {
        throw new TypeError('fetch failed');
      },
    });
    await expect(client.getGame('mHZKwntW')).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('OpenFrontApiClient malformed responses', () => {
  it('throws MalformedResponseError for invalid JSON', async () => {
    const { client } = makeClient({
      handler: () => new Response('{oops', { status: 200, headers: { 'content-type': 'application/json' } }),
    });
    await expect(client.getGame('mHZKwntW')).rejects.toBeInstanceOf(MalformedResponseError);
  });

  it('throws MalformedResponseError when a games list is not an array', async () => {
    const { client } = makeClient({ handler: () => jsonResponse({ not: 'an array' }) });
    await expect(
      client.getGames({ start: '2026-08-18T00:00:00.000Z', end: '2026-08-19T00:00:00.000Z' }),
    ).rejects.toBeInstanceOf(MalformedResponseError);
  });

  it('throws MalformedResponseError when game detail lacks info', async () => {
    const { client } = makeClient({ handler: () => jsonResponse({ foo: 'bar' }) });
    await expect(client.getGame('mHZKwntW')).rejects.toBeInstanceOf(MalformedResponseError);
  });

  it('throws MalformedResponseError when player-games lacks results', async () => {
    const { client } = makeClient({ handler: () => jsonResponse({}) });
    await expect(client.getPlayerGames('HabCsQYR')).rejects.toBeInstanceOf(MalformedResponseError);
  });

  it('throws MalformedResponseError when clan response lacks clan field', async () => {
    const { client } = makeClient({ handler: () => jsonResponse({ foo: 'bar' }) });
    await expect(
      client.getClan('UN', { start: '2026-08-18T00:00:00.000Z', end: '2026-08-19T00:00:00.000Z' }),
    ).rejects.toBeInstanceOf(MalformedResponseError);
  });
});

describe('OpenFrontApiClient caching and deduplication', () => {
  it('serves repeated identical requests from cache without refetching', async () => {
    let n = 0;
    const { client, calls } = makeClient({
      handler: () => {
        n += 1;
        return jsonResponse(GAME_DETAIL);
      },
    });
    await client.getGame('mHZKwntW');
    await client.getGame('mHZKwntW');
    expect(n).toBe(1);
    expect(calls.length).toBe(1);
  });

  it('uses distinct cache keys for different query params', async () => {
    let n = 0;
    const { client } = makeClient({
      handler: () => {
        n += 1;
        return jsonResponse(GAMES_LIST);
      },
    });
    await client.getGames({ start: '2026-08-18T00:00:00.000Z', end: '2026-08-19T00:00:00.000Z', type: 'Public' });
    await client.getGames({ start: '2026-08-18T00:00:00.000Z', end: '2026-08-19T00:00:00.000Z', type: 'Private' });
    expect(n).toBe(2);
  });

  it('does not cache error responses', async () => {
    let n = 0;
    const { client } = makeClient({
      maxRetries: 0,
      handler: () => {
        n += 1;
        return jsonResponse({ error: 'Not found' }, 404);
      },
    });
    await expect(client.getGame('Missing123')).rejects.toBeInstanceOf(NotFoundError);
    await expect(client.getGame('Missing123')).rejects.toBeInstanceOf(NotFoundError);
    expect(n).toBe(2);
  });

  it('deduplicates concurrent identical requests to a single API call', async () => {
    let resolveFetch!: (r: Response) => void;
    const gate = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    let n = 0;
    const { client, calls } = makeClient({
      handler: () => {
        n += 1;
        return gate;
      },
    });

    const p1 = client.getGame('mHZKwntW');
    const p2 = client.getGame('mHZKwntW');
    const p3 = client.getGame('mHZKwntW');
    await vi.waitFor(() => expect(n).toBe(1));

    resolveFetch!(jsonResponse(GAME_DETAIL));
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1.info.gameID).toBe(GAME_DETAIL_ID);
    expect(r2.info.gameID).toBe(GAME_DETAIL_ID);
    expect(r3.info.gameID).toBe(GAME_DETAIL_ID);
    expect(calls.length).toBe(1);
  });

  it('does not deduplicate concurrent requests with different keys', async () => {
    let resolve1!: (r: Response) => void;
    let resolve2!: (r: Response) => void;
    const gate1 = new Promise<Response>((resolve) => {
      resolve1 = resolve;
    });
    const gate2 = new Promise<Response>((resolve) => {
      resolve2 = resolve;
    });
    let n = 0;
    const { client, calls } = makeClient({
      handler: () => {
        n += 1;
        return n === 1 ? gate1 : gate2;
      },
    });

    const p1 = client.getGame('mHZKwntW');
    const p2 = client.getPlayer('HabCsQYR');
    await vi.waitFor(() => expect(calls.length).toBe(2));

    resolve1!(jsonResponse(GAME_DETAIL));
    resolve2!(jsonResponse(PLAYER));
    await Promise.all([p1, p2]);
  });

  it('re-fetches after the TTL expires', async () => {
    vi.useFakeTimers();
    try {
      let n = 0;
      const { client } = makeClient({
        ttls: { gameDetail: 50 },
        handler: () => {
          n += 1;
          return jsonResponse(GAME_DETAIL);
        },
      });
      await client.getGame('mHZKwntW');
      await client.getGame('mHZKwntW');
      expect(n).toBe(1);
      vi.advanceTimersByTime(51);
      await client.getGame('mHZKwntW');
      expect(n).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not consume rate-limit tokens on cache hits', async () => {
    const { client, rateLimiter, calls } = makeClient({
      rps: 0.0001,
      burst: 1,
      handler: () => jsonResponse(GAME_DETAIL),
    });
    const acquireSpy = vi.spyOn(rateLimiter, 'acquire');

    await client.getGame('mHZKwntW'); // consumes the single token
    await client.getGame('mHZKwntW'); // served from cache — no acquire
    expect(acquireSpy).toHaveBeenCalledTimes(1);
    expect(calls.length).toBe(1);
  });
});