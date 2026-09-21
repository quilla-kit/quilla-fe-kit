import type { HttpRequest } from '@quilla-fe-kit/api-client';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createHooks } from '../src/hooks.factory.js';
import { INFINITE_KEY_SEGMENT, createQueryKeys } from '../src/query-keys.factory.js';
import { createFakeHttpClient, renderHookWithProviders } from './helpers/render.helper.js';

type Page = { items: { id: number }[]; pagination: { page: number; total: number } };

const pagedResponder = (etags: string[] = ['"1"', '"2"']) => {
  let call = 0;
  return async (config: HttpRequest) => {
    const page = Number(config.params?.page ?? 1);
    const etag = etags[call] ?? '"9"';
    call += 1;
    return {
      status: 200,
      headers: { etag },
      data: { items: [{ id: page }], pagination: { page, total: 2 } },
    };
  };
};

const nextByPagination = (page: Page) =>
  page.pagination.page < page.pagination.total ? { page: page.pagination.page + 1 } : undefined;

describe('useInfiniteQueryBase — paging', () => {
  it('fetches the first page and exposes its ETag version', async () => {
    const { client } = createFakeHttpClient(pagedResponder());
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useInfiniteQueryBase<Page>(['frames'], '/frames', {
        initialPageParam: { page: 1 },
        getNextPageParam: nextByPagination,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.data?.pages[0]?.data.items).toEqual([{ id: 1 }]);
    expect(result.current.data?.pages[0]?.version).toBe(1);
  });

  it('sends the derived page param on fetchNextPage and keeps a version per page', async () => {
    const { client, calls } = createFakeHttpClient(pagedResponder());
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useInfiniteQueryBase<Page>(['frames'], '/frames', {
        initialPageParam: { page: 1 },
        getNextPageParam: nextByPagination,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(calls[1]?.params).toMatchObject({ page: 2 });
    expect(result.current.data?.pages.map((p) => p.version)).toEqual([1, 2]);
  });

  it('reports hasNextPage=false and issues no request once the pager returns undefined', async () => {
    const { client, calls } = createFakeHttpClient(pagedResponder());
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useInfiniteQueryBase<Page>(['frames'], '/frames', {
        initialPageParam: { page: 1 },
        getNextPageParam: () => undefined,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(calls).toHaveLength(1);
  });

  it('applies the mapper to each page', async () => {
    const { client } = createFakeHttpClient(pagedResponder());
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useInfiniteQueryBase<Page, number[]>(['frames'], '/frames', {
        mapper: (raw) => raw.items.map((i) => i.id),
        initialPageParam: { page: 1 },
        getNextPageParam: (ids) => (ids[0] === 1 ? { page: 2 } : undefined),
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0]?.data).toEqual([1]);
  });
});

describe('useInfiniteQueryBase — page-param naming', () => {
  it('accepts a bare consumer-named page param and sends it under that exact key', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { items: [], next: 'c2' },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useInfiniteQueryBase<{ items: unknown[]; next: string | null }>(['graph'], '/graph', {
        initialPageParam: { cursor: 'c1' },
        getNextPageParam: (page) => (page.next ? { cursor: page.next } : undefined),
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls[0]?.params).toEqual({ cursor: 'c1' });

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]?.params).toEqual({ cursor: 'c2' });
  });

  it('supports a non-English page-param vocabulary', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { items: [] },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useInfiniteQueryBase<{ items: unknown[] }>(['p'], '/p', {
        initialPageParam: { pagina: 1 },
        getNextPageParam: () => undefined,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls[0]?.params).toEqual({ pagina: 1 });
  });

  it('lets the page param override seed query fields', async () => {
    const { client, calls } = createFakeHttpClient(pagedResponder());
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useInfiniteQueryBase<Page>(['frames'], '/frames', {
        query: { page: 1, limit: 20, filter: { status: 'active' } },
        initialPageParam: { page: 7 },
        getNextPageParam: () => undefined,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls[0]?.params).toMatchObject({
      page: 7,
      limit: 20,
      filter: { status: 'active' },
    });
  });
});

describe('useInfiniteQueryBase — transformers, gating and keys', () => {
  it('applies the factory transformer to every page, with the hook-level one winning', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { data: { items: [{ id: 1 }], pagination: { page: 1, total: 1 } } },
    }));
    const hooks = createHooks(client, {
      queryTransformer: (raw) => ({ data: (raw as { data: unknown }).data }),
    });

    const { result } = renderHookWithProviders(() =>
      hooks.useInfiniteQueryBase<Page>(['frames'], '/frames', {
        initialPageParam: { page: 1 },
        getNextPageParam: () => undefined,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0]?.data.items).toEqual([{ id: 1 }]);

    const { result: overridden } = renderHookWithProviders(() =>
      hooks.useInfiniteQueryBase<{ marker: string }>(['frames', 'x'], '/frames', {
        transformer: () => ({ data: { marker: 'hook' } }),
        initialPageParam: { page: 1 },
        getNextPageParam: () => undefined,
      }),
    );

    await waitFor(() => expect(overridden.current.isSuccess).toBe(true));
    expect(overridden.current.data?.pages[0]?.data).toEqual({ marker: 'hook' });
  });

  it('stays idle while search is below the minimum length', async () => {
    const { client, calls } = createFakeHttpClient(pagedResponder());
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useInfiniteQueryBase<Page>(['frames'], '/frames', {
        query: { search: { name: 'ad' } },
        tuning: { debounceMs: 0 },
        initialPageParam: { page: 1 },
        getNextPageParam: () => undefined,
      }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(calls).toHaveLength(0);
  });

  it('honours an explicit enabled:false over inferred enablement', async () => {
    const { client, calls } = createFakeHttpClient(pagedResponder());
    const hooks = createHooks(client);

    renderHookWithProviders(() =>
      hooks.useInfiniteQueryBase<Page>(['frames'], '/frames', {
        enabled: false,
        initialPageParam: { page: 1 },
        getNextPageParam: () => undefined,
      }),
    );

    await waitFor(() => expect(calls).toHaveLength(0));
  });

  it('does not share a cache entry with a useQueryBase list on the same baseKey', async () => {
    const { client } = createFakeHttpClient(pagedResponder(['"1"', '"1"']));
    const hooks = createHooks(client);
    const { queryClient, result } = renderHookWithProviders(() => ({
      list: hooks.useQueryBase<Page>(['frames'], '/frames'),
      infinite: hooks.useInfiniteQueryBase<Page>(['frames'], '/frames', {
        initialPageParam: { page: 1 },
        getNextPageParam: () => undefined,
      }),
    }));

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.infinite.isSuccess).toBe(true));

    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey);
    expect(keys).toHaveLength(2);

    // Pin the exact shape: the segment is appended once, in a fixed position. An
    // `includes` check would pass just as happily on a doubled segment.
    expect(keys).toContainEqual(['frames', 'infinite', {}]);
    expect(keys).toContainEqual(['frames', {}]);
  });

  it('appends the key segment exactly once, whatever the baseKey', async () => {
    const { client } = createFakeHttpClient(pagedResponder());
    const hooks = createHooks(client);
    const baseKey = [...createQueryKeys('frames').lists()];

    const { queryClient, result } = renderHookWithProviders(() =>
      hooks.useInfiniteQueryBase<Page>(baseKey, '/frames', {
        initialPageParam: { page: 1 },
        getNextPageParam: () => undefined,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The key carries the seed query params, not the page param: pages share one entry.
    expect(queryClient.getQueryCache().getAll()[0]?.queryKey).toEqual([
      'frames',
      'list',
      INFINITE_KEY_SEGMENT,
      {},
    ]);
  });

  it('forwards an AbortSignal on every page request', async () => {
    const { client, calls } = createFakeHttpClient(pagedResponder());
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useInfiniteQueryBase<Page>(['frames'], '/frames', {
        initialPageParam: { page: 1 },
        getNextPageParam: nextByPagination,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(calls).toHaveLength(2));
    for (const call of calls) {
      expect(call.signal).toBeInstanceOf(AbortSignal);
    }
  });
});
