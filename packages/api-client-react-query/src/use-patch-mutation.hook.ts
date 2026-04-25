import type { HttpHeaders, HttpRequestBody } from '@quilla-fe-kit/api-client';
import { useMutation, type UseMutationOptions, useQueryClient } from '@tanstack/react-query';
import { useHttpClient } from './http-client.provider.js';
import { type IdAndBody, mergeMutationHeaders } from './mutation.type.js';
import { buildOCCHeaders, type VersionResolver } from './occ.helper.js';

export type UsePatchMutationOptions<TData, TBody, TError> = Omit<
  UseMutationOptions<TData, TError, IdAndBody<TBody>>,
  'mutationFn'
> & {
  readonly headers?: HttpHeaders;
  readonly occ?: VersionResolver<IdAndBody<TBody>>;
};

export const usePatchMutationBase = <TData, TBody = unknown, TError = Error>(
  basePath: string,
  options: UsePatchMutationOptions<TData, TBody, TError> = {},
) => {
  const client = useHttpClient();
  const queryClient = useQueryClient();
  const { headers, occ, ...rest } = options;

  return useMutation<TData, TError, IdAndBody<TBody>>({
    mutationFn: async (vars) => {
      const merged = mergeMutationHeaders(headers, buildOCCHeaders(queryClient, occ, vars));
      const url = basePath.includes(':id')
        ? basePath.replace(':id', String(vars.id))
        : `${basePath}/${vars.id}`;
      const response = await client.request<TData>({
        method: 'PATCH',
        url,
        body: (vars.body ?? {}) as HttpRequestBody,
        ...(merged ? { headers: merged } : {}),
      });
      return response.data;
    },
    ...rest,
  });
};
