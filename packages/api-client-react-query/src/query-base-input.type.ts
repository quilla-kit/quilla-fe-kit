export type QueryBaseInput = {
  readonly search?: Record<string, unknown>;
  readonly filter?: Record<string, unknown>;
  readonly page?: number;
  readonly limit?: number;
  readonly sort?: string | readonly string[];
  readonly extra?: Record<string, unknown>;
};

export type QueryBaseTuning = {
  readonly debounceMs?: number;
  readonly minSearchLength?: number;
};

// The index signature is load-bearing: without it this is a TypeScript weak type
// (every member optional), so `initialPageParam: { cursor: 'x' }` would fail with
// "no properties in common". Consumer-named page params must stay first-class.
export type QueryBasePageParam = Pick<QueryBaseInput, 'page' | 'limit' | 'sort' | 'extra'> & {
  readonly [key: string]: unknown;
};
