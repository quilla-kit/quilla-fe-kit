export type PaginationRequest = {
  readonly page?: number;
  readonly limit?: number;
  readonly sort?: string;
  readonly filter?: Record<string, unknown>;
};

export type PaginationResponse<T> = {
  readonly data: readonly T[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
  };
};
