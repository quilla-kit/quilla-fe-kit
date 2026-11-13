import { type HttpRequest, OCC_HEADER } from '@quilla-fe-kit/api-client';
import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHooks } from '../src/hooks.factory.js';
import { createQueryClient, resetQueryClient } from '../src/query-client.factory.js';
import { createQueryKeys } from '../src/query-keys.factory.js';
import type { UsePostMutationOptions } from '../src/use-post-mutation.hook.js';
import { createFakeHttpClient, renderHookWithProviders } from './helpers/render.helper.js';

beforeEach(() => {
  resetQueryClient();
});

describe('usePostMutationBase', () => {
  it('POSTs to the base path verbatim with `body` as the request body', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { id: 'new' },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.usePostMutationBase<{ id: string }, { name: string }>('/users'),
    );

    let resolved: { id: string } | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync({ body: { name: 'Ada' } });
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
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.usePostMutationBase<void, { token: string }>('/login', { disabledAuth: true }),
    );

    await act(async () => {
      await result.current.mutateAsync({ body: { token: 'x' } });
    });

    expect(calls[0]?.disabledAuth).toBe(true);
  });

  const renderPost = <TBody = unknown>(
    path: string,
    options?: UsePostMutationOptions<void, TBody, Error>,
  ) => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: undefined,
    }));
    const hooks = createHooks(client);
    const { result } = renderHookWithProviders(() =>
      hooks.usePostMutationBase<void, TBody>(path, options),
    );
    return { result, calls };
  };

  it('substitutes placeholders from params and keeps them out of the body', async () => {
    const { result, calls } = renderPost<{ reason: string }>('/orgs/:orgId/users/:id/suspend');

    await act(async () => {
      await result.current.mutateAsync({
        params: { orgId: 'a/b', id: 42 },
        body: { reason: 'spam' },
      });
    });

    expect(calls[0]?.url).toBe('/orgs/a%2Fb/users/42/suspend');
    expect(calls[0]?.body).toEqual({ reason: 'spam' });
  });

  it('never appends an id when the base path has no placeholders', async () => {
    const { result, calls } = renderPost<{ id: string; name: string }>('/users');

    await act(async () => {
      await result.current.mutateAsync({ body: { id: 'u-1', name: 'Ada' } });
    });

    expect(calls[0]?.url).toBe('/users');
    expect(calls[0]?.body).toEqual({ id: 'u-1', name: 'Ada' });
  });

  it('sends an empty object when no body is given', async () => {
    const { result, calls } = renderPost('/users/:id/activate');

    await act(async () => {
      await result.current.mutateAsync({ params: { id: 7 } });
    });

    expect(calls[0]?.url).toBe('/users/7/activate');
    expect(calls[0]?.body).toEqual({});
  });

  it('resolveUrl wins over placeholders and is used verbatim', async () => {
    const { result, calls } = renderPost<{ email: string }>('/orgs/:orgId/members', {
      resolveUrl: ({ params }) => `/v2/orgs/${params?.orgId}/members?raw=a/b`,
    });

    await act(async () => {
      await result.current.mutateAsync({ params: { orgId: 'acme' }, body: { email: 'a@b.c' } });
    });

    expect(calls[0]?.url).toBe('/v2/orgs/acme/members?raw=a/b');
    expect(calls[0]?.body).toEqual({ email: 'a@b.c' });
  });

  it('rejects an unresolved placeholder without sending a request', async () => {
    const { result, calls } = renderPost<{ reason: string }>('/users/:id/suspend');

    await act(async () => {
      await expect(result.current.mutateAsync({ body: { reason: 'x' } })).rejects.toThrow(/':id'/);
    });
    expect(calls).toHaveLength(0);
  });

  it('rejects a bare body at compile time and at runtime', async () => {
    const { result, calls } = renderPost<{ name: string }>('/users');

    await act(async () => {
      // @ts-expect-error the body must be wrapped as { body }
      await expect(result.current.mutateAsync({ name: 'Ada' })).rejects.toThrow(/\[post\]/);
    });
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['a body mixed into the envelope', { body: { name: 'Ada' }, name: 'Ada' }],
    ['a FormData instance', new FormData()],
    ['a primitive', 'abc'],
  ])('rejects %s as variables without sending a request', async (_name, vars) => {
    const { result, calls } = renderPost('/users');

    await act(async () => {
      await expect(result.current.mutateAsync(vars as never)).rejects.toThrow(/\[post\]/);
    });
    expect(calls).toHaveLength(0);
  });

  it('passes the envelope to invalidate and onSuccess', async () => {
    const queryClient = createQueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const { client } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { ok: true },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(
      () =>
        hooks.usePostMutationBase<{ ok: boolean }, { reason: string }>('/users/:id/suspend', {
          invalidate: ({ params }) => [['users', 'detail', params?.id]],
          onSuccess,
        }),
      { queryClient },
    );

    const vars = { params: { id: 42 }, body: { reason: 'spam' } };
    await act(async () => {
      await result.current.mutateAsync(vars);
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['users', 'detail', 42] });
    expect(onSuccess.mock.calls[0]?.[1]).toEqual(vars);
  });
});

