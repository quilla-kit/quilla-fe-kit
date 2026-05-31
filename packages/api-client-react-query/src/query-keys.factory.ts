export type QueryKeyFactory = {
  all: () => readonly [string];
  lists: () => readonly [string, 'list'];
  list: (params?: Record<string, unknown>) => readonly [string, 'list', Record<string, unknown> | undefined];
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
