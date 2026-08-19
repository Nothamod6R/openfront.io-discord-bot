import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { RequestDeduplicator } from '../src/openfront/deduplicator.js';

describe('RequestDeduplicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shares a single in-flight promise across callers for the same key', async () => {
    const dedupe = new RequestDeduplicator();
    let resolveFirst!: (v: string) => void;
    const first = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });
    const tracked = dedupe.start('k', first);

    expect(dedupe.get('k')).toBe(tracked);
    const second = dedupe.get('k');
    expect(second).toBe(tracked);

    resolveFirst('done');
    await vi.runAllTimersAsync();
    await expect(tracked).resolves.toBe('done');
    await expect(second).resolves.toBe('done');
  });

  it('removes the flight entry once the promise settles', async () => {
    const dedupe = new RequestDeduplicator();
    dedupe.start('k', Promise.resolve(42));
    await vi.runAllTimersAsync();
    expect(dedupe.has('k')).toBe(false);
    expect(dedupe.size).toBe(0);
  });

  it('removes the flight entry when the promise rejects', async () => {
    const dedupe = new RequestDeduplicator();
    const failing = Promise.reject(new Error('boom'));
    const tracked = dedupe.start('k', failing);
    await expect(tracked).rejects.toThrow('boom');
    expect(dedupe.has('k')).toBe(false);
  });

  it('keeps separate entries for different keys', () => {
    const dedupe = new RequestDeduplicator();
    const a = dedupe.start('a', Promise.resolve(1));
    const b = dedupe.start('b', Promise.resolve(2));
    expect(dedupe.size).toBe(2);
    expect(a).not.toBe(b);
  });

  it('clears all flights', () => {
    const dedupe = new RequestDeduplicator();
    dedupe.start('a', Promise.resolve(1));
    dedupe.start('b', Promise.resolve(2));
    expect(dedupe.size).toBe(2);
    dedupe.clear();
    expect(dedupe.size).toBe(0);
  });
});