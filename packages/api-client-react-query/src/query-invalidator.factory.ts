import type { QueryClient, QueryKey } from '@tanstack/react-query';

export type QueryInvalidator = {
  readonly invalidate: (keys: QueryKey[]) => Promise<void>;
  readonly clear: () => void;
};

export function createQueryInvalidator(queryClient: QueryClient): QueryInvalidator {
  return {
    invalidate: async (keys) => {
      await Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: key })));
    },
    clear: () => queryClient.clear(),
  };
}
