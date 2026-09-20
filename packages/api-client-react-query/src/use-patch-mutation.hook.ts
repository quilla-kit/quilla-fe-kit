import type { HttpClient, HttpHeaders, HttpRequestBody } from '@quilla-fe-kit/api-client';
import { type UseMutationOptions, useMutation } from '@tanstack/react-query';
import { type UrlResolver, resolveMutationUrl } from './mutation-url.helper.js';
import {
  type IdAndBody,
  type InvalidateKeys,
  applyMutationTransformer,
  buildMutationOnSuccess,
  mergeMutationHeaders,
} from './mutation.type.js';
import { type VersionResolver, buildOCCHeaders } from './occ.helper.js';
import type { MutationTransformer } from './transformer.type.js';

export type UsePatchMutationOptions<TData, TBody, TError> = Omit<
  UseMutationOptions<TData, TError, IdAndBody<TBody>>,
  'mutationFn'
> & {
  readonly headers?: HttpHeaders;
  readonly occ?: VersionResolver<IdAndBody<TBody>>;
  readonly invalidate?: InvalidateKeys<IdAndBody<TBody>, TData>;
  readonly transformer?: MutationTransformer;
  readonly resolveUrl?: UrlResolver<IdAndBody<TBody>>;
};

export const usePatchMutationBase = <TData, TBody = unknown, TError = Error>(
  client: HttpClient,
  basePath: string,
  options: UsePatchMutationOptions<TData, TBody, TError> = {},
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

  return useMutation<TData, TError, IdAndBody<TBody>>({
    mutationFn: async (vars) => {
      const merged = mergeMutationHeaders(headers, buildOCCHeaders(occ, vars));
      const response = await client.request<unknown>({
        method: 'PATCH',
        url: resolveUrl?.(vars) ?? resolveMutationUrl(basePath, vars),
        body: (vars.body ?? {}) as HttpRequestBody,
        ...(merged ? { headers: merged } : {}),
      });
      return applyMutationTransformer<TData>(response.data, transformer ?? defaultTransformer);
    },
    ...rest,
    ...buildMutationOnSuccess(invalidate, userOnSuccess),
  });
};
