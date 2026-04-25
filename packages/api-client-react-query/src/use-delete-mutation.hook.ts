import type { HttpHeaders } from '@quilla-fe-kit/api-client';
import { useMutation, type UseMutationOptions, useQueryClient } from '@tanstack/react-query';
import { useHttpClient } from './http-client.provider.js';
import { mergeMutationHeaders } from './mutation.type.js';
import { buildOCCHeaders, type VersionResolver } from './occ.helper.js';

export type UseDeleteMutationOptions<TData, TVars, TError> = Omit<
  UseMutationOptions<TData, TError, TVars>,
  'mutationFn'
> & {
  readonly headers?: HttpHeaders;
  readonly occ?: VersionResolver<TVars>;
};

export const useDeleteMutationBase = <TData = void, TVars = string | number, TError = Error>(
  basePath: string,
  options: UseDeleteMutationOptions<TData, TVars, TError> = {},
) => {
  const client = useHttpClient();
  const queryClient = useQueryClient();
  const { headers, occ, ...rest } = options;

  return useMutation<TData, TError, TVars>({
    mutationFn: async (vars) => {
      const merged = mergeMutationHeaders(headers, buildOCCHeaders(queryClient, occ, vars));
      const id = isIdAndBody(vars) ? vars.id : (vars as string | number);
      const response = await client.request<TData>({
        method: 'DELETE',
        url: `${basePath}/${id}`,
        ...(merged ? { headers: merged } : {}),
      });
      return response.data;
    },
    ...rest,
  });
};

const isIdAndBody = (v: unknown): v is { id: string | number } =>
  typeof v === 'object' && v !== null && 'id' in v;
