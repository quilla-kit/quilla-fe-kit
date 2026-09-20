import type { HttpClient, HttpHeaders, HttpRequestBody } from '@quilla-fe-kit/api-client';
import { type UseMutationOptions, useMutation } from '@tanstack/react-query';
import type { UrlResolver } from './mutation-url.helper.js';
import {
  type InvalidateKeys,
  applyMutationTransformer,
  buildMutationOnSuccess,
} from './mutation.type.js';
import type { MutationTransformer } from './transformer.type.js';

export type UsePostMutationOptions<TData, TVars, TError> = Omit<
  UseMutationOptions<TData, TError, TVars>,
  'mutationFn'
> & {
  readonly headers?: HttpHeaders;
  readonly disabledAuth?: boolean;
  readonly invalidate?: InvalidateKeys<TVars, TData>;
  readonly transformer?: MutationTransformer;
  readonly resolveUrl?: UrlResolver<TVars>;
};

export const usePostMutationBase = <TData, TVars = unknown, TError = Error>(
  client: HttpClient,
  url: string,
  options: UsePostMutationOptions<TData, TVars, TError> = {},
  defaultTransformer?: MutationTransformer,
) => {
  const {
    headers,
    disabledAuth,
    invalidate,
    onSuccess: userOnSuccess,
    transformer,
    resolveUrl,
    ...rest
  } = options;

  return useMutation<TData, TError, TVars>({
    mutationFn: async (vars) => {
      const response = await client.request<unknown>({
        method: 'POST',
        url: resolveUrl?.(vars) ?? url,
        body: vars as HttpRequestBody,
        ...(headers ? { headers } : {}),
        ...(disabledAuth ? { disabledAuth: true } : {}),
      });
      return applyMutationTransformer<TData>(response.data, transformer ?? defaultTransformer);
    },
    ...rest,
    ...buildMutationOnSuccess(invalidate, userOnSuccess),
  });
};
