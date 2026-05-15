import type { HttpHeaders, HttpRequestBody } from '@quilla-fe-kit/api-client';
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { useHttpClient } from './http-client.provider.js';

export type UsePostMutationOptions<TData, TVars, TError> = Omit<
  UseMutationOptions<TData, TError, TVars>,
  'mutationFn'
> & {
  readonly headers?: HttpHeaders;
  readonly disabledAuth?: boolean;
};

export const usePostMutationBase = <TData, TVars = unknown, TError = Error>(
  url: string,
  options: UsePostMutationOptions<TData, TVars, TError> = {},
) => {
  const client = useHttpClient();
  const { headers, disabledAuth, ...rest } = options;

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
  });
};
