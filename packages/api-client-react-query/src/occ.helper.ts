import {
  formatOCCHeaderValue,
  type HttpHeaders,
  OCC_HEADER,
  type OCCToken,
} from '@quilla-fe-kit/api-client';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { QueryBaseResult } from './query-base-result.type.js';

export type VersionResolver<TVars> = {
  readonly versionKey: (vars: TVars) => QueryKey;
  readonly extractVersion?: (cached: unknown) => OCCToken | null;
};

const defaultExtractVersion = (cached: unknown): OCCToken | null => {
  if (!cached || typeof cached !== 'object') return null;
  const candidate = cached as Partial<QueryBaseResult<unknown>>;
  return candidate.version ?? null;
};

export const buildOCCHeaders = <TVars>(
  queryClient: QueryClient,
  resolver: VersionResolver<TVars> | undefined,
  vars: TVars,
): HttpHeaders | undefined => {
  if (!resolver) return undefined;
  const key = resolver.versionKey(vars);
  const cached = queryClient.getQueryData(key);
  const extract = resolver.extractVersion ?? defaultExtractVersion;
  const version = extract(cached);
  if (version === null || version === undefined) {
    throw new Error(
      `[OCC] Could not resolve version from cache for key [${(key as unknown[])
        .map((p) => JSON.stringify(p))
        .join(', ')}]. Ensure the query is loaded before mutating, or provide extractVersion.`,
    );
  }
  return { [OCC_HEADER]: formatOCCHeaderValue(version) };
};
