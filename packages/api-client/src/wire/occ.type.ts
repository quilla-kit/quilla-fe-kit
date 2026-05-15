export const OCC_HEADER = 'If-Match';
export const ETAG_HEADER = 'ETag';

export type OCCToken = number;

export const formatOCCHeaderValue = (version: OCCToken): string => `"${version}"`;

export const parseETagHeaderValue = (value: string | null | undefined): OCCToken | null => {
  if (value === null || value === undefined) return null;
  const stripped = value.trim().replace(/^W\//, '').replace(/^"(.*)"$/, '$1');
  if (stripped.length === 0) return null;
  const parsed = Number(stripped);
  return Number.isFinite(parsed) ? parsed : null;
};
