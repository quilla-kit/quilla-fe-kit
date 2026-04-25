import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '@quilla-fe-kit/errors';
import { SingleFlightTokenRefresher } from '../../src/http/single-flight-token.refresher.js';
import { memoryTokenStorage } from '@quilla-fe-kit/storage';

describe('SingleFlightTokenRefresher', () => {
  it('throws UnauthorizedError and clears storage when no refresh token is present', async () => {
    const storage = memoryTokenStorage();
    const clear = vi.spyOn(storage, 'clear');
    const refresher = new SingleFlightTokenRefresher({
      storage,
      refreshEndpoint: vi.fn(),
    });

    await expect(refresher.refresh()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(clear).toHaveBeenCalled();
  });

  it('persists rotated tokens and resolves with the new access token', async () => {
    const storage = memoryTokenStorage();
    await storage.setTokens({ access: 'OLD_A', refresh: 'OLD_R' });
    const refresher = new SingleFlightTokenRefresher({
      storage,
      refreshEndpoint: async () => ({ access: 'NEW_A', refresh: 'NEW_R' }),
    });

    expect(await refresher.refresh()).toBe('NEW_A');
    expect(await storage.getAccessToken()).toBe('NEW_A');
    expect(await storage.getRefreshToken()).toBe('NEW_R');
  });

  it('shares one in-flight promise across concurrent callers', async () => {
    const storage = memoryTokenStorage();
    await storage.setTokens({ access: 'A', refresh: 'R' });

    let endpointCalls = 0;
    let resolve!: (v: { access: string; refresh: string }) => void;
    const refresher = new SingleFlightTokenRefresher({
      storage,
      refreshEndpoint: () => {
        endpointCalls += 1;
        return new Promise((r) => {
          resolve = r;
        });
      },
    });

    const p1 = refresher.refresh();
    const p2 = refresher.refresh();
    const p3 = refresher.refresh();

    await Promise.resolve();
    await Promise.resolve();
    expect(endpointCalls).toBe(1);

    resolve({ access: 'NEW', refresh: 'R2' });
    expect(await Promise.all([p1, p2, p3])).toEqual(['NEW', 'NEW', 'NEW']);
    expect(endpointCalls).toBe(1);
  });

  it('clears storage and re-throws on refresh failure', async () => {
    const storage = memoryTokenStorage();
    await storage.setTokens({ access: 'A', refresh: 'R' });
    const clear = vi.spyOn(storage, 'clear');

    const refresher = new SingleFlightTokenRefresher({
      storage,
      refreshEndpoint: async () => {
        throw new Error('refresh denied');
      },
    });

    await expect(refresher.refresh()).rejects.toThrow('refresh denied');
    expect(clear).toHaveBeenCalled();
    expect(await storage.getAccessToken()).toBeNull();
  });

  it('starts a new flight after the previous one settles', async () => {
    const storage = memoryTokenStorage();
    await storage.setTokens({ access: 'A', refresh: 'R' });
    let calls = 0;
    const refresher = new SingleFlightTokenRefresher({
      storage,
      refreshEndpoint: async () => {
        calls += 1;
        return { access: `A${calls}`, refresh: 'R' };
      },
    });

    expect(await refresher.refresh()).toBe('A1');
    expect(await refresher.refresh()).toBe('A2');
  });
});
