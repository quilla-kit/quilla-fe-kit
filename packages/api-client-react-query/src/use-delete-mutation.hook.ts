import type { HttpClient, HttpHeaders } from '@quilla-fe-kit/api-client';
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { buildMutationOnSuccess, type InvalidateKeys, mergeMutationHeaders } from './mutation.type.js';
import { buildOCCHeaders, type VersionResolver } from './occ.helper.js';

export type UseDeleteMutationOptions<TData, TVars, TError> = Omit<
  UseMutationOptions<TData, TError, TVars>,
  'mutationFn'
> & {
  readonly headers?: HttpHeaders;
  readonly occ?: VersionResolver<TVars>;
  readonly invalidate?: InvalidateKeys<TVars, TData>;
};

export const useDeleteMutationBase = <TData = void, TVars = string | number, TError = Error>(
  client: HttpClient,
  basePath: string,
  options: UseDeleteMutationOptions<TData, TVars, TError> = {},
) => {
  const { headers, occ, invalidate, onSuccess: userOnSuccess, ...rest } = options;

  return useMutation<TData, TError, TVars>({
    mutationFn: async (vars) => {
      const merged = mergeMutationHeaders(headers, buildOCCHeaders(occ, vars));
      const id = isIdAndBody(vars) ? vars.id : (vars as string | number);
      const response = await client.request<TData>({
        method: 'DELETE',
        url: `${basePath}/${id}`,
        ...(merged ? { headers: merged } : {}),
      });
      return response.data;
    },
    ...rest,
    ...buildMutationOnSuccess(invalidate, userOnSuccess),
  });
};

const isIdAndBody = (v: unknown): v is { id: string | number } =>
  typeof v === 'object' && v !== null && 'id' in v;
