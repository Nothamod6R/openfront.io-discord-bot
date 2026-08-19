import { MalformedResponseError } from './errors.js';
import type { ContentRange } from '../models/types.js';

/**
 * Parses a `Content-Range` header (e.g. `games 5-15/399` or `games 0-20/*`).
 * Returns null when the header is missing or malformed so callers can fall
 * back to their own pagination logic.
 */
export function parseContentRange(header: string | null | undefined): ContentRange | null {
  if (!header) return null;
  const match = /^([^\s]+)\s+(\d+)-(\d+)\/(\d+|\*)$/.exec(header.trim());
  if (!match) return null;
  const [, unit, startStr, endStr, totalStr] = match;
  if (!unit || !startStr || !endStr || !totalStr) return null;
  const start = Number.parseInt(startStr, 10);
  const end = Number.parseInt(endStr, 10);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  const total = totalStr === '*' ? null : Number.parseInt(totalStr, 10);
  if (total !== null && Number.isNaN(total)) return null;
  return { unit, start, end, total };
}

/** Parses the JSON body, throwing a MalformedResponseError on invalid JSON. */
export function parseJsonBody(text: string, endpoint: string): unknown {
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new MalformedResponseError(`Invalid JSON received from ${endpoint}.`, { cause });
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function asString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new MalformedResponseError(`API returned a malformed response: "${field}" is not a string.`);
  }
  return value;
}

export function asOptionalNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    throw new MalformedResponseError(`API returned a malformed response: "${field}" is not a number.`);
  }
  return num;
}

export function asOptionalString(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') {
    throw new MalformedResponseError(`API returned a malformed response: "${field}" is not a string.`);
  }
  return value;
}

export function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new MalformedResponseError(`API returned a malformed response: "${field}" is not a boolean.`);
  }
  return value;
}