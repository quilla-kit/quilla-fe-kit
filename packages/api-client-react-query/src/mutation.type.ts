import type { HttpHeaders } from '@quilla-fe-kit/api-client';
import { type QueryKey, type UseMutationOptions } from '@tanstack/react-query';
import { getQueryInvalidator } from './query-client.factory.js';

export type IdAndBody<TBody> = {
  readonly id: string | number;
  readonly body?: TBody;
};

export type InvalidateKeys<TVars, TData> =
  | QueryKey[]
  | ((vars: TVars, data: TData) => QueryKey[]);

export const resolveInvalidateKeys = <TVars, TData>(
  invalidate: InvalidateKeys<TVars, TData>,
  vars: TVars,
  data: TData,
): QueryKey[] => (typeof invalidate === 'function' ? invalidate(vars, data) : invalidate);

export const buildMutationOnSuccess = <TData, TVars>(
  invalidate: InvalidateKeys<TVars, TData> | undefined,
  userOnSuccess: UseMutationOptions<TData, unknown, TVars>['onSuccess'] | undefined,
): Pick<UseMutationOptions<TData, unknown, TVars>, 'onSuccess'> => {
  if (invalidate === undefined && userOnSuccess === undefined) return {};
  return {
    onSuccess: async (data, vars, onMutateResult, context) => {
      if (invalidate) {
        await getQueryInvalidator().invalidate(resolveInvalidateKeys(invalidate, vars, data));
      }
      await userOnSuccess?.(data, vars, onMutateResult, context);
    },
  };
};

export const mergeMutationHeaders = (
  headers: HttpHeaders | undefined,
  occHeaders: HttpHeaders | undefined,
): HttpHeaders | undefined => {
  if (!headers && !occHeaders) return undefined;
  return { ...(headers ?? {}), ...(occHeaders ?? {}) };
};
