import { describe, expect, it } from 'vitest';
import { ValidationError } from '../src/openfront/errors.js';
import {
  assertClanTag,
  assertGameId,
  assertPlayerId,
  assertTimeRange,
} from '../src/openfront/validation.js';

describe('assertGameId', () => {
  it('accepts typical game IDs', () => {
    expect(assertGameId('ABSgwin6')).toBe('ABSgwin6');
    expect(assertGameId('mHZKwntW')).toBe('mHZKwntW');
    expect(assertGameId('abc-123_x')).toBe('abc-123_x');
  });

  it('trims surrounding whitespace', () => {
    expect(assertGameId('  ABSgwin6  ')).toBe('ABSgwin6');
  });

  it('rejects empty and clearly invalid input', () => {
    expect(() => assertGameId('')).toThrow(ValidationError);
    expect(() => assertGameId('   ')).toThrow(ValidationError);
    expect(() => assertGameId('ab')).toThrow(ValidationError);
    expect(() => assertGameId('has space here')).toThrow(ValidationError);
  });
});

describe('assertPlayerId', () => {
  it('accepts typical player IDs', () => {
    expect(assertPlayerId('HabCsQYR')).toBe('HabCsQYR');
    expect(assertPlayerId('eZ34VQpY')).toBe('eZ34VQpY');
  });

  it('rejects empty input', () => {
    expect(() => assertPlayerId('')).toThrow(ValidationError);
  });
});

describe('assertClanTag', () => {
  it('accepts typical clan tags and uppercases them', () => {
    expect(assertClanTag('UN')).toBe('UN');
    expect(assertClanTag('un')).toBe('UN');
    expect(assertClanTag('TRADE')).toBe('TRADE');
  });

  it('rejects clearly invalid tags', () => {
    expect(() => assertClanTag('')).toThrow(ValidationError);
    expect(() => assertClanTag('tag with spaces')).toThrow(ValidationError);
  });
});

describe('assertTimeRange', () => {
  it('normalizes a valid range to ISO timestamps', () => {
    const { start, end } = assertTimeRange(
      '2026-08-18T00:00:00.000Z',
      '2026-08-18T12:00:00.000Z',
      2 * 86_400_000,
    );
    expect(start).toBe('2026-08-18T00:00:00.000Z');
    expect(end).toBe('2026-08-18T12:00:00.000Z');
  });

  it('rejects invalid timestamps', () => {
    expect(() => assertTimeRange('nope', '2026-08-18T12:00:00.000Z', 86_400_000)).toThrow(ValidationError);
    expect(() => assertTimeRange('2026-08-18T00:00:00.000Z', 'nope', 86_400_000)).toThrow(ValidationError);
  });

  it('rejects reversed ranges', () => {
    expect(() => assertTimeRange('2026-08-18T12:00:00.000Z', '2026-08-18T00:00:00.000Z', 86_400_000)).toThrow(
      ValidationError,
    );
  });

  it('rejects ranges longer than the maximum', () => {
    expect(() =>
      assertTimeRange('2026-08-01T00:00:00.000Z', '2026-08-18T00:00:00.000Z', 86_400_000),
    ).toThrow(ValidationError);
  });
});