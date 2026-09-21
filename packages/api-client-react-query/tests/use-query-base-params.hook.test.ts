import { describe, expect, it } from 'vitest';
import type { QueryBasePageParam } from '../src/query-base-input.type.js';
import { buildQueryBaseParams, mergePageParam } from '../src/use-query-base-params.hook.js';

describe('buildQueryBaseParams — precedence', () => {
  it('lets typed fields beat extra on a key collision', () => {
    const { params } = buildQueryBaseParams(
      { page: 2, extra: { page: 99, keep: 'yes' } },
      undefined,
      3,
    );
    expect(params).toEqual({ page: 2, keep: 'yes' });
  });

  it('keeps extra keys the typed fields leave unset', () => {
    const { params } = buildQueryBaseParams({ extra: { view: 'graph' } }, undefined, 3);
    expect(params).toEqual({ view: 'graph' });
  });

  it('drops empty-string search values and omits an empty search bag', () => {
    const { params } = buildQueryBaseParams({ search: { name: '' } }, { name: '' }, 3);
    expect(params).not.toHaveProperty('search');
  });

  it('infers enabled=false while search sits below the minimum length', () => {
    expect(
      buildQueryBaseParams({ search: { name: 'ad' } }, { name: 'ad' }, 3).inferredEnabled,
    ).toBe(false);
    expect(
      buildQueryBaseParams({ search: { name: 'ada' } }, { name: 'ada' }, 3).inferredEnabled,
    ).toBe(true);
  });

  it('infers enabled=true when no search is present at all', () => {
    expect(buildQueryBaseParams({ filter: { a: 1 } }, undefined, 3).inferredEnabled).toBe(true);
  });
});

describe('mergePageParam — precedence and naming', () => {
  it('lets the page param beat the seed params', () => {
    expect(mergePageParam({ page: 1, limit: 20 }, { page: 3 })).toEqual({ page: 3, limit: 20 });
  });

  it('passes a consumer-named key through under that exact name', () => {
    expect(mergePageParam({ limit: 20 }, { cursor: 'abc' })).toEqual({
      limit: 20,
      cursor: 'abc',
    });
    expect(mergePageParam({}, { pagina: 2 })).toEqual({ pagina: 2 });
  });

  it('lets named page-param fields beat the page param extra bag', () => {
    expect(mergePageParam({}, { limit: 50, extra: { limit: 10, after: 'x' } })).toEqual({
      limit: 50,
      after: 'x',
    });
  });

  it('ignores undefined page-param fields', () => {
    // exactOptionalPropertyTypes rejects an explicit undefined at the type level; the
    // runtime guard still matters for JS consumers and for dynamically built params.
    const pageParam = { page: undefined, cursor: 'c' } as unknown as QueryBasePageParam;
    expect(mergePageParam({ page: 1 }, pageParam)).toEqual({ page: 1, cursor: 'c' });
  });
});
