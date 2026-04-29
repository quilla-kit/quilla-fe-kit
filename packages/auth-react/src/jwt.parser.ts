import type { JwtClaims } from './jwt-claims.type.js';
import type { Principal } from './principal.type.js';

export type ClaimsParser = (token: string) => Principal | null;

const decodeBase64Url = (input: string): string => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const normalized = pad ? padded + '='.repeat(4 - pad) : padded;
  const atobFn = (globalThis as { atob?: (data: string) => string }).atob;
  if (!atobFn) {
    throw new Error('jwt.parser: globalThis.atob is not available in this runtime.');
  }
  return atobFn(normalized);
};

export const decodeJwtPayload = <T = JwtClaims>(token: string): T | null => {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1];
  if (!payload) return null;
  try {
    return JSON.parse(decodeBase64Url(payload)) as T;
  } catch {
    return null;
  }
};

export const defaultClaimsParser: ClaimsParser = (token) => {
  const claims = decodeJwtPayload<JwtClaims>(token);
  if (!claims || typeof claims.u !== 'string' || typeof claims.si !== 'string') {
    return null;
  }
  return {
    userId: claims.u,
    scopeId: claims.si,
    scopes: Array.isArray(claims.s) ? claims.s : [],
  };
};
