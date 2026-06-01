import type { HttpClient, HttpHeaders } from '@quilla-fe-kit/api-client';
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { applyMutationTransformer, buildMutationOnSuccess, type InvalidateKeys, mergeMutationHeaders } from './mutation.type.js';
import { buildOCCHeaders, type VersionResolver } from './occ.helper.js';
import type { MutationTransformer } from './transformer.type.js';

export type UseDeleteMutationOptions<TData, TVars, TError> = Omit<
  UseMutationOptions<TData, TError, TVars>,
  'mutationFn'
> & {
  readonly headers?: HttpHeaders;
  readonly occ?: VersionResolver<TVars>;
  readonly invalidate?: InvalidateKeys<TVars, TData>;
  readonly transformer?: MutationTransformer;
};

export const useDeleteMutationBase = <TData = void, TVars = string | number, TError = Error>(
  client: HttpClient,
  basePath: string,
  options: UseDeleteMutationOptions<TData, TVars, TError> = {},
  defaultTransformer?: MutationTransformer,
) => {
  const { headers, occ, invalidate, onSuccess: userOnSuccess, transformer, ...rest } = options;

  return useMutation<TData, TError, TVars>({
    mutationFn: async (vars) => {
      const merged = mergeMutationHeaders(headers, buildOCCHeaders(occ, vars));
      const id = isIdAndBody(vars) ? vars.id : (vars as string | number);
      const response = await client.request<unknown>({
        method: 'DELETE',
        url: `${basePath}/${id}`,
        ...(merged ? { headers: merged } : {}),
      });
      return applyMutationTransformer<TData>(response.data, transformer ?? defaultTransformer);
    },
    ...rest,
    ...buildMutationOnSuccess(invalidate, userOnSuccess),
  });
};

const isIdAndBody = (v: unknown): v is { id: string | number } =>
  typeof v === 'object' && v !== null && 'id' in v;
