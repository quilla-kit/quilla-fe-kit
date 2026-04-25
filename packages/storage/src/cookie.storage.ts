import { DEFAULT_ACCESS_KEY, DEFAULT_REFRESH_KEY } from './default-keys.js';
import type { TokenStorage } from './token-storage.interface.js';

export type CookieSameSite = 'Strict' | 'Lax' | 'None';

export type CookieTokenStorageOptions = {
  readonly accessKey?: string;
  readonly refreshKey?: string;
  readonly secure?: boolean;
  readonly sameSite?: CookieSameSite;
  readonly path?: string;
  readonly domain?: string;
  readonly accessMaxAgeSeconds?: number;
  readonly refreshMaxAgeSeconds?: number;
};

type DocumentLike = {
  cookie: string;
};

const documentRef = (): DocumentLike => {
  const candidate = (globalThis as { document?: DocumentLike }).document;
  if (!candidate) {
    throw new Error(
      'cookieTokenStorage requires globalThis.document. ' +
        'Use memoryTokenStorage() in environments without document (SSR, Node, edge).',
    );
  }
  return candidate;
};

const readCookie = (name: string): string | null => {
  const cookies = documentRef().cookie.split(';');
  const prefix = `${encodeURIComponent(name)}=`;
  for (const raw of cookies) {
    const trimmed = raw.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
};

const writeCookie = (
  name: string,
  value: string,
  options: CookieTokenStorageOptions,
  maxAgeSeconds: number | undefined,
): void => {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path ?? '/'}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  parts.push(`SameSite=${options.sameSite ?? 'Lax'}`);
  if (options.secure ?? true) parts.push('Secure');
  if (maxAgeSeconds !== undefined) parts.push(`Max-Age=${maxAgeSeconds}`);
  documentRef().cookie = parts.join('; ');
};

const deleteCookie = (name: string, options: CookieTokenStorageOptions): void => {
  const parts = [`${encodeURIComponent(name)}=`];
  parts.push(`Path=${options.path ?? '/'}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  parts.push('Max-Age=0');
  documentRef().cookie = parts.join('; ');
};

export const cookieTokenStorage = (options: CookieTokenStorageOptions = {}): TokenStorage => {
  const accessKey = options.accessKey ?? DEFAULT_ACCESS_KEY;
  const refreshKey = options.refreshKey ?? DEFAULT_REFRESH_KEY;

  return {
    async getAccessToken() {
      return readCookie(accessKey);
    },
    async getRefreshToken() {
      return readCookie(refreshKey);
    },
    async setTokens(next) {
      writeCookie(accessKey, next.access, options, options.accessMaxAgeSeconds);
      writeCookie(refreshKey, next.refresh, options, options.refreshMaxAgeSeconds);
    },
    async clear() {
      deleteCookie(accessKey, options);
      deleteCookie(refreshKey, options);
    },
  };
};
