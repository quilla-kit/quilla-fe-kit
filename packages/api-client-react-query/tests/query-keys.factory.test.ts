import { describe, expect, it } from 'vitest';
import { createQueryKeys } from '../src/query-keys.factory.js';
import { resolveInvalidateKeys } from '../src/mutation.type.js';

describe('createQueryKeys', () => {
  const keys = createQueryKeys('users');

  describe('all()', () => {
    it('returns the domain as a 1-tuple', () => {
      expect(keys.all()).toEqual(['users']);
    });
  });

  describe('lists()', () => {
    it('returns [domain, "list"] as a 2-tuple', () => {
      expect(keys.lists()).toEqual(['users', 'list']);
    });
  });

  describe('list()', () => {
    it('returns a 3-tuple with undefined when called without params', () => {
      expect(keys.list()).toEqual(['users', 'list', undefined]);
    });

    it('returns a 3-tuple with the params object when provided', () => {
      const params = { status: 'active', page: 2 };
      expect(keys.list(params)).toEqual(['users', 'list', params]);
    });
  });

  describe('detail()', () => {
    it('returns [domain, "detail", id] for a numeric id', () => {
      expect(keys.detail(42)).toEqual(['users', 'detail', 42]);
    });

    it('returns [domain, "detail", id] for a string id', () => {
      expect(keys.detail('abc-123')).toEqual(['users', 'detail', 'abc-123']);
    });
  });

  it('produces distinct roots for different domains', () => {
    const orgKeys = createQueryKeys('organizations');
    expect(orgKeys.all()).toEqual(['organizations']);
    expect(orgKeys.detail(1)).not.toEqual(keys.detail(1));
  });

  it('all() is a prefix of lists()', () => {
    const [domain] = keys.all();
    const [listDomain] = keys.lists();
    expect(listDomain).toBe(domain);
  });

  it('lists() is a prefix of list()', () => {
    const [d1, seg1] = keys.lists();
    const [d2, seg2] = keys.list({ page: 1 });
    expect(d2).toBe(d1);
    expect(seg2).toBe(seg1);
  });
});

describe('resolveInvalidateKeys', () => {
  const keys = createQueryKeys('users');

  it('returns the array directly when given a static key array', () => {
    const targets = [keys.lists()];
    expect(resolveInvalidateKeys(targets, undefined, undefined)).toBe(targets);
  });

  it('calls the function and returns its result when given a resolver', () => {
    const fn = (vars: { id: number }, _data: unknown) => [keys.detail(vars.id)];
    expect(resolveInvalidateKeys(fn, { id: 7 }, null)).toEqual([['users', 'detail', 7]]);
  });

  it('passes both vars and data to the resolver', () => {
    const captured: unknown[] = [];
    resolveInvalidateKeys(
      (vars, data) => { captured.push(vars, data); return []; },
      'the-vars',
      'the-data',
    );
    expect(captured).toEqual(['the-vars', 'the-data']);
  });
});
