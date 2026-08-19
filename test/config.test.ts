import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws when DISCORD_TOKEN is missing', () => {
    expect(() => loadConfig({})).toThrow('DISCORD_TOKEN');
  });

  it('throws when DISCORD_CLIENT_ID is missing', () => {
    expect(() => loadConfig({ DISCORD_TOKEN: 'token' })).toThrow('DISCORD_CLIENT_ID');
  });

  it('loads with defaults when only required vars are present', () => {
    const config = loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_CLIENT_ID: '123' });
    expect(config.discordToken).toBe('tok');
    expect(config.discordClientId).toBe('123');
    expect(config.apiBaseUrl).toBe('https://api.openfront.io/public');
    expect(config.apiTimeoutMs).toBe(15000);
    expect(config.apiMaxRetries).toBe(4);
    expect(config.cacheTtlGamesMs).toBe(300_000);
    expect(config.rateLimitRps).toBe(2);
    expect(config.rateLimitBurst).toBe(5);
    expect(config.port).toBe(3000);
    expect(config.guildId).toBeUndefined();
  });

  it('parses custom values from the environment', () => {
    const config = loadConfig({
      DISCORD_TOKEN: 'tok',
      DISCORD_CLIENT_ID: '123',
      GUILD_ID: '456',
      API_BASE_URL: 'https://example.com/api/',
      API_TIMEOUT_MS: '1000',
      API_MAX_RETRIES: '2',
      CACHE_TTL_GAMES_MS: '123',
      RATE_LIMIT_RPS: '5',
      RATE_LIMIT_BURST: '10',
      PORT: '8080',
      LOG_LEVEL: 'debug',
    });
    expect(config.guildId).toBe('456');
    expect(config.apiBaseUrl).toBe('https://example.com/api');
    expect(config.apiTimeoutMs).toBe(1000);
    expect(config.apiMaxRetries).toBe(2);
    expect(config.cacheTtlGamesMs).toBe(123);
    expect(config.rateLimitRps).toBe(5);
    expect(config.rateLimitBurst).toBe(10);
    expect(config.port).toBe(8080);
    expect(config.logLevel).toBe('debug');
  });

  it('throws on non-integer numeric env vars', () => {
    expect(() =>
      loadConfig({ DISCORD_TOKEN: 'tok', DISCORD_CLIENT_ID: '123', PORT: 'not-a-number' }),
    ).toThrow('PORT');
  });

  it('trims empty optional values to undefined', () => {
    const config = loadConfig({
      DISCORD_TOKEN: 'tok',
      DISCORD_CLIENT_ID: '123',
      GUILD_ID: '   ',
      API_BASE_URL: '',
    });
    expect(config.guildId).toBeUndefined();
    expect(config.apiBaseUrl).toBe('https://api.openfront.io/public');
  });
});