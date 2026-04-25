import {
  type HttpHeaders,
  type HttpQueryParams,
  parseETagHeaderValue,
} from '@quilla-fe-kit/api-client';
import { type QueryKey, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useHttpClient } from './http-client.provider.js';
import type { QueryBaseResult } from './query-base-result.type.js';
import { useDebouncedValue } from './use-debounced-value.hook.js';

const SEARCH_KEY = 'search';
const DEFAULT_DEBOUNCE_MS = 500;
const DEFAULT_MIN_SEARCH_LENGTH = 3;

export type QueryBaseInput = {
  readonly search?: Record<string, unknown>;
  readonly filter?: Record<string, unknown>;
  readonly page?: number;
  readonly limit?: number;
  readonly sort?: string | readonly string[];
  readonly extra?: Record<string, unknown>;
};

export type QueryBaseTuning = {
  readonly debounceMs?: number;
  readonly minSearchLength?: number;
};

export type UseQueryBaseOptions<TRaw, TModel = TRaw, TError = Error> = Omit<
  UseQueryOptions<QueryBaseResult<TModel>, TError, QueryBaseResult<TModel>, QueryKey>,
  'queryKey' | 'queryFn'
> & {
  readonly mapper?: (raw: TRaw) => TModel;
  readonly query?: QueryBaseInput;
  readonly tuning?: QueryBaseTuning;
  readonly headers?: HttpHeaders;
};

export const useQueryBase = <TRaw, TModel = TRaw, TError = Error>(
  baseKey: QueryKey,
  url: string,
  options: UseQueryBaseOptions<TRaw, TModel, TError> = {},
) => {
  const client = useHttpClient();
  const {
    mapper,
    query: rawQuery = {},
    tuning,
    headers,
    enabled: userEnabled,
    ...restOptions
  } = options;

  const debounceMs = tuning?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const minSearchLength = tuning?.minSearchLength ?? DEFAULT_MIN_SEARCH_LENGTH;

  // Stabilize the input object's reference so downstream debounce + memos don't
  // thrash when consumers pass inline literals each render.
  const queryHash = JSON.stringify(rawQuery);
  const stableQuery = useMemo(() => rawQuery, [queryHash]);

  const debouncedSearch = useDebouncedValue(stableQuery.search, debounceMs);

  const { params, inferredEnabled } = useMemo(() => {
    const hasSearch = stableQuery.search && Object.keys(stableQuery.search).length > 0;
    const searchActive =
      !!debouncedSearch &&
      Object.values(debouncedSearch).some(
        (v) => typeof v === 'string' && v.length >= minSearchLength,
      );
    const cleanedSearch = stripEmptyStrings(debouncedSearch);

    const next: HttpQueryParams = {};
    if (cleanedSearch && Object.keys(cleanedSearch).length > 0) next[SEARCH_KEY] = cleanedSearch;
    if (stableQuery.filter && Object.keys(stableQuery.filter).length > 0)
      next.filter = stableQuery.filter;
    if (stableQuery.page !== undefined) next.page = stableQuery.page;
    if (stableQuery.limit !== undefined) next.limit = stableQuery.limit;
    if (stableQuery.sort !== undefined) next.sort = stableQuery.sort;
    if (stableQuery.extra) Object.assign(next, stableQuery.extra);

    return { params: next, inferredEnabled: hasSearch ? searchActive : true };
  }, [stableQuery, debouncedSearch, minSearchLength]);

  const queryKey: QueryKey = useMemo(
    () => [...(baseKey as unknown[]), params],
    [baseKey, params],
  );

  return useQuery<QueryBaseResult<TModel>, TError, QueryBaseResult<TModel>, QueryKey>({
    queryKey,
    queryFn: async () => {
      const response = await client.request<unknown>({
        url,
        ...(Object.keys(params).length > 0 ? { params } : {}),
        ...(headers ? { headers } : {}),
      });

      const version = parseETagHeaderValue(response.headers.etag);
      const body = response.data as { data?: TRaw; pagination?: QueryBaseResult<TModel>['pagination'] };
      const raw = (isEnvelope<TRaw>(body) ? body.data : body) as TRaw;
      const mapped = mapper ? mapper(raw) : (raw as unknown as TModel);

      const result: QueryBaseResult<TModel> = {
        data: mapped,
        version,
        ...(isEnvelope<TRaw>(body) && body.pagination ? { pagination: body.pagination } : {}),
      };
      return result;
    },
    enabled: userEnabled !== undefined ? userEnabled : inferredEnabled,
    ...restOptions,
  });
};

const isEnvelope = <T>(
  body: unknown,
): body is { data?: T; pagination?: QueryBaseResult<T>['pagination'] } =>
  typeof body === 'object' && body !== null && 'data' in body;

const stripEmptyStrings = (
  source: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
  if (!source) return source;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v === '') continue;
    out[k] = v;
  }
  return out;
};
