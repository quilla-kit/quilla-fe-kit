export type QueryTransformResult<TData = unknown> = {
  readonly data: TData;
};

export type QueryTransformer<TData = unknown> = (raw: unknown) => QueryTransformResult<TData>;

export type MutationTransformer = (raw: unknown) => unknown;

export type HooksConfig = {
  readonly queryTransformer?: QueryTransformer;
  readonly mutationTransformer?: MutationTransformer;
};
