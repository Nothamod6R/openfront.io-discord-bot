import type { EndpointBucket } from '../models/types.js';

/**
 * Configurable token-bucket rate limiter with per-endpoint buckets.
 *
 * Supports a base rate applied to every endpoint plus per-endpoint overrides.
 * `acquire()` resolves once the caller is allowed to send a request; it never
 * rejects (except in degenerate misconfiguration).
 */

export type BucketRates = Partial<Record<EndpointBucket, { rps?: number; burst?: number }>>;

export interface RateLimiterOptions {
  rps: number;
  burst: number;
  bucketRates?: BucketRates;
  now?: () => number;
  /** Injectable sleep, mainly for deterministic tests. Defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

interface BucketState {
  tokens: number;
  lastRefill: number;
  chain: Promise<void>;
}

export class TokenBucketRateLimiter {
  private readonly baseRps: number;
  private readonly baseBurst: number;
  private readonly bucketRates: BucketRates;
  private readonly now: () => number;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly buckets = new Map<EndpointBucket, BucketState>();

  constructor(options: RateLimiterOptions) {
    if (options.rps <= 0 || options.burst <= 0) {
      throw new Error('Rate limiter rps and burst must be positive');
    }
    this.baseRps = options.rps;
    this.baseBurst = options.burst;
    this.bucketRates = options.bucketRates ?? {};
    this.now = options.now ?? Date.now;
    this.sleepFn = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  private rates(bucket: EndpointBucket): { rps: number; burst: number } {
    const overrides = this.bucketRates[bucket];
    const rps = Math.max(0.01, overrides?.rps ?? this.baseRps);
    const burst = Math.max(1, Math.round(overrides?.burst ?? this.baseBurst));
    return { rps, burst };
  }

  private stateFor(bucket: EndpointBucket): BucketState {
    let state = this.buckets.get(bucket);
    if (!state) {
      const { burst } = this.rates(bucket);
      const now = this.now();
      state = { tokens: burst, lastRefill: now, chain: Promise.resolve() };
      this.buckets.set(bucket, state);
    }
    return state;
  }

  private refill(state: BucketState, bucket: EndpointBucket, now: number): void {
    const { rps, burst } = this.rates(bucket);
    if (state.lastRefill === 0) {
      state.lastRefill = now;
      return;
    }
    const elapsedMs = now - state.lastRefill;
    if (elapsedMs <= 0) return;
    state.tokens = Math.min(burst, state.tokens + (elapsedMs / 1000) * rps);
    state.lastRefill = now;
  }

  /**
   * Waits until a token is available for the given endpoint bucket,
   * then consumes one token. Resolves with the wait time in ms.
   */
  acquire(bucket: EndpointBucket): Promise<number> {
    const state = this.stateFor(bucket);
    const { rps } = this.rates(bucket);

    const p = state.chain.then(() => this.waitForToken(state, bucket, rps));
    state.chain = p.then(
      () => undefined,
      () => undefined,
    );
    return p;
  }

  private async waitForToken(state: BucketState, bucket: EndpointBucket, rps: number): Promise<number> {
    let now = this.now();
    this.refill(state, bucket, now);

    if (state.tokens >= 1) {
      state.tokens -= 1;
      return 0;
    }

    const deficit = 1 - state.tokens;
    const waitMs = Math.max(1, Math.ceil((deficit / rps) * 1000));
    await this.sleepFn(waitMs);

    now = this.now();
    this.refill(state, bucket, now);
    state.tokens -= 1;
    return waitMs;
  }

  /** Resets all buckets (mainly for tests). */
  reset(): void {
    this.buckets.clear();
  }
}