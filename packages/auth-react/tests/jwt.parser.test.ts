import { describe, expect, it } from 'vitest';
import { decodeJwtPayload } from '../src/jwt.parser.js';
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
