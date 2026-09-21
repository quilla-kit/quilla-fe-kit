import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createHooks } from '../src/hooks.factory.js';
import { createQueryClient, resetQueryClient } from '../src/query-client.factory.js';
import { createFakeHttpClient, renderHookWithProviders } from './helpers/render.helper.js';

describe('useQueryBase — basic fetch', () => {
  it('fetches and exposes data + version (from ETag)', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 200,
      headers: { etag: '"7"' },
      data: { name: 'Ada' },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useQueryBase<{ name: string }>(['users', 1], '/users/1'),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual({ name: 'Ada' });
    expect(result.current.data?.version).toBe(7);
  });

  it('applies a mapper to the raw payload', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { name: 'ada' },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useQueryBase<{ name: string }, { name: string; upper: string }>(['u'], '/u', {
        mapper: (raw) => ({ name: raw.name, upper: raw.name.toUpperCase() }),
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual({ name: 'ada', upper: 'ADA' });
  });

  it('returns null version when no ETag header is present', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { name: 'Ada' },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useQueryBase<{ name: string }>(['users', 2], '/users/2'),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.version).toBeNull();
  });
});

describe('useQueryBase — transformers', () => {
  it('factory queryTransformer unwraps the envelope; pagination is part of TRaw', async () => {
    type PagedUsers = {
      items: { id: number }[];
      pagination: { page: number; limit: number; total: number };
    };

    const { client } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: {
        data: [{ id: 1 }, { id: 2 }],
        pagination: { page: 1, limit: 20, total: 2 },
      },
    }));
    const hooks = createHooks(client, {
      queryTransformer: (raw) => {
        const body = raw as { data: unknown; pagination: unknown };
        return { data: { items: body.data, pagination: body.pagination } };
      },
    });

    const { result } = renderHookWithProviders(() =>
      hooks.useQueryBase<PagedUsers>(['users'], '/users'),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.current.data?.data.pagination).toEqual({ page: 1, limit: 20, total: 2 });
  });

  it('hook-level transformer overrides the factory queryTransformer', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { result: { id: 99 } },
    }));
    const hooks = createHooks(client, {
      queryTransformer: (raw) => {
        const body = raw as { data: unknown };
        return { data: body.data };
      },
    });

    const { result } = renderHookWithProviders(() =>
      hooks.useQueryBase<{ id: number }>(['special'], '/special', {
        transformer: (raw) => {
          const body = raw as { result: unknown };
          return { data: body.result };
        },
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual({ id: 99 });
  });

  it('without transformer response.data is used as-is', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { id: 1, name: 'Ada' },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useQueryBase<{ id: number; name: string }>(['users', 1], '/users/1'),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual({ id: 1, name: 'Ada' });
  });
});

describe('useQueryBase — query params + cache key stability', () => {
  it('forwards search/filter/page/limit/sort to the HttpClient request', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { data: [], pagination: { page: 1, limit: 20, total: 0 } },
    }));
    const hooks = createHooks(client, {
      queryTransformer: (raw) => {
        const body = raw as { data: unknown };
        return { data: body.data };
      },
    });

    const { result } = renderHookWithProviders(() =>
      hooks.useQueryBase(['users'], '/users', {
        query: {
          search: { name: 'ada' },
          filter: { status: 'active' },
          page: 1,
          limit: 20,
          sort: 'name:asc',
        },
        tuning: { debounceMs: 0, minSearchLength: 1 },
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const params = calls[0]?.params as Record<string, unknown>;
    expect(params).toMatchObject({
      search: { name: 'ada' },
      filter: { status: 'active' },
      page: 1,
      limit: 20,
      sort: 'name:asc',
    });
  });

  it('disables the query when search is set but below min length', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: {},
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useQueryBase(['users'], '/users', {
        query: { search: { name: 'a' } },
        tuning: { debounceMs: 0, minSearchLength: 3 },
      }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(calls).toHaveLength(0);
  });
});

describe('useQueryBase — query.extra precedence', () => {
  it('typed fields win over a same-named key in extra', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: [],
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useQueryBase<unknown[]>(['claims'], '/claims', {
        query: { page: 2, limit: 10, extra: { page: 99, status: 'open' } },
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls[0]?.params).toMatchObject({ page: 2, limit: 10, status: 'open' });
  });

  it('extra still supplies a key the typed fields leave unset', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: [],
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useQueryBase<unknown[]>(['claims'], '/claims', {
        query: { extra: { page: 99, includeArchived: true } },
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls[0]?.params).toMatchObject({ page: 99, includeArchived: true });
  });
});

describe('useQueryBase — cancellation', () => {
  it("forwards TanStack's AbortSignal to the http client", async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { ok: true },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useQueryBase<{ ok: boolean }>(['cancel', 1], '/cancel'),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(calls[0]?.signal?.aborted).toBe(false);
  });

  it('aborts the in-flight request when the query is cancelled', async () => {
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });

    const { client, calls } = createFakeHttpClient(async () => {
      await blocked;
      return { status: 200, headers: {}, data: { ok: true } };
    });
    const hooks = createHooks(client);

    const { queryClient } = renderHookWithProviders(() =>
      hooks.useQueryBase<{ ok: boolean }>(['cancel', 2], '/cancel'),
    );

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.signal?.aborted).toBe(false);

    await queryClient.cancelQueries({ queryKey: ['cancel', 2] });
    expect(calls[0]?.signal?.aborted).toBe(true);

    release?.();
  });
});

describe('useQueryBase — cancellation under the real retry policy', () => {
  afterEach(() => {
    resetQueryClient();
  });

  it('does not retry an aborted request', async () => {
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });

    const { client, calls } = createFakeHttpClient(async (config) => {
      await blocked;
      config.signal?.throwIfAborted();
      return { status: 200, headers: {}, data: { ok: true } };
    });
    const hooks = createHooks(client);

    resetQueryClient();
    const queryClient = createQueryClient();

    renderHookWithProviders(() => hooks.useQueryBase<{ ok: boolean }>(['noretry'], '/noretry'), {
      queryClient,
    });

    await waitFor(() => expect(calls).toHaveLength(1));
    await queryClient.cancelQueries({ queryKey: ['noretry'] });
    release?.();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toHaveLength(1);
  });
});