describe('usePutMutationBase', () => {
  it('PUTs to {basePath}/{id} with body and no OCC header by default', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { ok: true },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.usePutMutationBase<{ ok: boolean }, { name: string }>('/users'),
    );

    await act(async () => {
      await result.current.mutateAsync({ id: 5, body: { name: 'Ada' } });
    });

    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.url).toBe('/users/5');
    expect(calls[0]?.body).toEqual({ name: 'Ada' });
    expect(calls[0]?.headers?.[OCC_HEADER]).toBeUndefined();
  });

  it('attaches If-Match header from cached version when occ resolver is provided', async () => {
    const queryClient = createQueryClient();
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { ok: true },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(
      () =>
        hooks.usePutMutationBase<{ ok: boolean }, { name: string }>('/users', {
          occ: { versionKey: ({ id }) => ['users', id] },
        }),
      { queryClient },
    );
    queryClient.setQueryData(['users', 5], { data: { id: 5 }, version: 11 });

    await act(async () => {
      await result.current.mutateAsync({ id: 5, body: { name: 'Ada' } });
    });

    expect(calls[0]?.headers?.[OCC_HEADER]).toBe('"11"');
  });

  it('mutation rejects when occ resolver finds no cached entry', async () => {
    const queryClient = createQueryClient();
    const { client } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { ok: true },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(
      () =>
        hooks.usePutMutationBase<{ ok: boolean }, { name: string }>('/users', {
          occ: { versionKey: ({ id }) => ['users', id] },
        }),
      { queryClient },
    );

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 99, body: { name: 'x' } })).rejects.toThrow(
        /OCC.*Could not resolve/,
      );
    });
  });

  it('resolves the reporter route: id mid-path, with OCC and invalidation intact', async () => {
    const queryClient = createQueryClient();
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { ok: true },
    }));
    const hooks = createHooks(client);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    const { result } = renderHookWithProviders(
      () =>
        hooks.usePutMutationBase<{ ok: boolean }, { note: string }>('/claims/:id/settle', {
          occ: { versionKey: ({ id }) => ['claims', id] },
          invalidate: [['claims']],
        }),
      { queryClient },
    );
    queryClient.setQueryData(['claims', 42], { data: { id: 42 }, version: 3 });

    await act(async () => {
      await result.current.mutateAsync({ id: 42, body: { note: 'paid' } });
    });

    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.url).toBe('/claims/42/settle');
    expect(calls[0]?.headers?.[OCC_HEADER]).toBe('"3"');
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('resolveUrl wins over basePath and is used verbatim', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { ok: true },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.usePutMutationBase<{ ok: boolean }, { name: string }>('/users', {
        resolveUrl: ({ id }) => `/claims/${id}/settle?raw=a/b`,
      }),
    );

    await act(async () => {
      await result.current.mutateAsync({ id: 'a/b', body: { name: 'Ada' } });
    });

    expect(calls[0]?.url).toBe('/claims/a/b/settle?raw=a/b');
  });
});

