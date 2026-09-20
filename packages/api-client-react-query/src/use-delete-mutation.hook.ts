import type { HttpClient, HttpHeaders } from '@quilla-fe-kit/api-client';
import { type UseMutationOptions, useMutation } from '@tanstack/react-query';
import { type UrlResolver, resolveMutationUrl } from './mutation-url.helper.js';
import {
  type InvalidateKeys,
  applyMutationTransformer,
  buildMutationOnSuccess,
  mergeMutationHeaders,
} from './mutation.type.js';
import { type VersionResolver, buildOCCHeaders } from './occ.helper.js';
import type { MutationTransformer } from './transformer.type.js';

export type UseDeleteMutationOptions<TData, TVars, TError> = Omit<
  UseMutationOptions<TData, TError, TVars>,
  'mutationFn'
> & {
  readonly headers?: HttpHeaders;
  readonly occ?: VersionResolver<TVars>;
  readonly invalidate?: InvalidateKeys<TVars, TData>;
  readonly transformer?: MutationTransformer;
  readonly resolveUrl?: UrlResolver<TVars>;
};

export const useDeleteMutationBase = <TData = void, TVars = string | number, TError = Error>(
  client: HttpClient,
  basePath: string,
  options: UseDeleteMutationOptions<TData, TVars, TError> = {},
  defaultTransformer?: MutationTransformer,
) => {
  const {
    headers,
    occ,
    invalidate,
    onSuccess: userOnSuccess,
    transformer,
    resolveUrl,
    ...rest
  } = options;

  return useMutation<TData, TError, TVars>({
    mutationFn: async (vars) => {
      const merged = mergeMutationHeaders(headers, buildOCCHeaders(occ, vars));
      const response = await client.request<unknown>({
        method: 'DELETE',
        url: resolveUrl?.(vars) ?? resolveMutationUrl(basePath, vars),
        ...(merged ? { headers: merged } : {}),
      });
      return applyMutationTransformer<TData>(response.data, transformer ?? defaultTransformer);
    },
    ...rest,
    ...buildMutationOnSuccess(invalidate, userOnSuccess),
  });
};
