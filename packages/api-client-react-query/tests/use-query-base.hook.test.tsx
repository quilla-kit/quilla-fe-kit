import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useQueryBase } from '../src/use-query-base.hook.js';
import { createFakeHttpClient, renderHookWithProviders } from './helpers/render.helper.js';

describe('useQueryBase — basic fetch', () => {
  it('fetches and exposes data + version (from ETag)', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 200,
      headers: { etag: '"7"' },
      data: { name: 'Ada' },
    }));

    const { result } = renderHookWithProviders(
      () => useQueryBase<{ name: string }>(['users', 1], '/users/1'),
      { httpClient: client },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual({ name: 'Ada' });
    expect(result.current.data?.version).toBe(7);
  });

  it('unwraps {data, pagination} response shape', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: {
        data: [{ id: 1 }, { id: 2 }],
        pagination: { page: 1, limit: 20, total: 2 },
      },
    }));

    const { result } = renderHookWithProviders(
      () => useQueryBase<{ id: number }[]>(['users'], '/users'),
      { httpClient: client },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.current.data?.pagination).toEqual({ page: 1, limit: 20, total: 2 });
  });

  it('applies a mapper to the raw payload', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { name: 'ada' },
    }));

    const { result } = renderHookWithProviders(
      () =>
        useQueryBase<{ name: string }, { name: string; upper: string }>(['u'], '/u', {
          mapper: (raw) => ({ name: raw.name, upper: raw.name.toUpperCase() }),
        }),
      { httpClient: client },
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

    const { result } = renderHookWithProviders(
      () => useQueryBase<{ name: string }>(['users', 2], '/users/2'),
      { httpClient: client },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.version).toBeNull();
  });
});

describe('useQueryBase — query params + cache key stability', () => {
  it('forwards search/filter/page/limit/sort to the HttpClient request', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { data: [], pagination: { page: 1, limit: 20, total: 0 } },
    }));

    const { result } = renderHookWithProviders(
      () =>
        useQueryBase(['users'], '/users', {
          query: {
            search: { name: 'ada' },
            filter: { status: 'active' },
            page: 1,
            limit: 20,
            sort: 'name:asc',
          },
          tuning: { debounceMs: 0, minSearchLength: 1 },
        }),
      { httpClient: client },
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

    const { result } = renderHookWithProviders(
      () =>
        useQueryBase(['users'], '/users', {
          query: { search: { name: 'a' } },
          tuning: { debounceMs: 0, minSearchLength: 3 },
        }),
      { httpClient: client },
    );

    // Give react-query a tick to settle. If query were enabled, we'd see a call.
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(calls).toHaveLength(0);
  });
});
