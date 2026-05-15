import type { HttpHeaders } from '@quilla-fe-kit/api-client';

export type IdAndBody<TBody> = {
  readonly id: string | number;
  readonly body?: TBody;
};

export const mergeMutationHeaders = (
  headers: HttpHeaders | undefined,
  occHeaders: HttpHeaders | undefined,
): HttpHeaders | undefined => {
  if (!headers && !occHeaders) return undefined;
  return { ...(headers ?? {}), ...(occHeaders ?? {}) };
};
