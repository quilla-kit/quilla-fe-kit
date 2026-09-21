import type { HttpClient, HttpHeaders } from '@quilla-fe-kit/api-client';
import {
  type InfiniteData,
  type QueryKey,
  type UseInfiniteQueryOptions,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchQueryBase } from './query-base-fetch.helper.js';
import type {
  QueryBaseInput,
  QueryBasePageParam,
  QueryBaseTuning,
} from './query-base-input.type.js';
import type { QueryBaseResult } from './query-base-result.type.js';
import { INFINITE_KEY_SEGMENT } from './query-keys.factory.js';
import type { QueryTransformer } from './transformer.type.js';
import { mergePageParam, useQueryBaseParams } from './use-query-base-params.hook.js';

export type QueryBasePageParamFn<TModel, TPageParam> = (
  page: TModel,
  allPages: readonly TModel[],
  pageParam: TPageParam,
  allPageParams: readonly TPageParam[],
) => TPageParam | undefined | null;

// Only the first two generics of UseInfiniteQueryOptions are referenced. Its arity is
// 6 on react-query 5.0-5.59 and 5 from 5.100 on, so anything past position two binds to
// a different parameter depending on the consumer's installed version, and this type is
// emitted into the published .d.ts. Positions past two have defaults in both arities.
export type UseInfiniteQueryBaseOptions<
  TRaw,
  TModel = TRaw,
  TError = Error,
  TPageParam extends QueryBasePageParam = QueryBasePageParam,
> = Omit<
  UseInfiniteQueryOptions<QueryBaseResult<TModel>, TError>,
  | 'queryKey'
  | 'queryFn'
  | 'select'
  | 'initialPageParam'
  | 'getNextPageParam'
  | 'getPreviousPageParam'
> & {
  readonly mapper?: (raw: TRaw) => TModel;
  readonly query?: QueryBaseInput;
  readonly tuning?: QueryBaseTuning;
  readonly headers?: HttpHeaders;
  readonly transformer?: QueryTransformer;
  readonly initialPageParam: TPageParam;
  readonly getNextPageParam: QueryBasePageParamFn<TModel, TPageParam>;
  readonly getPreviousPageParam?: QueryBasePageParamFn<TModel, TPageParam>;
  readonly select?: (
    data: InfiniteData<QueryBaseResult<TModel>, TPageParam>,
  ) => InfiniteData<QueryBaseResult<TModel>, TPageParam>;
};

const unwrapPages =
  <TModel, TPageParam>(fn: QueryBasePageParamFn<TModel, TPageParam>) =>
  (
    page: QueryBaseResult<TModel>,
    allPages: QueryBaseResult<TModel>[],
    pageParam: TPageParam,
    allPageParams: TPageParam[],
  ) =>
    fn(
      page.data,
      allPages.map((p) => p.data),
      pageParam,
      allPageParams,
    );

// Internal only: never referenced by an exported type, so it stays out of the emitted
// .d.ts and may safely use the installed version's arity.
type InternalInfiniteOptions<TModel, TError, TPageParam> = UseInfiniteQueryOptions<
  QueryBaseResult<TModel>,
  TError,
  InfiniteData<QueryBaseResult<TModel>, TPageParam>,
  QueryKey,
  TPageParam
>;

export const useInfiniteQueryBase = <
  TRaw,
  TModel = TRaw,
  TError = Error,
  TPageParam extends QueryBasePageParam = QueryBasePageParam,
>(
  client: HttpClient,
  baseKey: QueryKey,
  url: string,
  options: UseInfiniteQueryBaseOptions<TRaw, TModel, TError, TPageParam>,
  defaultTransformer?: QueryTransformer,
) => {
  const {
    mapper,
    query: rawQuery = {},
    tuning,
    headers,
    transformer,
    enabled: userEnabled,
    initialPageParam,
    getNextPageParam,
    getPreviousPageParam,
    ...restOptions
  } = options;

  const effectiveTransformer = transformer ?? defaultTransformer;
  const { params, inferredEnabled } = useQueryBaseParams(rawQuery, tuning);

  const queryKey: QueryKey = useMemo(
    () => [...(baseKey as unknown[]), INFINITE_KEY_SEGMENT, params],
    [baseKey, params],
  );

  // Pinning the public type to two generics leaves pass-through options (`enabled`,
  // `placeholderData`, ...) phantom-typed with TPageParam = unknown. TPageParam occurs
  // only in callback phantom positions there, so realigning it is sound.
  const passthrough = restOptions as unknown as Partial<
    InternalInfiniteOptions<TModel, TError, TPageParam>
  >;

  return useInfiniteQuery<
    QueryBaseResult<TModel>,
    TError,
    InfiniteData<QueryBaseResult<TModel>, TPageParam>,
    QueryKey,
    TPageParam
  >({
    queryKey,
    // QueryFunctionContext types pageParam through a conditional on TPageParam, which
    // stays deferred while TPageParam is unresolved, so it arrives as `unknown` here.
    queryFn: ({ pageParam, signal }) =>
      fetchQueryBase<TRaw, TModel>({
        client,
        url,
        params: mergePageParam(params, pageParam as TPageParam),
        signal,
        ...(headers ? { headers } : {}),
        ...(effectiveTransformer ? { transformer: effectiveTransformer } : {}),
        ...(mapper ? { mapper } : {}),
      }),
    initialPageParam,
    getNextPageParam: unwrapPages(getNextPageParam),
    ...(getPreviousPageParam ? { getPreviousPageParam: unwrapPages(getPreviousPageParam) } : {}),
    enabled: (userEnabled ?? inferredEnabled) as NonNullable<
      InternalInfiniteOptions<TModel, TError, TPageParam>['enabled']
    >,
    ...passthrough,
  });
};
