import { DEFAULT_ACCESS_KEY, DEFAULT_REFRESH_KEY } from './default-keys.js';
import type { TokenStorage } from './token-storage.interface.js';

export type LocalStorageTokenStorageOptions = {
  readonly accessKey?: string;
  readonly refreshKey?: string;
};

export const localStorageTokenStorage = (
  options: LocalStorageTokenStorageOptions = {},
): TokenStorage => {
  const accessKey = options.accessKey ?? DEFAULT_ACCESS_KEY;
  const refreshKey = options.refreshKey ?? DEFAULT_REFRESH_KEY;

  const store = (): Storage => {
    const candidate = (globalThis as { localStorage?: Storage }).localStorage;
    if (!candidate) {
      throw new Error(
        'localStorageTokenStorage requires globalThis.localStorage. ' +
          'Use memoryTokenStorage() in environments without localStorage (SSR, Node, edge).',
      );
    }
    return candidate;
  };

  return {
    async getAccessToken() {
      return store().getItem(accessKey);
    },
    async getRefreshToken() {
      return store().getItem(refreshKey);
    },
    async setTokens(next) {
      const s = store();
      s.setItem(accessKey, next.access);
      s.setItem(refreshKey, next.refresh);
    },
    async clear() {
      const s = store();
      s.removeItem(accessKey);
      s.removeItem(refreshKey);
    },
  };
};
