import type { OCCToken } from '@quilla-fe-kit/api-client';

export type QueryBaseResult<T> = {
  readonly data: T;
  readonly version: OCCToken | null;
};
