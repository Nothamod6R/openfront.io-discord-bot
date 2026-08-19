import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { TtlCache } from '../src/openfront/cache.js';

describe('TtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and returns values', () => {
    const cache = new TtlCache<string>(1000);
    cache.set('a', 'one');
    expect(cache.get('a')).toBe('one');
    expect(cache.has('a')).toBe(true);
  });

  it('returns undefined for unknown keys', () => {
    const cache = new TtlCache<string>(1000);
    expect(cache.get('missing')).toBeUndefined();
    expect(cache.has('missing')).toBe(false);
  });

  it('expires entries after the default TTL', () => {
    const cache = new TtlCache<string>(1000);
    cache.set('a', 'one');
    vi.advanceTimersByTime(1001);
    expect(cache.get('a')).toBeUndefined();
  });

  it('supports per-key TTL overrides', () => {
    const cache = new TtlCache<string>(1000);
    cache.set('short', 'x', 100);
    cache.set('long', 'y', 5000);
    vi.advanceTimersByTime(200);
    expect(cache.get('short')).toBeUndefined();
    expect(cache.get('long')).toBe('y');
  });

  it('keeps distinct keys separate', () => {
    const cache = new TtlCache<string>(1000);
    cache.set('a', '1');
    cache.set('b', '2');
    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBe('2');
    expect(cache.size).toBe(2);
  });

  it('supports delete and clear', () => {
    const cache = new TtlCache<string>(1000);
    cache.set('a', '1');
    cache.set('b', '2');
    expect(cache.delete('a')).toBe(true);
    expect(cache.get('a')).toBeUndefined();
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('overwrites existing keys', () => {
    const cache = new TtlCache<string>(1000);
    cache.set('a', '1');
    cache.set('a', '2');
    expect(cache.get('a')).toBe('2');
    expect(cache.size).toBe(1);
  });
});