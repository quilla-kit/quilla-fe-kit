import type { OCCToken, PaginationResponse } from '@quilla-fe-kit/api-client';

export type QueryBaseResult<T> = {
  readonly data: T;
  readonly version: OCCToken | null;
  readonly pagination?: PaginationResponse<unknown>['pagination'];
};
