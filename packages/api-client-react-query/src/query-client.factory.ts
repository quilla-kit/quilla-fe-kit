import {
  BadRequestError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@quilla-fe-kit/errors';
import {
  type Mutation,
  MutationCache,
  type Query,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { createQueryInvalidator, type QueryInvalidator } from './query-invalidator.factory.js';

const NON_RETRYABLE = [
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BadRequestError,
  BusinessRuleError,
  ValidationError,
  ConflictError,
] as const;

const isNonRetryable = (error: unknown): boolean =>
  NON_RETRYABLE.some((Cls) => error instanceof Cls);

type AnyQuery = Query<unknown, unknown, unknown, readonly unknown[]>;
type AnyMutation = Mutation<unknown, unknown, unknown, unknown>;

export type QueryEventHandler = (error: Error, query: AnyQuery) => void;
export type QuerySuccessHandler = (data: unknown, query: AnyQuery) => void;
export type MutationEventHandler = (error: Error, mutation: AnyMutation) => void;
export type MutationSuccessHandler = (data: unknown, mutation: AnyMutation) => void;

export type CreateQueryClientConfig = {
  readonly onQueryError?: QueryEventHandler;
  readonly onQuerySuccess?: QuerySuccessHandler;
  readonly onMutationError?: MutationEventHandler;
  readonly onMutationSuccess?: MutationSuccessHandler;
  readonly retry?: {
    readonly maxAttempts?: number;
    readonly networkMaxAttempts?: number;
  };
};

type Instance = {
  readonly queryClient: QueryClient;
  readonly queryInvalidator: QueryInvalidator;
};

let _instance: Instance | null = null;

function getInstance(caller: string): Instance {
  if (_instance === null) {
    throw new Error(
      `[quilla-fe-kit] ${caller} called before createQueryClient. ` +
        `Call createQueryClient once in your api layer before using ${caller}.`,
    );
  }
  return _instance;
}

export const createQueryClient = (config: CreateQueryClientConfig = {}): QueryClient => {
  if (typeof window === 'undefined') {
    throw new Error(
      '[quilla-fe-kit] createQueryClient is CSR/SPA only. ' +
        'In SSR environments, construct QueryClient per request directly.',
    );
  }
  if (_instance !== null) {
    throw new Error(
      '[quilla-fe-kit] createQueryClient was already called. ' +
        'Call resetQueryClient() between test runs to obtain a fresh instance.',
    );
  }

  const maxAttempts = config.retry?.maxAttempts ?? 2;
  const networkMaxAttempts = config.retry?.networkMaxAttempts ?? 1;

  const queryCache = new QueryCache({
    ...(config.onQueryError ? { onError: config.onQueryError } : {}),
    ...(config.onQuerySuccess ? { onSuccess: config.onQuerySuccess } : {}),
  });

  const mutationCache = new MutationCache({
    ...(config.onMutationError
      ? {
          onError: (error, _vars, _ctx, mutation) => config.onMutationError?.(error, mutation),
        }
      : {}),
    ...(config.onMutationSuccess
      ? {
          onSuccess: (data, _vars, _ctx, mutation) =>
            config.onMutationSuccess?.(data, mutation),
        }
      : {}),
  });

  const queryClient = new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (isNonRetryable(error)) return false;
          if (error instanceof NetworkError) return failureCount < networkMaxAttempts;
          return failureCount < maxAttempts;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      },
      mutations: {
        retry: false,
      },
    },
  });

  _instance = { queryClient, queryInvalidator: createQueryInvalidator(queryClient) };
  return queryClient;
};

export const getQueryClient = (): QueryClient => getInstance('getQueryClient').queryClient;

export const getQueryInvalidator = (): QueryInvalidator => getInstance('getQueryInvalidator').queryInvalidator;

export const queryInvalidator: QueryInvalidator = {
  invalidate: async (keys) => getQueryInvalidator().invalidate(keys),
  clear: () => getQueryInvalidator().clear(),
};

export const resetQueryClient = (): void => {
  _instance?.queryClient.clear();
  _instance = null;
};
