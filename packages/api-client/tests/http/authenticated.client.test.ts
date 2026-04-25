import { describe, expect, it, vi } from 'vitest';
import {
  ConflictError,
  UnauthorizedError,
} from '@quilla-fe-kit/errors';
import { AuthenticatedHttpClient } from '../../src/http/authenticated.client.js';
import type { HttpClient } from '../../src/http/http-client.interface.js';
import type { HttpRequest, HttpResponse } from '../../src/http/http-types.type.js';
import type { TokenRefresher } from '../../src/http/single-flight-token.refresher.js';
import { memoryTokenStorage } from '@quilla-fe-kit/storage';

const okResponse = <T>(data: T = {} as T): HttpResponse<T> => ({
  status: 200,
  headers: {},
  data,
});

type MockInner = HttpClient & { last: () => HttpRequest | undefined };

const buildInner = (impl: (config: HttpRequest) => Promise<HttpResponse>): MockInner => {
  let last: HttpRequest | undefined;
  return {
    request: vi.fn(async (config: HttpRequest) => {
      last = config;
      return impl(config);
    }) as HttpClient['request'],
    last: () => last,
  };
};

describe('AuthenticatedHttpClient', () => {
  it('passes through unmodified when disabledAuth is set', async () => {
    const inner = buildInner(() => Promise.resolve(okResponse()));
    const storage = memoryTokenStorage();
    await storage.setTokens({ access: 'A', refresh: 'R' });
    const refresher: TokenRefresher = { refresh: vi.fn() };

    const client = new AuthenticatedHttpClient({ inner, storage, tokenRefresher: refresher });
    await client.request({ url: '/login', disabledAuth: true });

    expect(inner.last()?.headers).toBeUndefined();
    expect(refresher.refresh).not.toHaveBeenCalled();
  });

  it('attaches Bearer token when access token is present', async () => {
    const inner = buildInner(() => Promise.resolve(okResponse()));
    const storage = memoryTokenStorage();
    await storage.setTokens({ access: 'ABC', refresh: 'R' });

    const client = new AuthenticatedHttpClient({
      inner,
      storage,
      tokenRefresher: { refresh: vi.fn() },
    });
    await client.request({ url: '/me' });

    expect(inner.last()?.headers?.Authorization).toBe('Bearer ABC');
  });

  it('omits Authorization when access token is null', async () => {
    const inner = buildInner(() => Promise.resolve(okResponse()));
    const client = new AuthenticatedHttpClient({
      inner,
      storage: memoryTokenStorage(),
      tokenRefresher: { refresh: vi.fn() },
    });
    await client.request({ url: '/public' });
    expect(inner.last()?.headers).toBeUndefined();
  });

  it('on 401, refreshes once and retries with the new token', async () => {
    let callCount = 0;
    const inner = buildInner(async () => {
      callCount += 1;
      if (callCount === 1)
        throw new UnauthorizedError({ message: 'expired', httpStatus: 401, requestUrl: '/me' });
      return okResponse({ ok: true });
    });
    const storage = memoryTokenStorage();
    await storage.setTokens({ access: 'OLD', refresh: 'R' });

    const refresher: TokenRefresher = { refresh: vi.fn(async () => 'NEW') };
    const client = new AuthenticatedHttpClient({ inner, storage, tokenRefresher: refresher });

    const res = await client.request({ url: '/me' });

    expect(res.data).toEqual({ ok: true });
    expect(refresher.refresh).toHaveBeenCalledTimes(1);
    expect(callCount).toBe(2);
    expect(inner.last()?.headers?.Authorization).toBe('Bearer NEW');
  });

  it('does not retry on non-401 errors', async () => {
    const inner = buildInner(async () => {
      throw new ConflictError({ message: 'conflict', httpStatus: 409, requestUrl: '/x' });
    });
    const refresher: TokenRefresher = { refresh: vi.fn() };
    const client = new AuthenticatedHttpClient({
      inner,
      storage: memoryTokenStorage(),
      tokenRefresher: refresher,
    });

    await expect(client.request({ url: '/x' })).rejects.toBeInstanceOf(ConflictError);
    expect(refresher.refresh).not.toHaveBeenCalled();
  });

  it('propagates a second 401 after refresh+retry', async () => {
    const inner = buildInner(async () => {
      throw new UnauthorizedError({
        message: 'still expired',
        httpStatus: 401,
        requestUrl: '/x',
      });
    });
    const refresher: TokenRefresher = { refresh: vi.fn(async () => 'NEW') };
    const client = new AuthenticatedHttpClient({
      inner,
      storage: memoryTokenStorage(),
      tokenRefresher: refresher,
    });

    await expect(client.request({ url: '/x' })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(refresher.refresh).toHaveBeenCalledTimes(1);
  });
});
