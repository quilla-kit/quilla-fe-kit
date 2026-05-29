import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeJwtHeader,
  decodeJwtPayload,
  getTokenExpiry,
  isTokenExpired,
} from '../src/jwt.parser.js';
import { makeJwt } from './helpers/make-jwt.js';

describe('decodeJwtPayload', () => {
  it('decodes a well-formed JWT payload into the requested type', () => {
    const token = makeJwt({ u: 'user-1', si: 'scope-1', s: ['admin'] });
    expect(decodeJwtPayload<{ u: string; si: string; s: string[] }>(token)).toEqual({
      u: 'user-1',
      si: 'scope-1',
      s: ['admin'],
    });
  });

  it('correctly decodes non-ASCII UTF-8 claim values', () => {
    const token = makeJwt({ name: 'José', city: '東京' });
    expect(decodeJwtPayload<{ name: string; city: string }>(token)).toEqual({
      name: 'José',
      city: '東京',
    });
  });

  it('returns null for empty string', () => {
    expect(decodeJwtPayload('')).toBeNull();
  });

  it('returns null for a single-segment token (no dot)', () => {
    expect(decodeJwtPayload('notajwt')).toBeNull();
  });

  it('returns null when payload segment is empty', () => {
    expect(decodeJwtPayload('header..sig')).toBeNull();
  });

  it('returns null when payload is not valid JSON', () => {
    expect(decodeJwtPayload('header.notbase64json.sig')).toBeNull();
  });
});

describe('decodeJwtHeader', () => {
  it('decodes alg and typ from a well-formed JWT header', () => {
    const token = makeJwt({ sub: 'u' });
    const header = decodeJwtHeader(token);
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
  });

  it('returns null for empty string', () => {
    expect(decodeJwtHeader('')).toBeNull();
  });

  it('returns null for a single-segment token', () => {
    expect(decodeJwtHeader('notajwt')).toBeNull();
  });

  it('returns null when header is not valid base64 JSON', () => {
    expect(decodeJwtHeader('!!!.payload.sig')).toBeNull();
  });
});

describe('isTokenExpired', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false for a token with exp in the future', () => {
    const now = 1700000000;
    vi.setSystemTime(now * 1000);
    expect(isTokenExpired(makeJwt({ exp: now + 3600 }))).toBe(false);
  });

  it('returns true for a token with exp in the past', () => {
    const now = 1700000000;
    vi.setSystemTime(now * 1000);
    expect(isTokenExpired(makeJwt({ exp: now - 1 }))).toBe(true);
  });

  it('returns true for a token without an exp claim', () => {
    expect(isTokenExpired(makeJwt({ sub: 'u' }))).toBe(true);
  });

  it('returns true for a malformed token', () => {
    expect(isTokenExpired('not-a-jwt')).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(isTokenExpired('')).toBe(true);
  });

  it('clockSkewSeconds extends validity window for a slightly expired token', () => {
    const now = 1700000000;
    vi.setSystemTime(now * 1000);
    expect(isTokenExpired(makeJwt({ exp: now - 10 }), { clockSkewSeconds: 30 })).toBe(false);
  });

  it('clockSkewSeconds does not save a deeply expired token outside the skew window', () => {
    const now = 1700000000;
    vi.setSystemTime(now * 1000);
    expect(isTokenExpired(makeJwt({ exp: now - 60 }), { clockSkewSeconds: 30 })).toBe(true);
  });

  it('exp exactly equal to now is NOT expired (strict-greater semantics)', () => {
    const now = 1700000000;
    vi.setSystemTime(now * 1000);
    expect(isTokenExpired(makeJwt({ exp: now }))).toBe(false);
  });

  it('returns true when nbf is in the future (token not yet valid)', () => {
    const now = 1700000000;
    vi.setSystemTime(now * 1000);
    expect(isTokenExpired(makeJwt({ exp: now + 3600, nbf: now + 60 }))).toBe(true);
  });

  it('returns false when nbf is in the past (token is already valid)', () => {
    const now = 1700000000;
    vi.setSystemTime(now * 1000);
    expect(isTokenExpired(makeJwt({ exp: now + 3600, nbf: now - 60 }))).toBe(false);
  });

  it('clockSkewSeconds applies to nbf: token valid within skew window', () => {
    const now = 1700000000;
    vi.setSystemTime(now * 1000);
    expect(
      isTokenExpired(makeJwt({ exp: now + 3600, nbf: now + 10 }), { clockSkewSeconds: 30 }),
    ).toBe(false);
  });

  it('clockSkewSeconds does not save nbf far in the future', () => {
    const now = 1700000000;
    vi.setSystemTime(now * 1000);
    expect(
      isTokenExpired(makeJwt({ exp: now + 3600, nbf: now + 60 }), { clockSkewSeconds: 30 }),
    ).toBe(true);
  });
});

describe('getTokenExpiry', () => {
  it('returns a Date corresponding to exp * 1000 milliseconds', () => {
    const exp = 1234567890;
    expect(getTokenExpiry(makeJwt({ exp }))?.getTime()).toBe(exp * 1000);
  });

  it('returns null when exp claim is absent', () => {
    expect(getTokenExpiry(makeJwt({ sub: 'u' }))).toBeNull();
  });

  it('returns null for a malformed token', () => {
    expect(getTokenExpiry('not-a-jwt')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getTokenExpiry('')).toBeNull();
  });
});
