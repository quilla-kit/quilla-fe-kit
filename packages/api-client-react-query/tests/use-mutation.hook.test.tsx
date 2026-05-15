import { OCC_HEADER } from '@quilla-fe-kit/api-client';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDeleteMutationBase } from '../src/use-delete-mutation.hook.js';
import { usePatchMutationBase } from '../src/use-patch-mutation.hook.js';
import { usePostMutationBase } from '../src/use-post-mutation.hook.js';
import { usePutMutationBase } from '../src/use-put-mutation.hook.js';
import { createFakeHttpClient, renderHookWithProviders } from './helpers/render.helper.js';

describe('usePostMutationBase', () => {
  it('POSTs to the configured url with the variables as body', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { id: 'new' },
    }));

    const { result } = renderHookWithProviders(
      () => usePostMutationBase<{ id: string }, { name: string }>('/users'),
      { httpClient: client },
    );

    let resolved: { id: string } | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync({ name: 'Ada' });
    });

    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe('/users');
    expect(calls[0]?.body).toEqual({ name: 'Ada' });
    expect(resolved).toEqual({ id: 'new' });
  });

  it('forwards disabledAuth flag to the HttpClient', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: undefined,
    }));

    const { result } = renderHookWithProviders(
      () => usePostMutationBase<void, { token: string }>('/login', { disabledAuth: true }),
      { httpClient: client },
    );

    await act(async () => {
      await result.current.mutateAsync({ token: 'x' });
    });

    expect(calls[0]?.disabledAuth).toBe(true);
  });
});

describe('usePutMutationBase', () => {
  it('PUTs to {basePath}/{id} with body and no OCC header by default', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { ok: true },
    }));

    const { result } = renderHookWithProviders(
      () => usePutMutationBase<{ ok: boolean }, { name: string }>('/users'),
      { httpClient: client },
    );

    await act(async () => {
      await result.current.mutateAsync({ id: 5, body: { name: 'Ada' } });
    });

    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.url).toBe('/users/5');
    expect(calls[0]?.body).toEqual({ name: 'Ada' });
    expect((calls[0]?.headers ?? {})[OCC_HEADER]).toBeUndefined();
  });

  it('attaches If-Match header from cached version when occ resolver is provided', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { ok: true },
    }));

    const { result, queryClient } = renderHookWithProviders(
      () =>
        usePutMutationBase<{ ok: boolean }, { name: string }>('/users', {
          occ: { versionKey: ({ id }) => ['users', id] },
        }),
      { httpClient: client },
    );
    queryClient.setQueryData(['users', 5], { data: { id: 5 }, version: 11 });

    await act(async () => {
      await result.current.mutateAsync({ id: 5, body: { name: 'Ada' } });
    });

    expect(calls[0]?.headers?.[OCC_HEADER]).toBe('"11"');
  });

  it('mutation rejects when occ resolver finds no cached entry', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { ok: true },
    }));

    const { result } = renderHookWithProviders(
      () =>
        usePutMutationBase<{ ok: boolean }, { name: string }>('/users', {
          occ: { versionKey: ({ id }) => ['users', id] },
        }),
      { httpClient: client },
    );

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 99, body: { name: 'x' } })).rejects.toThrow(
        /OCC.*Could not resolve/,
      );
    });
  });
});

describe('usePatchMutationBase', () => {
  it('PATCHes to {basePath}/{id} when basePath does not contain :id', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: undefined,
    }));

    const { result } = renderHookWithProviders(
      () => usePatchMutationBase<void, { name: string }>('/users'),
      { httpClient: client },
    );

    await act(async () => {
      await result.current.mutateAsync({ id: 7, body: { name: 'A' } });
    });

    expect(calls[0]?.url).toBe('/users/7');
  });

  it('substitutes :id in basePath when present', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: undefined,
    }));

    const { result } = renderHookWithProviders(
      () => usePatchMutationBase<void, { name: string }>('/orgs/:id/seats'),
      { httpClient: client },
    );

    await act(async () => {
      await result.current.mutateAsync({ id: 'acme', body: { name: 'A' } });
    });

    expect(calls[0]?.url).toBe('/orgs/acme/seats');
  });
});

describe('useDeleteMutationBase', () => {
  it('DELETEs to {basePath}/{id} when variables is a primitive id', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 204,
      headers: {},
      data: undefined,
    }));

    const { result } = renderHookWithProviders(
      () => useDeleteMutationBase<void, string>('/users'),
      { httpClient: client },
    );

    await act(async () => {
      await result.current.mutateAsync('abc');
    });

    expect(calls[0]?.method).toBe('DELETE');
    expect(calls[0]?.url).toBe('/users/abc');
  });

  it('handles {id} variable shape and attaches If-Match when occ is provided', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 204,
      headers: {},
      data: undefined,
    }));

    const { result, queryClient } = renderHookWithProviders(
      () =>
        useDeleteMutationBase<void, { id: number }>('/users', {
          occ: { versionKey: ({ id }) => ['users', id] },
        }),
      { httpClient: client },
    );
    queryClient.setQueryData(['users', 3], { data: { id: 3 }, version: 4 });

    await act(async () => {
      await result.current.mutateAsync({ id: 3 });
    });

    expect(calls[0]?.url).toBe('/users/3');
    expect(calls[0]?.headers?.[OCC_HEADER]).toBe('"4"');
  });
});

describe('mutations — invalidate-on-success integration smoke', () => {
  it('mutation success surfaces typed data to the caller', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 201,
      headers: {},
      data: { id: 'created' },
    }));

    const { result } = renderHookWithProviders(
      () => usePostMutationBase<{ id: string }, { name: string }>('/users'),
      { httpClient: client },
    );

    await act(async () => {
      await result.current.mutateAsync({ name: 'A' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 'created' });
  });
});
