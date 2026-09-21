import type { HttpClient, HttpHeaders } from '@quilla-fe-kit/api-client';
import { type QueryKey, type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchQueryBase } from './query-base-fetch.helper.js';
import type { QueryBaseInput, QueryBaseTuning } from './query-base-input.type.js';
import type { QueryBaseResult } from './query-base-result.type.js';
import type { QueryTransformer } from './transformer.type.js';
import { useQueryBaseParams } from './use-query-base-params.hook.js';

export type UseQueryBaseOptions<TRaw, TModel = TRaw, TError = Error> = Omit<
  UseQueryOptions<QueryBaseResult<TModel>, TError, QueryBaseResult<TModel>, QueryKey>,
  'queryKey' | 'queryFn'
> & {
  readonly mapper?: (raw: TRaw) => TModel;
  readonly query?: QueryBaseInput;
  readonly tuning?: QueryBaseTuning;
  readonly headers?: HttpHeaders;
  readonly transformer?: QueryTransformer;
};

export const useQueryBase = <TRaw, TModel = TRaw, TError = Error>(
  client: HttpClient,
  baseKey: QueryKey,
  url: string,
  options: UseQueryBaseOptions<TRaw, TModel, TError> = {},
  defaultTransformer?: QueryTransformer,
) => {
  const {
    mapper,
    query: rawQuery = {},
    tuning,
    headers,
    transformer,
    enabled: userEnabled,
    ...restOptions
  } = options;

  const effectiveTransformer = transformer ?? defaultTransformer;
  const { params, inferredEnabled } = useQueryBaseParams(rawQuery, tuning);

  const queryKey: QueryKey = useMemo(() => [...(baseKey as unknown[]), params], [baseKey, params]);

  return useQuery<QueryBaseResult<TModel>, TError, QueryBaseResult<TModel>, QueryKey>({
    queryKey,
    queryFn: ({ signal }) =>
      fetchQueryBase<TRaw, TModel>({
        client,
        url,
        params,
        signal,
        ...(headers ? { headers } : {}),
        ...(effectiveTransformer ? { transformer: effectiveTransformer } : {}),
        ...(mapper ? { mapper } : {}),
      }),
    enabled: userEnabled ?? inferredEnabled,
    ...restOptions,
  });
};
