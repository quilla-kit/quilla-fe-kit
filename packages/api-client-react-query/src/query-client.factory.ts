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

export const createQueryClient = (config: CreateQueryClientConfig = {}): QueryClient => {
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

  return new QueryClient({
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
};
