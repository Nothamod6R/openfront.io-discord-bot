/**
 * Request deduplication: while a request for a given key is in flight,
 * subsequent callers for the same key share the same pending promise
 * instead of issuing duplicate API requests.
 */

export class RequestDeduplicator {
  private flights = new Map<string, Promise<unknown>>();

  /** Returns the in-flight promise for `key`, or undefined when none exists. */
  get(key: string): Promise<unknown> | undefined {
    return this.flights.get(key);
  }

  /**
   * Registers an in-flight request. Returns the same promise to every caller.
   * The entry is automatically removed when the request settles.
   */
  start(key: string, promise: Promise<unknown>): Promise<unknown> {
    const tracked = promise.then(
      (value) => {
        this.flights.delete(key);
        return value;
      },
      (err) => {
        this.flights.delete(key);
        throw err;
      },
    );
    this.flights.set(key, tracked);
    return tracked;
  }

  has(key: string): boolean {
    return this.flights.has(key);
  }

  get size(): number {
    return this.flights.size;
  }

  clear(): void {
    this.flights.clear();
  }
}