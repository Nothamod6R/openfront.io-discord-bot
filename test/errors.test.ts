import { describe, expect, it } from 'vitest';
import { errorEmbed } from '../src/discord/errors.js';
import {
  MalformedResponseError,
  NetworkError,
  NotFoundError,
  RateLimitedError,
  RetriesExhaustedError,
  ServerError,
  TimeoutError,
  ValidationError,
} from '../src/openfront/errors.js';

describe('errorEmbed', () => {
  it('maps not-found to a friendly embed without stack traces', () => {
    const embed = errorEmbed(new NotFoundError('x')).toJSON();
    expect(embed.title).toContain('Not Found');
    expect(embed.description).toContain('does not exist');
    expect(embed.description).not.toContain('Error:');
  });

  it('maps validation errors to an invalid-input embed', () => {
    const embed = errorEmbed(new ValidationError('A game ID is required.')).toJSON();
    expect(embed.title).toContain('Invalid Input');
    expect(embed.description).toContain('A game ID is required.');
  });

  it('maps rate-limited errors with a retry hint', () => {
    const embed = errorEmbed(new RateLimitedError('rate limited', 10_000)).toJSON();
    expect(embed.title).toContain('Rate Limit');
    expect(embed.description).toContain('10 seconds');
  });

  it('maps exhausted retries to a rate-limit hint', () => {
    const embed = errorEmbed(new RetriesExhaustedError('boom', { status: 429, retryAfterMs: 5000 })).toJSON();
    expect(embed.title).toContain('Rate Limit');
  });

  it('maps server errors to a temporary-failure embed', () => {
    const embed = errorEmbed(new ServerError('boom', 500)).toJSON();
    expect(embed.title).toContain('Temporary API Failure');
  });

  it('maps timeouts and network errors', () => {
    expect(errorEmbed(new TimeoutError('t')).toJSON().title).toContain('Timed Out');
    expect(errorEmbed(new NetworkError('n')).toJSON().title).toContain('Network Error');
    expect(errorEmbed(new MalformedResponseError('m')).toJSON().title).toContain('Invalid Response');
  });

  it('falls back for unknown errors', () => {
    const embed = errorEmbed(new Error('unknown')).toJSON();
    expect(embed.title).toContain('Unexpected Error');
    expect(embed.description).not.toContain('unknown');
  });
});