import type { TokenPair, TokenStorage } from './token-storage.interface.js';

export const memoryTokenStorage = (): TokenStorage => {
  let tokens: TokenPair | null = null;

  return {
    async getAccessToken() {
      return tokens?.access ?? null;
    },
    async getRefreshToken() {
      return tokens?.refresh ?? null;
    },
    async setTokens(next) {
      tokens = next;
    },
    async clear() {
      tokens = null;
    },
  };
};
