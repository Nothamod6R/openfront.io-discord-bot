import 'dotenv/config';

export interface Config {
  discordToken: string;
  discordClientId: string;
  guildId?: string;
  apiBaseUrl: string;
  apiTimeoutMs: number;
  apiMaxRetries: number;
  cacheTtlGamesMs: number;
  cacheTtlGameDetailMs: number;
  cacheTtlPlayerMs: number;
  cacheTtlPlayerGamesMs: number;
  cacheTtlClanMs: number;
  cacheTtlClanSessionsMs: number;
  cacheTtlLeaderboardMs: number;
  rateLimitRps: number;
  rateLimitBurst: number;
  port: number;
  logLevel: string;
}

function parseIntEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got "${raw}"`);
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const token = env.DISCORD_TOKEN ?? '';
  const clientId = env.DISCORD_CLIENT_ID ?? '';

  if (token.trim() === '') {
    throw new Error('DISCORD_TOKEN is required (set it in .env or the environment)');
  }
  if (clientId.trim() === '') {
    throw new Error('DISCORD_CLIENT_ID is required (set it in .env or the environment)');
  }

  return {
    discordToken: token,
    discordClientId: clientId,
    guildId: env.GUILD_ID?.trim() || undefined,
    apiBaseUrl: (env.API_BASE_URL ?? 'https://api.openfront.io/public').replace(/\/+$/, '') || 'https://api.openfront.io/public',
    apiTimeoutMs: parseIntEnv(env, 'API_TIMEOUT_MS', 15000),
    apiMaxRetries: parseIntEnv(env, 'API_MAX_RETRIES', 4),
    cacheTtlGamesMs: parseIntEnv(env, 'CACHE_TTL_GAMES_MS', 300_000),
    cacheTtlGameDetailMs: parseIntEnv(env, 'CACHE_TTL_GAME_DETAIL_MS', 600_000),
    cacheTtlPlayerMs: parseIntEnv(env, 'CACHE_TTL_PLAYER_MS', 900_000),
    cacheTtlPlayerGamesMs: parseIntEnv(env, 'CACHE_TTL_PLAYER_GAMES_MS', 300_000),
    cacheTtlClanMs: parseIntEnv(env, 'CACHE_TTL_CLAN_MS', 300_000),
    cacheTtlClanSessionsMs: parseIntEnv(env, 'CACHE_TTL_CLAN_SESSIONS_MS', 300_000),
    cacheTtlLeaderboardMs: parseIntEnv(env, 'CACHE_TTL_LEADERBOARD_MS', 600_000),
    rateLimitRps: parseIntEnv(env, 'RATE_LIMIT_RPS', 2),
    rateLimitBurst: parseIntEnv(env, 'RATE_LIMIT_BURST', 5),
    port: parseIntEnv(env, 'PORT', 3000),
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}