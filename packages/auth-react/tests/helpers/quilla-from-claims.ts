import type { ClaimsMapper, Principal } from '../../src/index.js';

export type QuillaTokenClaims = {
  readonly u: string;
  readonly si: string;
  readonly s?: readonly string[];
};

export const quillaFromClaims: ClaimsMapper<QuillaTokenClaims> = (claims) => {
  if (typeof claims.u !== 'string' || typeof claims.si !== 'string') return null;
  const principal: Principal = {
    userId: claims.u,
    scopeId: claims.si,
    scopes: Array.isArray(claims.s) ? claims.s : [],
  };
  return principal;
};
