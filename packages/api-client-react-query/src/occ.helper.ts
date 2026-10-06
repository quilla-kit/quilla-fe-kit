import {
  formatOCCHeaderValue,
  type HttpHeaders,
  OCC_HEADER,
  type OCCToken,
} from '@quilla-fe-kit/api-client';
import type { QueryKey } from '@tanstack/react-query';
import { getQueryClient } from './query-client.factory.js';
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

const formatKey = (key: QueryKey): string =>
  `[${(key as readonly unknown[]).map((p) => JSON.stringify(p)).join(', ')}]`;

export const buildOCCHeaders = <TVars>(
  resolver: VersionResolver<TVars> | undefined,
  vars: TVars,
): HttpHeaders | undefined => {
  if (!resolver) return undefined;
  const queryClient = getQueryClient();
  const key = resolver.versionKey(vars);
  let cached = queryClient.getQueryData(key);
  // useQueryBase caches at [...baseKey, params], with params = {} for a read without query
  // options, so a versionKey returning the bare baseKey resolves through this single key.
  const fallbackKey = cached === undefined && !resolver.extractVersion ? [...key, {}] : undefined;
  if (fallbackKey) cached = queryClient.getQueryData(fallbackKey);
  const extract = resolver.extractVersion ?? defaultExtractVersion;
  const version = extract(cached);
  if (version === null || version === undefined) {
    const alsoTried = fallbackKey ? ` (also tried ${formatKey(fallbackKey)})` : '';
    const hint = 'Ensure the query is loaded before mutating, or provide extractVersion.';
    throw new Error(
      `[OCC] Could not resolve version from cache for key ${formatKey(key)}${alsoTried}. ${hint}`,
    );
  }
  return { [OCC_HEADER]: formatOCCHeaderValue(version) };
};
