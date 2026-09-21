// Appended by useInfiniteQueryBase so an infinite query and a useQueryBase list sharing
// a baseKey cannot collide on one cache entry with two incompatible shapes. Exported so
// consumers can build a matching key: [...keys.lists(), INFINITE_KEY_SEGMENT].
export const INFINITE_KEY_SEGMENT = 'infinite';

export type QueryKeyFactory = {
  all: () => readonly [string];
  lists: () => readonly [string, 'list'];
  list: (
    params?: Record<string, unknown>,
  ) => readonly [string, 'list', Record<string, unknown> | undefined];
  detail: (id: string | number) => readonly [string, 'detail', string | number];
};

export function createQueryKeys(domain: string): QueryKeyFactory {
  return {
    all: () => [domain],
    lists: () => [domain, 'list'],
    list: (params) => [domain, 'list', params],
    detail: (id) => [domain, 'detail', id],
  };
}
