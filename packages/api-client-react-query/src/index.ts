export {
  HttpClientProvider,
  useHttpClient,
  type HttpClientProviderProps,
} from './http-client.provider.js';
export {
  createQueryClient,
  type CreateQueryClientConfig,
  type QueryEventHandler,
  type QuerySuccessHandler,
  type MutationEventHandler,
  type MutationSuccessHandler,
} from './query-client.factory.js';

export type { QueryBaseResult } from './query-base-result.type.js';
export {
  useQueryBase,
  type QueryBaseInput,
  type QueryBaseTuning,
  type UseQueryBaseOptions,
} from './use-query-base.hook.js';
export { useDebouncedValue } from './use-debounced-value.hook.js';

export { buildOCCHeaders, type VersionResolver } from './occ.helper.js';
export type { IdAndBody } from './mutation.type.js';
export {
  usePostMutationBase,
  type UsePostMutationOptions,
} from './use-post-mutation.hook.js';
export {
  usePutMutationBase,
  type UsePutMutationOptions,
} from './use-put-mutation.hook.js';
export {
  usePatchMutationBase,
  type UsePatchMutationOptions,
} from './use-patch-mutation.hook.js';
export {
  useDeleteMutationBase,
  type UseDeleteMutationOptions,
} from './use-delete-mutation.hook.js';
