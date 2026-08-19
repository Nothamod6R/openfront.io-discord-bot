import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { TokenBucketRateLimiter } from '../src/openfront/rateLimiter.js';

describe('TokenBucketRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws on invalid configuration', () => {
    expect(() => new TokenBucketRateLimiter({ rps: 0, burst: 1 })).toThrow();
    expect(() => new TokenBucketRateLimiter({ rps: 1, burst: 0 })).toThrow();
  });

  it('allows up to burst tokens immediately', async () => {
    const clock = { value: 0 };
    const limiter = new TokenBucketRateLimiter({
      rps: 1,
      burst: 3,
      now: () => clock.value,
      sleep: () => Promise.resolve(),
    });
    const delays = await Promise.all([limiter.acquire('games'), limiter.acquire('games'), limiter.acquire('games')]);
    expect(delays).toEqual([0, 0, 0]);
  });

  it('queues requests once tokens are exhausted until refill', async () => {
    const clock = { value: 0 };
    const sleeps: number[] = [];
    const limiter = new TokenBucketRateLimiter({
      rps: 1,
      burst: 1,
      now: () => clock.value,
      sleep: (ms) => {
        sleeps.push(ms);
        clock.value += ms;
        return Promise.resolve();
      },
    });

    const first = await limiter.acquire('gameDetail'); // immediate
    const second = await limiter.acquire('gameDetail'); // must wait ~1000ms for refill
    expect(first).toBe(0);
    expect(second).toBeGreaterThan(0);
    expect(sleeps.some((ms) => ms >= 1000)).toBe(true);
  });

  it('keeps per-endpoint buckets separate', async () => {
    const clock = { value: 0 };
    const sleeps: number[] = [];
    const limiter = new TokenBucketRateLimiter({
      rps: 1,
      burst: 1,
      now: () => clock.value,
      sleep: (ms) => {
        sleeps.push(ms);
        clock.value += ms;
        return Promise.resolve();
      },
    });
    const a1 = await limiter.acquire('games');
    const a2 = await limiter.acquire('games');
    const b1 = await limiter.acquire('gameDetail'); // fresh bucket → immediate
    expect(a1).toBe(0);
    expect(a2).toBeGreaterThan(0);
    expect(b1).toBe(0);
  });

  it('supports per-endpoint rate overrides', async () => {
    const clock = { value: 0 };
    const sleeps: number[] = [];
    const limiter = new TokenBucketRateLimiter({
      rps: 1,
      burst: 1,
      bucketRates: { leaderboard: { rps: 10, burst: 10 } },
      now: () => clock.value,
      sleep: (ms) => {
        sleeps.push(ms);
        clock.value += ms;
        return Promise.resolve();
      },
    });
    // leaderboard bucket has burst 10 → 10 immediate acquires
    const delays = await Promise.all(
      Array.from({ length: 10 }, () => limiter.acquire('leaderboard')),
    );
    expect(delays.every((d) => d === 0)).toBe(true);
  });

  it('reset restores buckets', async () => {
    const clock = { value: 0 };
    const limiter = new TokenBucketRateLimiter({
      rps: 0.001,
      burst: 1,
      now: () => clock.value,
      sleep: () => Promise.resolve(),
    });
    await limiter.acquire('games');
    limiter.reset();
    const again = await limiter.acquire('games');
    expect(again).toBe(0);
  });
});