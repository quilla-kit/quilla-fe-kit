import { QuerySerializationError } from '@quilla-fe-kit/errors';
import type { HttpQueryParams } from './http-types.type.js';
import type { QueryStringSerializer } from './query-string-serializer.interface.js';

export type QueryConventions = {
  readonly searchSuffix: string;
  readonly paginationKeys: {
    readonly page: string;
    readonly limit: string;
    readonly sort: string;
  };
};

export const DEFAULT_QUERY_CONVENTIONS: QueryConventions = {
  searchSuffix: '__contains',
  paginationKeys: { page: 'page', limit: 'pageSize', sort: 'sort' },
};

type FlatQueryValue = {
  readonly value: unknown;
  readonly path: string;
};

const PAGINATION_INPUT_KEYS = ['page', 'limit', 'sort'] as const;
const PAGINATION_INPUT_SET = new Set<string>(PAGINATION_INPUT_KEYS);
const SEARCH_KEY = 'search';
const FILTER_KEY = 'filter';

export class RepeatParamsSerializer implements QueryStringSerializer {
  protected readonly conventions: QueryConventions;

  constructor(conventions: Partial<QueryConventions> = {}) {
    this.conventions = {
      searchSuffix: conventions.searchSuffix ?? DEFAULT_QUERY_CONVENTIONS.searchSuffix,
      paginationKeys: {
        ...DEFAULT_QUERY_CONVENTIONS.paginationKeys,
        ...conventions.paginationKeys,
      },
    };
  }

  serialize(params: HttpQueryParams): string {
    if (!params) return '';

    const parts: string[] = [];

    for (const [key, { value, path }] of this.flatten(params)) {
      if (value === null || value === undefined) continue;
      const encodedKey = encodeURIComponent(key);

      if (Array.isArray(value)) {
        for (const [index, item] of value.entries()) {
          if (item === null || item === undefined) continue;
          parts.push(
            `${encodedKey}=${encodeURIComponent(this.encodeValue(item, `${path}[${index}]`))}`,
          );
        }
      } else {
        parts.push(`${encodedKey}=${encodeURIComponent(this.encodeValue(value, path))}`);
      }
    }

    return parts.join('&');
  }

  // The seam for consumers whose API wants a non-flat encoding: override this and
  // inherit search/filter/pagination/array handling instead of reimplementing
  // QueryStringSerializer wholesale. `keyPath` is the caller's input path
  // (`filter.age`, `tags[0]`), not the wire key, so diagnostics point at the call site.
  protected encodeValue(value: unknown, keyPath: string): string {
    if (this.isPlainObject(value)) {
      throw new QuerySerializationError({
        message: `Query param "${keyPath}" is a nested object; RepeatParamsSerializer emits a flat query string. Pre-flatten it (e.g. age__gte=18), override encodeValue, or pass a custom QueryStringSerializer.`,
        context: { keyPath },
      });
    }
    return String(value);
  }

  private flatten(params: NonNullable<HttpQueryParams>): Map<string, FlatQueryValue> {
    const out = new Map<string, FlatQueryValue>();
    const { paginationKeys, searchSuffix } = this.conventions;

    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) continue;

      if (key === SEARCH_KEY && this.isPlainObject(value)) {
        for (const [searchKey, searchValue] of Object.entries(value)) {
          out.set(`${searchKey}${searchSuffix}`, {
            value: searchValue,
            path: `${SEARCH_KEY}.${searchKey}`,
          });
        }
        continue;
      }

      if (key === FILTER_KEY && this.isPlainObject(value)) {
        for (const [filterKey, filterValue] of Object.entries(value)) {
          out.set(filterKey, { value: filterValue, path: `${FILTER_KEY}.${filterKey}` });
        }
        continue;
      }

      if (PAGINATION_INPUT_SET.has(key)) {
        const remapped = paginationKeys[key as (typeof PAGINATION_INPUT_KEYS)[number]];
        out.set(remapped, { value, path: key });
        continue;
      }

      out.set(key, { value, path: key });
    }

    return out;
  }

  protected isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }
}
