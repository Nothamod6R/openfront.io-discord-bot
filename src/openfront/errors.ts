/**
 * Typed errors raised by the OpenFront API client.
 * Handlers map these to user-friendly Discord messages.
 */

export type OpenFrontErrorKind =
  | 'validation'
  | 'notFound'
  | 'rateLimited'
  | 'serverError'
  | 'network'
  | 'timeout'
  | 'malformed'
  | 'retriesExhausted';

export class OpenFrontError extends Error {
  readonly kind: OpenFrontErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(kind: OpenFrontErrorKind, message: string, options?: { status?: number; retryAfterMs?: number }) {
    super(message);
    this.name = 'OpenFrontError';
    this.kind = kind;
    this.status = options?.status;
    this.retryAfterMs = options?.retryAfterMs;
  }
}

export class ValidationError extends OpenFrontError {
  constructor(message: string) {
    super('validation', message, { status: 400 });
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends OpenFrontError {
  constructor(message: string, status = 404) {
    super('notFound', message, { status });
    this.name = 'NotFoundError';
  }
}

export class RateLimitedError extends OpenFrontError {
  constructor(message: string, retryAfterMs?: number) {
    super('rateLimited', message, { status: 429, retryAfterMs });
    this.name = 'RateLimitedError';
  }
}

export class ServerError extends OpenFrontError {
  constructor(message: string, status: number) {
    super('serverError', message, { status });
    this.name = 'ServerError';
  }
}

export class NetworkError extends OpenFrontError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('network', message);
    this.name = 'NetworkError';
    if (options?.cause) this.cause = options.cause;
  }
}

export class TimeoutError extends OpenFrontError {
  constructor(message: string) {
    super('timeout', message);
    this.name = 'TimeoutError';
  }
}

export class MalformedResponseError extends OpenFrontError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('malformed', message);
    this.name = 'MalformedResponseError';
    if (options?.cause) this.cause = options.cause;
  }
}

export class RetriesExhaustedError extends OpenFrontError {
  constructor(message: string, options?: { status?: number; retryAfterMs?: number }) {
    super('retriesExhausted', message, options);
    this.name = 'RetriesExhaustedError';
  }
}

/** Generic helper used by handlers to build a short, safe error summary. */
export function describeOpenFrontError(err: unknown): string {
  if (err instanceof OpenFrontError) return err.message;
  return err instanceof Error ? err.message : 'Unexpected error';
}