import type { AuthSession } from '@quilla-fe-kit/api-client';

export type Principal = AuthSession & {
  readonly scopes: readonly string[];
};
