import type { JwtHeader, JwtPayload } from './jwt.type.js';

export type { JwtHeader, JwtPayload };

export type IsTokenExpiredOptions = {
  readonly clockSkewSeconds?: number;
};

const decodeBase64Url = (input: string): string => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const normalized = pad ? padded + '='.repeat(4 - pad) : padded;
  type BufferLike = {
    from(data: string, encoding: string): { toString(encoding: string): string };
  };
  const bufFn = (globalThis as { Buffer?: BufferLike }).Buffer;
  if (bufFn) return bufFn.from(normalized, 'base64').toString('utf8');
  const atobFn = (globalThis as { atob?: (data: string) => string }).atob;
  if (atobFn) {
    const bytes = Uint8Array.from(atobFn(normalized), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  throw new Error(
    'jwt.parser: no base64url decoder available (needs Buffer, or atob+TextDecoder).',
  );
};

const decodeJwtPart = <T>(token: string, index: number): T | null => {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const segment = parts[index];
  if (!segment) return null;
  try {
    return JSON.parse(decodeBase64Url(segment)) as T;
  } catch {
    return null;
  }
};

export const decodeJwtPayload = <T>(token: string): T | null => decodeJwtPart<T>(token, 1);

export const decodeJwtHeader = <T extends JwtHeader = JwtHeader>(token: string): T | null =>
  decodeJwtPart<T>(token, 0);

export const isTokenExpired = (token: string, options?: IsTokenExpiredOptions): boolean => {
  const claims = decodeJwtPayload<JwtPayload>(token);
  if (!claims || typeof claims.exp !== 'number') return true;
  const skew = options?.clockSkewSeconds ?? 0;
  const now = Math.floor(Date.now() / 1000);
  if (now > claims.exp + skew) return true;
  if (typeof claims.nbf === 'number' && now < claims.nbf - skew) return true;
  return false;
};

export const getTokenExpiry = (token: string): Date | null => {
  const claims = decodeJwtPayload<JwtPayload>(token);
  if (!claims || typeof claims.exp !== 'number') return null;
  return new Date(claims.exp * 1000);
};
