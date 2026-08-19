import { ValidationError } from './errors.js';

/**
 * Conservative client-side validation. These are intentionally loose guards
 * that catch obviously-malformed input before any network request. The
 * OpenFront API remains the final authority on what is valid.
 */

const GAME_ID_RE = /^[A-Za-z0-9_-]{3,32}$/;
const PLAYER_ID_RE = /^[A-Za-z0-9_-]{3,64}$/;
const CLAN_TAG_RE = /^[A-Za-z0-9_]{1,12}$/;

export function assertGameId(gameId: string): string {
  if (typeof gameId !== 'string' || gameId.trim() === '') {
    throw new ValidationError('A game ID is required.');
  }
  const id = gameId.trim();
  if (!GAME_ID_RE.test(id)) {
    throw new ValidationError(`"${id}" does not look like a valid OpenFront game ID.`);
  }
  return id;
}

export function assertPlayerId(playerId: string): string {
  if (typeof playerId !== 'string' || playerId.trim() === '') {
    throw new ValidationError('A player ID is required.');
  }
  const id = playerId.trim();
  if (!PLAYER_ID_RE.test(id)) {
    throw new ValidationError(`"${id}" does not look like a valid OpenFront player ID.`);
  }
  return id;
}

export function assertClanTag(clanTag: string): string {
  if (typeof clanTag !== 'string' || clanTag.trim() === '') {
    throw new ValidationError('A clan tag is required.');
  }
  const tag = clanTag.trim().toUpperCase();
  if (!CLAN_TAG_RE.test(tag)) {
    throw new ValidationError(`"${clanTag}" does not look like a valid OpenFront clan tag.`);
  }
  return tag;
}

export function isIso8601(value: string): boolean {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

/** Validates a time range and returns normalized ISO timestamps. */
export function assertTimeRange(
  start: string,
  end: string,
  maxRangeMs: number,
  label = 'time range',
): { start: string; end: string } {
  if (!isIso8601(start) || !isIso8601(end)) {
    throw new ValidationError(`${label} start and end must be valid ISO 8601 timestamps.`);
  }
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (startMs >= endMs) {
    throw new ValidationError(`${label} start must be before end.`);
  }
  if (endMs - startMs > maxRangeMs) {
    throw new ValidationError(`${label} cannot exceed ${Math.round(maxRangeMs / 86_400_000)} day(s).`);
  }
  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}