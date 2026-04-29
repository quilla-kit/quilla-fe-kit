import { describe, expect, it } from 'vitest';
import { decodeJwtPayload, defaultClaimsParser } from '../src/jwt.parser.js';
import { makeJwt } from './helpers/make-jwt.js';

describe('decodeJwtPayload', () => {
  it('decodes a well-formed JWT payload', () => {
    const token = makeJwt({ u: 'user-1', si: 'scope-1' });
    expect(decodeJwtPayload(token)).toEqual({ u: 'user-1', si: 'scope-1' });
  });

  it('returns null for malformed input (single segment)', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
  });

  it('returns null when payload is not valid JSON', () => {
    expect(decodeJwtPayload('header.notbase64json.sig')).toBeNull();
  });

  it('returns null for empty payload segment', () => {
    expect(decodeJwtPayload('header..sig')).toBeNull();
  });
});

describe('defaultClaimsParser', () => {
  it('maps { u, si, s } → Principal', () => {
    const token = makeJwt({ u: 'user-1', si: 'scope-1', s: ['admin', 'auditor'] });
    expect(defaultClaimsParser(token)).toEqual({
      userId: 'user-1',
      scopeId: 'scope-1',
      scopes: ['admin', 'auditor'],
    });
  });

  it('defaults scopes to [] when claim `s` is missing', () => {
    const token = makeJwt({ u: 'user-1', si: 'scope-1' });
    expect(defaultClaimsParser(token)).toEqual({
      userId: 'user-1',
      scopeId: 'scope-1',
      scopes: [],
    });
  });

  it('returns null when `u` is missing', () => {
    const token = makeJwt({ si: 'scope-1' });
    expect(defaultClaimsParser(token)).toBeNull();
  });

  it('returns null when `si` is missing', () => {
    const token = makeJwt({ u: 'user-1' });
    expect(defaultClaimsParser(token)).toBeNull();
  });

  it('returns null when `u` is the wrong type', () => {
    const token = makeJwt({ u: 42, si: 'scope-1' });
    expect(defaultClaimsParser(token)).toBeNull();
  });

  it('coerces non-array `s` to empty []', () => {
    const token = makeJwt({ u: 'user-1', si: 'scope-1', s: 'not-an-array' });
    expect(defaultClaimsParser(token)?.scopes).toEqual([]);
  });

  it('ignores unknown claims (e.g. `st`) without failing', () => {
    const token = makeJwt({ u: 'user-1', si: 'scope-1', s: [], st: 'security-stamp' });
    expect(defaultClaimsParser(token)).toEqual({
      userId: 'user-1',
      scopeId: 'scope-1',
      scopes: [],
    });
  });
});
