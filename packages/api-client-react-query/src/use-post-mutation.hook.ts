import type { HttpClient, HttpHeaders, HttpRequestBody } from '@quilla-fe-kit/api-client';
import { useMutation, type UseMutationOptions, useQueryClient } from '@tanstack/react-query';
import { buildMutationOnSuccess, type InvalidateKeys } from './mutation.type.js';

export type UsePostMutationOptions<TData, TVars, TError> = Omit<
  UseMutationOptions<TData, TError, TVars>,
  'mutationFn'
> & {
  readonly headers?: HttpHeaders;
  readonly disabledAuth?: boolean;
  readonly invalidate?: InvalidateKeys<TVars, TData>;
};

export const usePostMutationBase = <TData, TVars = unknown, TError = Error>(
  client: HttpClient,
  url: string,
  options: UsePostMutationOptions<TData, TVars, TError> = {},
) => {
  const queryClient = useQueryClient();
  const { headers, disabledAuth, invalidate, onSuccess: userOnSuccess, ...rest } = options;

  return useMutation<TData, TError, TVars>({
    mutationFn: async (vars) => {
      const response = await client.request<TData>({
        method: 'POST',
        url,
        body: vars as HttpRequestBody,
        ...(headers ? { headers } : {}),
        ...(disabledAuth ? { disabledAuth: true } : {}),
      });
      return response.data;
    },
    ...rest,
    ...buildMutationOnSuccess(queryClient, invalidate, userOnSuccess),
  });
};
