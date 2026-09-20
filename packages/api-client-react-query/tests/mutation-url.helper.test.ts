import { describe, expect, it } from 'vitest';
import { resolveMutationUrl } from '../src/mutation-url.helper.js';

describe('resolveMutationUrl', () => {
  it.each([
    ['appends an id from an object variable', '/users', { id: 5 }, '/users/5'],
    ['appends a primitive variable', '/users', 'abc', '/users/abc'],
    ['accepts an id of 0', '/users', { id: 0 }, '/users/0'],
    ['collapses a trailing slash on the base path', '/users/', { id: 5 }, '/users/5'],
    ['substitutes :id anywhere in the path', '/orgs/:id/seats', { id: 'acme' }, '/orgs/acme/seats'],
    [
      'substitutes free-form placeholders from the variables themselves',
      '/orgs/:orgId/seats/:seatId',
      { orgId: 'acme', seatId: 9 },
      '/orgs/acme/seats/9',
    ],
    [
      'substitutes a free-form placeholder from params',
      '/claims/:claimId/settle',
      { id: 42, params: { claimId: 42 } },
      '/claims/42/settle',
    ],
    [
      'lets params win over a same-named variable field',
      '/users/:id',
      { id: 1, params: { id: 2 } },
      '/users/2',
    ],
    [
      'does not confuse :id with a placeholder sharing its prefix',
      '/users/:idNumber',
      { idNumber: 7, id: 1 },
      '/users/7',
    ],
    [
      'leaves the port of an absolute base path alone',
      'http://localhost:8080/users/:id',
      { id: 5 },
      'http://localhost:8080/users/5',
    ],
    ['percent-encodes a path separator in an appended id', '/users', { id: 'a/b' }, '/users/a%2Fb'],
    ['percent-encodes a space in an appended id', '/users', { id: 'a b' }, '/users/a%20b'],
    ['percent-encodes a percent sign in an appended id', '/users', { id: '100%' }, '/users/100%25'],
    [
      'percent-encodes a substituted placeholder',
      '/orgs/:orgId/seats',
      { orgId: 'a/b' },
      '/orgs/a%2Fb/seats',
    ],
  ])('%s', (_name, basePath, vars, expected) => {
    expect(resolveMutationUrl(basePath, vars)).toBe(expected);
  });

  it.each([
    ['an unresolved placeholder', '/claims/:claimId/settle', { id: 42 }, /':claimId'/],
    ['an empty placeholder value', '/orgs/:orgId/x', { orgId: '' }, /':orgId'/],
    ['a null placeholder value', '/orgs/:orgId/x', { orgId: null }, /':orgId'/],
    ['a non-scalar placeholder value', '/users/:id', { id: { nested: true } }, /non-scalar/],
    ['an object variable with no usable id', '/users', { name: 'Ada' }, /no 'id'/],
    ['an undefined id', '/users', { id: undefined }, /no 'id'/],
    ['an empty-string id', '/users', { id: '' }, /no 'id'/],
  ])('throws on %s', (_name, basePath, vars, expected) => {
    expect(() => resolveMutationUrl(basePath, vars)).toThrow(expected);
  });
});
