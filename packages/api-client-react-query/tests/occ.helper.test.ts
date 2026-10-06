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
    const headers = buildOCCHeaders(
      { versionKey: (v: { id: number }) => ['users', v.id] },
      {
        id: 1,
      },
    );
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

describe('buildOCCHeaders — useQueryBase key fallback', () => {
  const byId = { versionKey: (v: { id: number }) => ['users', v.id] };

  it('falls back to [...key, {}] when nothing is cached at the exact key', () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(['users', 1, {}], { data: { id: 1 }, version: 9 });
    expect(buildOCCHeaders(byId, { id: 1 })).toEqual({ [OCC_HEADER]: '"9"' });
  });

  it('prefers the exact key when both entries exist', () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(['users', 1], { data: { id: 1 }, version: 7 });
    queryClient.setQueryData(['users', 1, {}], { data: { id: 1 }, version: 9 });
    expect(buildOCCHeaders(byId, { id: 1 })).toEqual({ [OCC_HEADER]: '"7"' });
  });

  it('resolves a versionKey that already returns the full read key', () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(['users', 1, {}], { data: { id: 1 }, version: 9 });
    const headers = buildOCCHeaders(
      { versionKey: (v: { id: number }) => ['users', v.id, {}] },
      { id: 1 },
    );
    expect(headers).toEqual({ [OCC_HEADER]: '"9"' });
  });

  it('does not fall back when the exact key holds data without a version', () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(['users', 1], { data: { id: 1 }, version: null });
    queryClient.setQueryData(['users', 1, {}], { data: { id: 1 }, version: 9 });
    expect(() => buildOCCHeaders(byId, { id: 1 })).toThrow(/Could not resolve version/);
  });

  it('falls back when the exact key has an entry but no data yet', () => {
    const queryClient = createQueryClient();
    queryClient.getQueryCache().build(queryClient, { queryKey: ['users', 1] });
    queryClient.setQueryData(['users', 1, {}], { data: { id: 1 }, version: 9 });
    expect(buildOCCHeaders(byId, { id: 1 })).toEqual({ [OCC_HEADER]: '"9"' });
  });

  it('never falls back when a custom extractVersion is supplied', () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(['users', 1, {}], { data: { id: 1 }, version: 9 });
    let message = '';
    try {
      buildOCCHeaders(
        { ...byId, extractVersion: (cached) => (cached as { rev?: number })?.rev ?? null },
        { id: 1 },
      );
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/Could not resolve version/);
    expect(message).not.toMatch(/also tried/);
  });

  it('names both keys when neither resolves', () => {
    createQueryClient();
    expect(() => buildOCCHeaders(byId, { id: 99 })).toThrow(
      '[OCC] Could not resolve version from cache for key ["users", 99] (also tried ["users", 99, {}]).',
    );
  });
});
