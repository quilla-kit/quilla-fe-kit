import type { HttpClient, HttpHeaders, HttpRequestBody } from '@quilla-fe-kit/api-client';
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { applyMutationTransformer, buildMutationOnSuccess, type IdAndBody, type InvalidateKeys, mergeMutationHeaders } from './mutation.type.js';
import { buildOCCHeaders, type VersionResolver } from './occ.helper.js';
import type { MutationTransformer } from './transformer.type.js';

export type UsePutMutationOptions<TData, TBody, TError> = Omit<
  UseMutationOptions<TData, TError, IdAndBody<TBody>>,
  'mutationFn'
> & {
  readonly headers?: HttpHeaders;
  readonly occ?: VersionResolver<IdAndBody<TBody>>;
  readonly invalidate?: InvalidateKeys<IdAndBody<TBody>, TData>;
  readonly transformer?: MutationTransformer;
};

export const usePutMutationBase = <TData, TBody = unknown, TError = Error>(
  client: HttpClient,
  basePath: string,
  options: UsePutMutationOptions<TData, TBody, TError> = {},
  defaultTransformer?: MutationTransformer,
) => {
  const { headers, occ, invalidate, onSuccess: userOnSuccess, transformer, ...rest } = options;

  return useMutation<TData, TError, IdAndBody<TBody>>({
    mutationFn: async (vars) => {
      const merged = mergeMutationHeaders(headers, buildOCCHeaders(occ, vars));
      const response = await client.request<unknown>({
        method: 'PUT',
        url: `${basePath}/${vars.id}`,
        body: (vars.body ?? {}) as HttpRequestBody,
        ...(merged ? { headers: merged } : {}),
      });
      return applyMutationTransformer<TData>(response.data, transformer ?? defaultTransformer);
    },
    ...rest,
    ...buildMutationOnSuccess(invalidate, userOnSuccess),
  });
};
