import type { HttpClient, HttpHeaders, HttpRequestBody } from '@quilla-fe-kit/api-client';
import { useMutation, type UseMutationOptions, useQueryClient } from '@tanstack/react-query';
import { buildMutationOnSuccess, type IdAndBody, type InvalidateKeys, mergeMutationHeaders } from './mutation.type.js';
import { buildOCCHeaders, type VersionResolver } from './occ.helper.js';

export type UsePutMutationOptions<TData, TBody, TError> = Omit<
  UseMutationOptions<TData, TError, IdAndBody<TBody>>,
  'mutationFn'
> & {
  readonly headers?: HttpHeaders;
  readonly occ?: VersionResolver<IdAndBody<TBody>>;
  readonly invalidate?: InvalidateKeys<IdAndBody<TBody>, TData>;
};

export const usePutMutationBase = <TData, TBody = unknown, TError = Error>(
  client: HttpClient,
  basePath: string,
  options: UsePutMutationOptions<TData, TBody, TError> = {},
) => {
  const queryClient = useQueryClient();
  const { headers, occ, invalidate, onSuccess: userOnSuccess, ...rest } = options;

  return useMutation<TData, TError, IdAndBody<TBody>>({
    mutationFn: async (vars) => {
      const merged = mergeMutationHeaders(headers, buildOCCHeaders(queryClient, occ, vars));
      const response = await client.request<TData>({
        method: 'PUT',
        url: `${basePath}/${vars.id}`,
        body: (vars.body ?? {}) as HttpRequestBody,
        ...(merged ? { headers: merged } : {}),
      });
      return response.data;
    },
    ...rest,
    ...buildMutationOnSuccess(queryClient, invalidate, userOnSuccess),
  });
};
