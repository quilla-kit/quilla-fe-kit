import '@tanstack/react-query';

export type SharedMeta = {
  showSuccess?: boolean;
  showWarning?: boolean;
  customSuccessMessage?: string;
  customErrorMessage?: string;
};

export type QuillaMutationMeta = SharedMeta & {
  showError?: boolean;
};

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: SharedMeta;
    mutationMeta: QuillaMutationMeta;
  }
}
