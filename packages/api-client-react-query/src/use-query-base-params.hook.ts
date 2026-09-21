import { useMemo } from 'react';
import type {
  QueryBaseInput,
  QueryBasePageParam,
  QueryBaseTuning,
} from './query-base-input.type.js';
import { useDebouncedValue } from './use-debounced-value.hook.js';

const SEARCH_KEY = 'search';
const DEFAULT_DEBOUNCE_MS = 500;
const DEFAULT_MIN_SEARCH_LENGTH = 3;

export type QueryBaseParams = {
  readonly params: Record<string, unknown>;
  readonly inferredEnabled: boolean;
};

export const buildQueryBaseParams = (
  query: QueryBaseInput,
  debouncedSearch: Record<string, unknown> | undefined,
  minSearchLength: number,
): QueryBaseParams => {
  const hasSearch = !!query.search && Object.keys(query.search).length > 0;
  const searchActive =
    !!debouncedSearch &&
    Object.values(debouncedSearch).some(
      (v) => typeof v === 'string' && v.length >= minSearchLength,
    );
  const cleanedSearch = stripEmptyStrings(debouncedSearch);

  // `extra` goes first so the typed fields win on a key collision: a stray
  // `extra.page` must not silently reshape pagination.
  const params: Record<string, unknown> = { ...query.extra };
  if (cleanedSearch && Object.keys(cleanedSearch).length > 0) params[SEARCH_KEY] = cleanedSearch;
  if (query.filter && Object.keys(query.filter).length > 0) params.filter = query.filter;
  if (query.page !== undefined) params.page = query.page;
  if (query.limit !== undefined) params.limit = query.limit;
  if (query.sort !== undefined) params.sort = query.sort;

  return { params, inferredEnabled: hasSearch ? searchActive : true };
};

// Page-param keys reach the wire under their own names, so a consumer paging with
// `{ cursor }` or `{ pagina }` needs no kit vocabulary; `page`/`limit`/`sort` stay
// canonical so RepeatParamsSerializer can remap them via `paginationKeys`.
export const mergePageParam = (
  params: Record<string, unknown>,
  pageParam: QueryBasePageParam,
): Record<string, unknown> => {
  const { extra, ...named } = pageParam;
  const next: Record<string, unknown> = { ...params, ...extra };
  for (const [key, value] of Object.entries(named)) {
    if (value === undefined) continue;
    next[key] = value;
  }
  return next;
};

export const useQueryBaseParams = (
  query: QueryBaseInput = {},
  tuning?: QueryBaseTuning,
): QueryBaseParams => {
  const debounceMs = tuning?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const minSearchLength = tuning?.minSearchLength ?? DEFAULT_MIN_SEARCH_LENGTH;

  // Stabilize the input object's reference so downstream debounce + memos don't
  // thrash when consumers pass inline literals each render.
  const queryHash = JSON.stringify(query);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the hash is the dependency; depending on `query` itself would re-run on every inline literal.
  const stableQuery = useMemo(() => query, [queryHash]);

  const debouncedSearch = useDebouncedValue(stableQuery.search, debounceMs);

  return useMemo(
    () => buildQueryBaseParams(stableQuery, debouncedSearch, minSearchLength),
    [stableQuery, debouncedSearch, minSearchLength],
  );
};

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