describe('usePatchMutationBase', () => {
  it('PATCHes to {basePath}/{id} when basePath does not contain :id', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: undefined,
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.usePatchMutationBase<void, { name: string }>('/users'),
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
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.usePatchMutationBase<void, { name: string }>('/orgs/:id/seats'),
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
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useDeleteMutationBase<void, string>('/users'),
    );

    await act(async () => {
      await result.current.mutateAsync('abc');
    });

    expect(calls[0]?.method).toBe('DELETE');
    expect(calls[0]?.url).toBe('/users/abc');
  });

  it('handles {id} variable shape and attaches If-Match when occ is provided', async () => {
    const queryClient = createQueryClient();
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 204,
      headers: {},
      data: undefined,
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(
      () =>
        hooks.useDeleteMutationBase<void, { id: number }>('/users', {
          occ: { versionKey: ({ id }) => ['users', id] },
        }),
      { queryClient },
    );
    queryClient.setQueryData(['users', 3], { data: { id: 3 }, version: 4 });

    await act(async () => {
      await result.current.mutateAsync({ id: 3 });
    });

    expect(calls[0]?.url).toBe('/users/3');
    expect(calls[0]?.headers?.[OCC_HEADER]).toBe('"4"');
  });
  it('resolves placeholders from a caller-shaped object with no id', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 204,
      headers: {},
      data: undefined,
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useDeleteMutationBase<void, { orgId: string; seatId: number }>(
        '/orgs/:orgId/seats/:seatId',
      ),
    );

    await act(async () => {
      await result.current.mutateAsync({ orgId: 'acme', seatId: 9 });
    });

    expect(calls[0]?.url).toBe('/orgs/acme/seats/9');
  });

  it('rejects rather than sending /users/[object Object]', async () => {
    const { client, calls } = createFakeHttpClient(async () => ({
      status: 204,
      headers: {},
      data: undefined,
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.useDeleteMutationBase<void, { orgId: string }>('/users'),
    );

    await act(async () => {
      await expect(result.current.mutateAsync({ orgId: 'acme' })).rejects.toThrow(/\[url\]/);
    });
    expect(calls).toHaveLength(0);
  });
});

