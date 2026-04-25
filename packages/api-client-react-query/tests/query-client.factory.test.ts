import {
  ConflictError,
  ForbiddenError,
  NetworkError,
  UnauthorizedError,
  ValidationError,
} from '@quilla-fe-kit/errors';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '../src/query-client.factory.js';

const makeRetryFn = () => createQueryClient().getDefaultOptions().queries?.retry;

describe('createQueryClient retry policy', () => {
  it.each([
    [new UnauthorizedError({ message: 'x', httpStatus: 401, requestUrl: '/x' })],
    [new ForbiddenError({ message: 'x', httpStatus: 403, requestUrl: '/x' })],
    [new ConflictError({ message: 'x', httpStatus: 409, requestUrl: '/x' })],
    [new ValidationError({ message: 'x', httpStatus: 422, requestUrl: '/x' })],
  ])('does not retry on %s', (error) => {
    const retry = makeRetryFn();
    expect(typeof retry).toBe('function');
    expect((retry as (count: number, e: unknown) => boolean)(0, error)).toBe(false);
  });

  it('retries NetworkError up to networkMaxAttempts and then stops', () => {
    const qc = createQueryClient({ retry: { networkMaxAttempts: 2 } });
    const retry = qc.getDefaultOptions().queries?.retry as (
      count: number,
      e: unknown,
    ) => boolean;
    const e = new NetworkError({ message: 'down' });
    expect(retry(0, e)).toBe(true);
    expect(retry(1, e)).toBe(true);
    expect(retry(2, e)).toBe(false);
  });

  it('retries other errors up to maxAttempts', () => {
    const qc = createQueryClient({ retry: { maxAttempts: 3 } });
    const retry = qc.getDefaultOptions().queries?.retry as (
      count: number,
      e: unknown,
    ) => boolean;
    const e = new Error('flaky');
    expect(retry(0, e)).toBe(true);
    expect(retry(2, e)).toBe(true);
    expect(retry(3, e)).toBe(false);
  });

  it('mutations never retry', () => {
    const qc = createQueryClient();
    expect(qc.getDefaultOptions().mutations?.retry).toBe(false);
  });
});
