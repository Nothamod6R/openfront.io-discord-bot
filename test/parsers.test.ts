import { describe, expect, it } from 'vitest';
import { parseContentRange, parseJsonBody } from '../src/openfront/parsers.js';
import { MalformedResponseError } from '../src/openfront/errors.js';

describe('parseContentRange', () => {
  it('parses a valid header with a numeric total', () => {
    expect(parseContentRange('games 0-20/149610')).toEqual({ unit: 'games', start: 0, end: 20, total: 149610 });
  });

  it('parses a header with an asterisk total', () => {
    expect(parseContentRange('games 5-15/*')).toEqual({ unit: 'games', start: 5, end: 15, total: null });
  });

  it('parses multi-digit unit ranges', () => {
    expect(parseContentRange('games 5-15/399')).toEqual({ unit: 'games', start: 5, end: 15, total: 399 });
  });

  it('returns null for missing header', () => {
    expect(parseContentRange(null)).toBeNull();
    expect(parseContentRange(undefined)).toBeNull();
    expect(parseContentRange('')).toBeNull();
  });

  it('returns null for malformed headers', () => {
    expect(parseContentRange('not-a-header')).toBeNull();
    expect(parseContentRange('games 0-20')).toBeNull();
    expect(parseContentRange('games x-y/10')).toBeNull();
    expect(parseContentRange('games 20-0/10')).toBeNull();
    expect(parseContentRange('games 0-20/abc')).toBeNull();
  });
});

describe('parseJsonBody', () => {
  it('parses valid JSON', () => {
    expect(parseJsonBody('{"a":1}', '/games')).toEqual({ a: 1 });
  });

  it('parses top-level arrays', () => {
    expect(parseJsonBody('[1,2]', '/games')).toEqual([1, 2]);
  });

  it('throws MalformedResponseError for invalid JSON', () => {
    expect(() => parseJsonBody('{oops', '/games')).toThrow(MalformedResponseError);
  });
});