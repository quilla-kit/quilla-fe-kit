import { OCC_HEADER } from '@quilla-fe-kit/api-client';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildOCCHeaders } from '../src/occ.helper.js';
import { createQueryClient, resetQueryClient } from '../src/query-client.factory.js';

beforeEach(() => {
  resetQueryClient();
});

describe('buildOCCHeaders', () => {
  it('returns undefined when no resolver is provided', () => {
    createQueryClient();
    expect(buildOCCHeaders(undefined, { id: 1 })).toBeUndefined();
  });

  it('reads version from a QueryBaseResult-shaped cache entry and emits If-Match', () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(['users', 1], { data: { id: 1 }, version: 7 });
    const headers = buildOCCHeaders({ versionKey: (v: { id: number }) => ['users', v.id] }, {
      id: 1,
    });
    expect(headers).toEqual({ [OCC_HEADER]: '"7"' });
  });

  it('throws a clear error on cache miss', () => {
    createQueryClient();
    expect(() =>
      buildOCCHeaders({ versionKey: (v: { id: number }) => ['users', v.id] }, { id: 99 }),
    ).toThrow(/OCC.*Could not resolve version/);
  });

  it('honors a custom extractVersion', () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(['users', 1], { meta: { rev: 12 } });
    const headers = buildOCCHeaders(
      {
        versionKey: (v: { id: number }) => ['users', v.id],
        extractVersion: (cached) => (cached as { meta?: { rev?: number } })?.meta?.rev ?? null,
      },
      { id: 1 },
    );
    expect(headers).toEqual({ [OCC_HEADER]: '"12"' });
  });
});
