import type { HttpQueryParams } from './http-types.type.js';
import type { QueryStringSerializer } from './query-string-serializer.interface.js';

export type QueryConventions = {
  readonly searchSuffix: string;
  readonly paginationKeys: {
    readonly page: string;
    readonly limit: string;
    readonly sort: string;
  };
  readonly defaultLimit: number;
};

export const DEFAULT_QUERY_CONVENTIONS: QueryConventions = {
  searchSuffix: '__contains',
  paginationKeys: { page: 'page', limit: 'pageSize', sort: 'sort' },
  defaultLimit: 20,
};

const PAGINATION_INPUT_KEYS = ['page', 'limit', 'sort'] as const;
const PAGINATION_INPUT_SET = new Set<string>(PAGINATION_INPUT_KEYS);
const SEARCH_KEY = 'search';
const FILTER_KEY = 'filter';

export class RepeatParamsSerializer implements QueryStringSerializer {
  private readonly conventions: QueryConventions;

  constructor(conventions: Partial<QueryConventions> = {}) {
    this.conventions = {
      searchSuffix: conventions.searchSuffix ?? DEFAULT_QUERY_CONVENTIONS.searchSuffix,
      paginationKeys: {
        ...DEFAULT_QUERY_CONVENTIONS.paginationKeys,
        ...(conventions.paginationKeys ?? {}),
      },
      defaultLimit: conventions.defaultLimit ?? DEFAULT_QUERY_CONVENTIONS.defaultLimit,
    };
  }

  serialize(params: HttpQueryParams): string {
    if (!params) return '';

    const flat = this.flatten(params);
    const parts: string[] = [];

    for (const [key, value] of Object.entries(flat)) {
      if (value === null || value === undefined) continue;
      const encodedKey = encodeURIComponent(key);

      if (Array.isArray(value)) {
        for (const item of value) {
          if (item === null || item === undefined) continue;
          parts.push(`${encodedKey}=${encodeURIComponent(String(item))}`);
        }
      } else {
        parts.push(`${encodedKey}=${encodeURIComponent(String(value))}`);
      }
    }

    return parts.join('&');
  }

  private flatten(params: NonNullable<HttpQueryParams>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const { paginationKeys, searchSuffix } = this.conventions;

    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) continue;

      if (key === SEARCH_KEY && this.isPlainObject(value)) {
        for (const [searchKey, searchValue] of Object.entries(value)) {
          out[`${searchKey}${searchSuffix}`] = searchValue;
        }
        continue;
      }

      if (key === FILTER_KEY && this.isPlainObject(value)) {
        for (const [filterKey, filterValue] of Object.entries(value)) {
          out[filterKey] = filterValue;
        }
        continue;
      }

      if (PAGINATION_INPUT_SET.has(key)) {
        const remapped = paginationKeys[key as (typeof PAGINATION_INPUT_KEYS)[number]];
        out[remapped] = value;
        continue;
      }

      out[key] = value;
    }

    return out;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }
}
