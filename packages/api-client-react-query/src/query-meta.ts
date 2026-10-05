import '@tanstack/react-query';

// biome-ignore lint/suspicious/noEmptyInterface: consumers add fields via declaration merging.
export interface QueryMetaExtensions {}
// biome-ignore lint/suspicious/noEmptyInterface: consumers add fields via declaration merging.
export interface MutationMetaExtensions {}

// Flattening keeps the result assignable to Record<string, unknown>; TanStack falls back to
// an untyped meta otherwise.
type Flatten<T> = { [K in keyof T]: T[K] };

export type SharedMeta = {
  showSuccess?: boolean;
  showWarning?: boolean;
  customSuccessMessage?: string;
  customErrorMessage?: string;
};

type QuillaQueryMeta = Flatten<SharedMeta & QueryMetaExtensions>;

export type QuillaMutationMeta = Flatten<
  SharedMeta & { showError?: boolean } & MutationMetaExtensions
>;

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: QuillaQueryMeta;
    mutationMeta: QuillaMutationMeta;
  }
}