describe('mutations — invalidate-on-success integration smoke', () => {
  it('mutation success surfaces typed data to the caller', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 201,
      headers: {},
      data: { id: 'created' },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.usePostMutationBase<{ id: string }, { name: string }>('/users'),
    );

    await act(async () => {
      await result.current.mutateAsync({ body: { name: 'A' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 'created' });
  });
});

describe('mutations — transformers', () => {
  it('factory mutationTransformer is applied to the response before returning', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 201,
      headers: {},
      data: { payload: { id: 'created' } },
    }));
    const hooks = createHooks(client, {
      mutationTransformer: (raw) => (raw as { payload: unknown }).payload,
    });

    const { result } = renderHookWithProviders(() =>
      hooks.usePostMutationBase<{ id: string }, { name: string }>('/users'),
    );

    let resolved: { id: string } | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync({ body: { name: 'A' } });
    });

    expect(resolved).toEqual({ id: 'created' });
  });

  it('hook-level transformer overrides the factory mutationTransformer', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 200,
      headers: {},
      data: { result: { id: 99 } },
    }));
    const hooks = createHooks(client, {
      mutationTransformer: (raw) => (raw as { payload: unknown }).payload,
    });

    const { result } = renderHookWithProviders(() =>
      hooks.usePostMutationBase<{ id: number }, { name: string }>('/special', {
        transformer: (raw) => (raw as { result: unknown }).result,
      }),
    );

    let resolved: { id: number } | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync({ body: { name: 'A' } });
    });

    expect(resolved).toEqual({ id: 99 });
  });

  it('without transformer response.data is returned as-is', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 201,
      headers: {},
      data: { id: 'raw' },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(() =>
      hooks.usePostMutationBase<{ id: string }, { name: string }>('/users'),
    );

    let resolved: { id: string } | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync({ body: { name: 'A' } });
    });

    expect(resolved).toEqual({ id: 'raw' });
  });

  it('mutationTransformer receives undefined for 204 No Content and passes it through', async () => {
    const { client } = createFakeHttpClient(async () => ({
      status: 204,
      headers: {},
      data: undefined,
    }));
    const hooks = createHooks(client, {
      mutationTransformer: (raw) => {
        if (raw == null) return raw;
        return (raw as { payload: unknown }).payload;
      },
    });

    const { result } = renderHookWithProviders(() =>
      hooks.useDeleteMutationBase<void, string>('/users'),
    );

    await act(async () => {
      await result.current.mutateAsync('abc');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('mutations — invalidate option uses getQueryInvalidator()', () => {
  it('calls invalidate on the singleton invalidator with the resolved keys on success', async () => {
    const queryClient = createQueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    const { client } = createFakeHttpClient(async () => ({
      status: 201,
      headers: {},
      data: { id: 'new' },
    }));
    const hooks = createHooks(client);

    const { result } = renderHookWithProviders(
      () =>
        hooks.usePostMutationBase<{ id: string }, { name: string }>('/users', {
          invalidate: [['users', 'list']],
        }),
      { queryClient },
    );

    await act(async () => {
      await result.current.mutateAsync({ body: { name: 'A' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['users', 'list'] });
  });
});

describe('OCC with a real useQueryBase read', () => {
  const userKeys = createQueryKeys('users');

  const setup = (options: { getNeverResolves?: boolean } = {}) => {
    const { client, calls } = createFakeHttpClient(async (config) => {
      if (config.method === undefined || config.method === 'GET') {
        if (options.getNeverResolves) await new Promise(() => {});
        return { status: 200, headers: { etag: '"11"' }, data: { id: 5, name: 'Ada' } };
      }
      return { status: 200, headers: {}, data: { ok: true } };
    });
    return { hooks: createHooks(client), calls, queryClient: createQueryClient() };
  };

  const writes = (calls: HttpRequest[]) =>
    calls.filter((c) => c.method !== undefined && c.method !== 'GET');

  it('PUT sends If-Match from a plain detail read using the base key', async () => {
    const { hooks, calls, queryClient } = setup();
    const { result } = renderHookWithProviders(
      () => ({
        read: hooks.useQueryBase<{ id: number }>(userKeys.detail(5), '/users/5'),
        put: hooks.usePutMutationBase<{ ok: boolean }, { name: string }>('/users', {
          occ: { versionKey: ({ id }) => userKeys.detail(id) },
        }),
      }),
      { queryClient },
    );
    await waitFor(() => expect(result.current.read.isSuccess).toBe(true));

    await act(async () => {
      await result.current.put.mutateAsync({ id: 5, body: { name: 'Grace' } });
    });

    expect(writes(calls)[0]?.headers?.[OCC_HEADER]).toBe('"11"');
  });

  it('DELETE sends If-Match from a plain detail read using the base key', async () => {
    const { hooks, calls, queryClient } = setup();
    const { result } = renderHookWithProviders(
      () => ({
        read: hooks.useQueryBase<{ id: number }>(userKeys.detail(5), '/users/5'),
        remove: hooks.useDeleteMutationBase<{ ok: boolean }, { id: number }>('/users', {
          occ: { versionKey: ({ id }) => userKeys.detail(id) },
        }),
      }),
      { queryClient },
    );
    await waitFor(() => expect(result.current.read.isSuccess).toBe(true));

    await act(async () => {
      await result.current.remove.mutateAsync({ id: 5 });
    });

    expect(writes(calls)[0]?.method).toBe('DELETE');
    expect(writes(calls)[0]?.headers?.[OCC_HEADER]).toBe('"11"');
  });

  it('never sends a write when the read used query options and versionKey is the base key', async () => {
    const { hooks, calls, queryClient } = setup();
    const { result } = renderHookWithProviders(
      () => ({
        read: hooks.useQueryBase<{ id: number }>(userKeys.detail(5), '/users/5', {
          query: { filter: { status: 'active' } },
        }),
        put: hooks.usePutMutationBase<{ ok: boolean }, { name: string }>('/users', {
          occ: { versionKey: ({ id }) => userKeys.detail(id) },
        }),
      }),
      { queryClient },
    );
    await waitFor(() => expect(result.current.read.isSuccess).toBe(true));

    await act(async () => {
      await expect(
        result.current.put.mutateAsync({ id: 5, body: { name: 'Grace' } }),
      ).rejects.toThrow(/OCC.*Could not resolve/);
    });
    expect(writes(calls)).toHaveLength(0);
  });

  it('never sends a write while the read is still pending', async () => {
    const { hooks, calls, queryClient } = setup({ getNeverResolves: true });
    const { result } = renderHookWithProviders(
      () => ({
        read: hooks.useQueryBase<{ id: number }>(userKeys.detail(5), '/users/5'),
        put: hooks.usePutMutationBase<{ ok: boolean }, { name: string }>('/users', {
          occ: { versionKey: ({ id }) => userKeys.detail(id) },
        }),
      }),
      { queryClient },
    );
    await waitFor(() => expect(calls).toHaveLength(1));

    await act(async () => {
      await expect(
        result.current.put.mutateAsync({ id: 5, body: { name: 'Grace' } }),
      ).rejects.toThrow(/Could not resolve version.*also tried.*\{\}/);
    });
    expect(writes(calls)).toHaveLength(0);
  });
});
