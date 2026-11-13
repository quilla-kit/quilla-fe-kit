import type { HttpClient, HttpHeaders, HttpRequestBody } from '@quilla-fe-kit/api-client';
import { type UseMutationOptions, useMutation } from '@tanstack/react-query';
import { type UrlResolver, resolvePathParams } from './mutation-url.helper.js';
import {
  type InvalidateKeys,
  type PostMutationVars,
  applyMutationTransformer,
  buildMutationOnSuccess,
} from './mutation.type.js';
import type { MutationTransformer } from './transformer.type.js';

export type UsePostMutationOptions<TData, TBody, TError> = Omit<
  UseMutationOptions<TData, TError, PostMutationVars<TBody>>,
  'mutationFn'
> & {
  readonly headers?: HttpHeaders;
  readonly disabledAuth?: boolean;
  readonly invalidate?: InvalidateKeys<PostMutationVars<TBody>, TData>;
  readonly transformer?: MutationTransformer;
  readonly resolveUrl?: UrlResolver<PostMutationVars<TBody>>;
};

// Pre-0.10 callers passed the body itself; reject that instead of silently POSTing `{}`.
const isEnvelope = (vars: unknown): vars is PostMutationVars<unknown> => {
  if (typeof vars !== 'object' || vars === null) return false;
  const proto = Object.getPrototypeOf(vars);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.keys(vars).every((key) => key === 'body' || key === 'params');
};

export const usePostMutationBase = <TData, TBody = unknown, TError = Error>(
  client: HttpClient,
  basePath: string,
  options: UsePostMutationOptions<TData, TBody, TError> = {},
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

  return useMutation<TData, TError, PostMutationVars<TBody>>({
    mutationFn: async (input) => {
      const vars = input ?? {};
      if (!isEnvelope(vars)) {
        throw new Error(
          '[post] Mutation variables must be { body?, params? }. Pass the request body as `body` and path values as `params`.',
        );
      }
      const response = await client.request<unknown>({
        method: 'POST',
        url: resolveUrl?.(vars) ?? resolvePathParams(basePath, vars),
        body: (vars.body ?? {}) as HttpRequestBody,
        ...(headers ? { headers } : {}),
        ...(disabledAuth ? { disabledAuth: true } : {}),
      });
      return applyMutationTransformer<TData>(response.data, transformer ?? defaultTransformer);
    },
    ...rest,
    ...buildMutationOnSuccess(invalidate, userOnSuccess),
  });
};
