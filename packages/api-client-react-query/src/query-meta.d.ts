import '@tanstack/react-query';

type SharedMeta = {
  showSuccess?: boolean;
  showWarning?: boolean;
  customSuccessMessage?: string;
  customErrorMessage?: string;
};

type QuillaMutationMeta = SharedMeta & {
  showError?: boolean;
};

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: SharedMeta;
    mutationMeta: QuillaMutationMeta;
  }
}
