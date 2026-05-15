import { OCC_HEADER } from '@quilla-fe-kit/api-client';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { buildOCCHeaders } from '../src/occ.helper.js';

const newQC = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

describe('buildOCCHeaders', () => {
  it('returns undefined when no resolver is provided', () => {
    const qc = newQC();
    expect(buildOCCHeaders(qc, undefined, { id: 1 })).toBeUndefined();
  });

  it('reads version from a QueryBaseResult-shaped cache entry and emits If-Match', () => {
    const qc = newQC();
    qc.setQueryData(['users', 1], { data: { id: 1 }, version: 7 });
    const headers = buildOCCHeaders(qc, { versionKey: (v: { id: number }) => ['users', v.id] }, {
      id: 1,
    });
    expect(headers).toEqual({ [OCC_HEADER]: '"7"' });
  });

  it('throws a clear error on cache miss', () => {
    const qc = newQC();
    expect(() =>
      buildOCCHeaders(qc, { versionKey: (v: { id: number }) => ['users', v.id] }, { id: 99 }),
    ).toThrow(/OCC.*Could not resolve version/);
  });

  it('honors a custom extractVersion', () => {
    const qc = newQC();
    qc.setQueryData(['users', 1], { meta: { rev: 12 } });
    const headers = buildOCCHeaders(
      qc,
      {
        versionKey: (v: { id: number }) => ['users', v.id],
        extractVersion: (cached) => (cached as { meta?: { rev?: number } })?.meta?.rev ?? null,
      },
      { id: 1 },
    );
    expect(headers).toEqual({ [OCC_HEADER]: '"12"' });
  });
});
