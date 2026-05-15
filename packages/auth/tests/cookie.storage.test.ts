import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieTokenStorage } from '../src/cookie.storage.js';

type CookieJar = { cookie: string };

const makeJar = (): CookieJar => {
  const map = new Map<string, string>();
  let raw = '';
  return {
    get cookie(): string {
      return raw;
    },
    set cookie(value: string) {
      const [pair, ...attrs] = value.split(';').map((s) => s.trim());
      if (!pair) return;
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq);
      const val = pair.slice(eq + 1);
      const maxAgeAttr = attrs.find((a) => a.toLowerCase().startsWith('max-age='));
      const maxAge = maxAgeAttr ? Number(maxAgeAttr.split('=')[1]) : undefined;
      if (maxAge === 0) {
        map.delete(name);
      } else {
        map.set(name, val);
      }
      raw = Array.from(map.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    },
  };
};

describe('cookieTokenStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('document', makeJar());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips set + get + clear via document.cookie', async () => {
    const s = cookieTokenStorage();
    expect(await s.getAccessToken()).toBeNull();

    await s.setTokens({ access: 'A', refresh: 'R' });
    expect(await s.getAccessToken()).toBe('A');
    expect(await s.getRefreshToken()).toBe('R');

    await s.clear();
    expect(await s.getAccessToken()).toBeNull();
    expect(await s.getRefreshToken()).toBeNull();
  });

  it('URL-encodes values containing reserved characters', async () => {
    const s = cookieTokenStorage();
    await s.setTokens({ access: 'a;b=c', refresh: 'r;d=e' });
    expect(await s.getAccessToken()).toBe('a;b=c');
    expect(await s.getRefreshToken()).toBe('r;d=e');
  });

  it('throws a clear error when document is missing', async () => {
    vi.stubGlobal('document', undefined);
    const s = cookieTokenStorage();
    await expect(s.getAccessToken()).rejects.toThrow(/requires globalThis\.document/);
  });
});
