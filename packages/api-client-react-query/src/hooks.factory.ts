import type { HttpClient } from '@quilla-fe-kit/api-client';
import type { QueryKey } from '@tanstack/react-query';
import { type UseDeleteMutationOptions, useDeleteMutationBase } from './use-delete-mutation.hook.js';
import { type UsePatchMutationOptions, usePatchMutationBase } from './use-patch-mutation.hook.js';
import { type UsePostMutationOptions, usePostMutationBase } from './use-post-mutation.hook.js';
import { type UsePutMutationOptions, usePutMutationBase } from './use-put-mutation.hook.js';
import { type UseQueryBaseOptions, useQueryBase } from './use-query-base.hook.js';

export function createHooks(client: HttpClient) {
  return {
    useQueryBase: <TRaw, TModel = TRaw, TError = Error>(
      baseKey: QueryKey,
      url: string,
      options?: UseQueryBaseOptions<TRaw, TModel, TError>,
    ) => useQueryBase(client, baseKey, url, options),

    usePostMutationBase: <TData, TVars = unknown, TError = Error>(
      url: string,
      options?: UsePostMutationOptions<TData, TVars, TError>,
    ) => usePostMutationBase(client, url, options),

    usePutMutationBase: <TData, TBody = unknown, TError = Error>(
      basePath: string,
      options?: UsePutMutationOptions<TData, TBody, TError>,
    ) => usePutMutationBase(client, basePath, options),

    usePatchMutationBase: <TData, TBody = unknown, TError = Error>(
      basePath: string,
      options?: UsePatchMutationOptions<TData, TBody, TError>,
    ) => usePatchMutationBase(client, basePath, options),

    useDeleteMutationBase: <TData = void, TVars = string | number, TError = Error>(
      basePath: string,
      options?: UseDeleteMutationOptions<TData, TVars, TError>,
    ) => useDeleteMutationBase(client, basePath, options),
  };
}

export type Hooks = ReturnType<typeof createHooks>;
