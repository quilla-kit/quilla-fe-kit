export { createHooks, type Hooks } from './hooks.factory.js';

export {
  createQueryClient,
  getQueryClient,
  getQueryInvalidator,
  queryInvalidator,
  resetQueryClient,
  type CreateQueryClientConfig,
  type QueryEventHandler,
  type QuerySuccessHandler,
  type MutationEventHandler,
  type MutationSuccessHandler,
} from './query-client.factory.js';

export { type QueryInvalidator } from './query-invalidator.factory.js';

export type { QueryBaseResult } from './query-base-result.type.js';
export {
  type QueryBaseInput,
  type QueryBaseTuning,
  type UseQueryBaseOptions,
} from './use-query-base.hook.js';
export { useDebouncedValue } from './use-debounced-value.hook.js';

export { buildOCCHeaders, type VersionResolver } from './occ.helper.js';
export type { IdAndBody, InvalidateKeys } from './mutation.type.js';
export { type UsePostMutationOptions } from './use-post-mutation.hook.js';
export { type UsePutMutationOptions } from './use-put-mutation.hook.js';
export { type UsePatchMutationOptions } from './use-patch-mutation.hook.js';
export { type UseDeleteMutationOptions } from './use-delete-mutation.hook.js';

export {
  createQueryKeys,
  type QueryKeyFactory,
} from './query-keys.factory.js';
