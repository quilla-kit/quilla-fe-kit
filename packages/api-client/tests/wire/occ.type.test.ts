import { describe, expect, it } from 'vitest';
import {
  ETAG_HEADER,
  formatOCCHeaderValue,
  OCC_HEADER,
  parseETagHeaderValue,
} from '../../src/wire/occ.type.js';

describe('OCC wire helpers', () => {
  it('exposes the canonical RFC 7232 header names', () => {
    expect(OCC_HEADER).toBe('If-Match');
    expect(ETAG_HEADER).toBe('ETag');
  });

  it('formatOCCHeaderValue wraps numeric version in RFC-quoted form', () => {
    expect(formatOCCHeaderValue(0)).toBe('"0"');
    expect(formatOCCHeaderValue(42)).toBe('"42"');
  });

  it.each([
    ['"5"', 5],
    ['5', 5],
    ['W/"5"', 5],
    [' "12" ', 12],
  ])('parseETagHeaderValue extracts %s as %i', (input, expected) => {
    expect(parseETagHeaderValue(input)).toBe(expected);
  });

  it.each([null, undefined, '', '""', 'not-a-number', '"abc"'])(
    'parseETagHeaderValue returns null for %p',
    (input) => {
      expect(parseETagHeaderValue(input)).toBeNull();
    },
  );
});
