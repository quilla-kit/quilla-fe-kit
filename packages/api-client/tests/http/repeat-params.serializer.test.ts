import { QuerySerializationError } from '@quilla-fe-kit/errors';
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

describe('RepeatParamsSerializer — nested objects', () => {
  const serializer = new RepeatParamsSerializer();

  it('throws for a top-level nested object instead of emitting [object Object]', () => {
    expect(() => serializer.serialize({ expand: { frameId: 'f1' } })).toThrow(
      QuerySerializationError,
    );
  });

  it('names the offending key path in the message and context', () => {
    let caught: unknown;
    try {
      serializer.serialize({ expand: { frameId: 'f1' } });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(QuerySerializationError);
    expect((caught as QuerySerializationError).message).toContain('"expand"');
    expect((caught as QuerySerializationError).context).toEqual({ keyPath: 'expand' });
  });

  it('throws for an object nested inside filter, with a dotted path', () => {
    let caught: unknown;
    try {
      serializer.serialize({ filter: { age: { gte: 18 } } });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(QuerySerializationError);
    expect((caught as QuerySerializationError).context).toEqual({ keyPath: 'filter.age' });
  });

  it('throws for an object nested inside search, with a dotted path', () => {
    let caught: unknown;
    try {
      serializer.serialize({ search: { name: { like: 'ada' } } });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(QuerySerializationError);
    expect((caught as QuerySerializationError).context).toEqual({ keyPath: 'search.name' });
  });

  it('throws for an object inside an array, with an indexed path', () => {
    let caught: unknown;
    try {
      serializer.serialize({ tags: ['a', { b: 1 }] });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(QuerySerializationError);
    expect((caught as QuerySerializationError).context).toEqual({ keyPath: 'tags[1]' });
  });

  it('leaves Date and other class instances alone', () => {
    const when = new Date('2026-09-22T00:00:00.000Z');
    expect(serializer.serialize({ when })).toBe(`when=${encodeURIComponent(String(when))}`);

    class Ref {
      toString() {
        return 'ref-1';
      }
    }
    expect(serializer.serialize({ ref: new Ref() })).toBe('ref=ref-1');
  });
});

describe('RepeatParamsSerializer — encodeValue seam', () => {
  class DottedSerializer extends RepeatParamsSerializer {
    protected override encodeValue(value: unknown, keyPath: string): string {
      if (this.isPlainObject(value)) {
        return Object.entries(value)
          .map(([k, v]) => `${k}:${String(v)}`)
          .join(',');
      }
      return super.encodeValue(value, keyPath);
    }
  }

  it('lets a subclass encode nested objects while inheriting every other convention', () => {
    const serializer = new DottedSerializer();

    expect(serializer.serialize({ expand: { frameId: 'f1' } })).toBe(
      `expand=${encodeURIComponent('frameId:f1')}`,
    );

    expect(
      serializer.serialize({
        search: { name: 'foo' },
        filter: { status: 'active' },
        page: 1,
        limit: 20,
        tags: ['x', 'y'],
      }),
    ).toBe('name__contains=foo&status=active&page=1&pageSize=20&tags=x&tags=y');
  });
});
