import { describe, expect, it } from 'vitest';
import { RepeatParamsSerializer } from '../../src/http/repeat-params.serializer.js';

describe('RepeatParamsSerializer (default conventions)', () => {
  const s = new RepeatParamsSerializer();

  it('returns empty string for empty / nullish input', () => {
    expect(s.serialize(undefined)).toBe('');
    expect(s.serialize({})).toBe('');
  });

  it('skips null and undefined values', () => {
    expect(s.serialize({ a: null, b: undefined, c: 1 })).toBe('c=1');
  });

  it('repeats array values', () => {
    expect(s.serialize({ tags: ['a', 'b', 'c'] })).toBe('tags=a&tags=b&tags=c');
  });

  it('skips null/undefined inside arrays', () => {
    expect(s.serialize({ tags: ['a', null, undefined, 'b'] })).toBe('tags=a&tags=b');
  });

  it('URL-encodes keys and values', () => {
    expect(s.serialize({ 'q name': 'a&b c' })).toBe('q%20name=a%26b%20c');
  });

  it('flattens search.{key} via __contains suffix', () => {
    expect(s.serialize({ search: { name: 'foo' } })).toBe('name__contains=foo');
  });

  it('flattens filter.{key} as bare key (equality)', () => {
    expect(s.serialize({ filter: { status: 'active' } })).toBe('status=active');
  });

  it('remaps page/limit/sort to BE wire keys (page/pageSize/sort)', () => {
    expect(s.serialize({ page: 2, limit: 50, sort: 'name:asc' })).toBe(
      'page=2&pageSize=50&sort=name%3Aasc',
    );
  });

  it('passes through pre-flattened operator keys unchanged', () => {
    expect(s.serialize({ name__contains: 'foo', age__gte: 18 })).toBe(
      'name__contains=foo&age__gte=18',
    );
  });

  it('combines search + filter + pagination + extras', () => {
    const out = s.serialize({
      search: { name: 'foo' },
      filter: { status: 'active' },
      page: 1,
      limit: 20,
      tags: ['x', 'y'],
    });
    expect(out).toBe('name__contains=foo&status=active&page=1&pageSize=20&tags=x&tags=y');
  });
});

describe('RepeatParamsSerializer (custom conventions)', () => {
  it('honors a custom searchSuffix', () => {
    const s = new RepeatParamsSerializer({ searchSuffix: '_like' });
    expect(s.serialize({ search: { name: 'foo' } })).toBe('name_like=foo');
  });

  it('honors custom paginationKeys', () => {
    const s = new RepeatParamsSerializer({
      paginationKeys: { page: 'p', limit: 'size', sort: 'order' },
    });
    expect(s.serialize({ page: 3, limit: 10, sort: 'name:desc' })).toBe(
      'p=3&size=10&order=name%3Adesc',
    );
  });
});
