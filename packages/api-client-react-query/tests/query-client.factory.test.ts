import {
  ConflictError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  QuerySerializationError,
  UnauthorizedError,
  ValidationError,
} from '@quilla-fe-kit/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type QueryDefaults,
  createQueryClient,
  getQueryClient,
  getQueryInvalidator,
  queryInvalidator,
  resetQueryClient,
} from '../src/query-client.factory.js';

beforeEach(() => {
  resetQueryClient();
});

const makeRetryFn = () => createQueryClient().getDefaultOptions().queries?.retry;

describe('createQueryClient singleton guard', () => {
  it('throws when called a second time', () => {
    createQueryClient();
    expect(() => createQueryClient()).toThrowError(
      '[quilla-fe-kit] createQueryClient was already called.',
    );
  });

  it('allows a fresh call after resetQueryClient', () => {
    createQueryClient();
    resetQueryClient();
    expect(() => createQueryClient()).not.toThrow();
  });
});

describe('getQueryClient', () => {
  it('throws when called before createQueryClient', () => {
    expect(() => getQueryClient()).toThrowError(
      '[quilla-fe-kit] getQueryClient called before createQueryClient.',
    );
  });

  it('returns the same QueryClient as the createQueryClient return value', () => {
    const returned = createQueryClient();
    expect(getQueryClient()).toBe(returned);
  });
});

describe('getQueryInvalidator', () => {
  it('throws when called before createQueryClient', () => {
    expect(() => getQueryInvalidator()).toThrowError(
      '[quilla-fe-kit] getQueryInvalidator called before createQueryClient.',
    );
  });

  it('returns the invalidator after createQueryClient', () => {
    createQueryClient();
    expect(getQueryInvalidator()).toBeDefined();
  });

  it('returns the same instance on repeated calls', () => {
    createQueryClient();
    expect(getQueryInvalidator()).toBe(getQueryInvalidator());
  });
});

describe('queryInvalidator proxy', () => {
  it('delegates invalidate to the singleton at call time', async () => {
    const qc = createQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined);

    await queryInvalidator.invalidate([['users']]);

    expect(spy).toHaveBeenCalledWith({ queryKey: ['users'] });
  });

  it('delegates clear to the singleton at call time', () => {
    const qc = createQueryClient();
    const spy = vi.spyOn(qc, 'clear');

    queryInvalidator.clear();

    expect(spy).toHaveBeenCalledOnce();
  });

  it('throws when invalidate is called before createQueryClient', async () => {
    await expect(queryInvalidator.invalidate([['users']])).rejects.toThrowError(
      '[quilla-fe-kit] getQueryInvalidator called before createQueryClient.',
    );
  });
});

describe('createQueryClient retry policy', () => {
  it.each([
    [new UnauthorizedError({ message: 'x', httpStatus: 401, requestUrl: '/x' })],
    [new ForbiddenError({ message: 'x', httpStatus: 403, requestUrl: '/x' })],
    [new ConflictError({ message: 'x', httpStatus: 409, requestUrl: '/x' })],
    [new ValidationError({ message: 'x', httpStatus: 422, requestUrl: '/x' })],
    [new QuerySerializationError({ message: 'nested param' })],
  ])('does not retry on %s', (error) => {
    const retry = makeRetryFn();
    expect(typeof retry).toBe('function');
    expect((retry as (count: number, e: unknown) => boolean)(0, error)).toBe(false);
  });

  it('retries NetworkError up to networkMaxAttempts and then stops', () => {
    const queryClient = createQueryClient({ retry: { networkMaxAttempts: 2 } });
    const retry = queryClient.getDefaultOptions().queries?.retry as (
      count: number,
      e: unknown,
    ) => boolean;
    const e = new NetworkError({ message: 'down' });
    expect(retry(0, e)).toBe(true);
    expect(retry(1, e)).toBe(true);
    expect(retry(2, e)).toBe(false);
  });

  it('retries other errors up to maxAttempts', () => {
    const queryClient = createQueryClient({ retry: { maxAttempts: 3 } });
    const retry = queryClient.getDefaultOptions().queries?.retry as (
      count: number,
      e: unknown,
    ) => boolean;
    const e = new Error('flaky');
    expect(retry(0, e)).toBe(true);
    expect(retry(2, e)).toBe(true);
    expect(retry(3, e)).toBe(false);
  });

  it('mutations never retry', () => {
    const queryClient = createQueryClient();
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false);
  });
});

describe('createQueryClient queryDefaults', () => {
  const notFound = new NotFoundError({ message: 'x', httpStatus: 404, requestUrl: '/x' });

  it('leaves TanStack defaults untouched when omitted', () => {
    const queries = createQueryClient().getDefaultOptions().queries;
    expect(queries).not.toHaveProperty('staleTime');
    expect(queries).not.toHaveProperty('gcTime');
    expect(queries).not.toHaveProperty('refetchOnWindowFocus');
  });

  it('applies every provided default', () => {
    const queryDefaults: QueryDefaults = {
      staleTime: 30_000,
      gcTime: 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: 'always',
      networkMode: 'always',
    };
    const queries = createQueryClient({ queryDefaults }).getDefaultOptions().queries;
    expect(queries).toMatchObject(queryDefaults);
  });

  it('keeps the kit retry policy alongside the defaults', () => {
    const queryClient = createQueryClient({
      queryDefaults: { staleTime: Number.POSITIVE_INFINITY },
    });
    const { queries, mutations } = queryClient.getDefaultOptions();
    const retry = queries?.retry as (count: number, e: unknown) => boolean;
    expect(retry(0, notFound)).toBe(false);
    expect(mutations?.retry).toBe(false);
  });

  it('does not let a smuggled retry override the kit policy', () => {
    const queryClient = createQueryClient({
      queryDefaults: { retry: 5 } as unknown as QueryDefaults,
    });
    const retry = queryClient.getDefaultOptions().queries?.retry;
    expect(typeof retry).toBe('function');
    expect((retry as (count: number, e: unknown) => boolean)(0, notFound)).toBe(false);
  });
});
