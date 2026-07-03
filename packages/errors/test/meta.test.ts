import { describe, expect, it } from 'vitest';

import {
  DOCS_ERRORS_BASE,
  ERROR_CODE_META,
  NOMBAONE_ERROR_CODES,
  errorMetaFor,
  type NombaoneErrorCode,
} from '../src';

const ALL_CODES = Object.values(NOMBAONE_ERROR_CODES) as NombaoneErrorCode[];

describe('ERROR_CODE_META', () => {
  it('has exactly one entry per error code (exhaustive, no extras)', () => {
    const metaKeys = Object.keys(ERROR_CODE_META).sort();
    const codeKeys = [...ALL_CODES].sort();
    expect(metaKeys).toEqual(codeKeys);
  });

  it('gives every code a non-empty, specific hint', () => {
    for (const code of ALL_CODES) {
      const { hint } = ERROR_CODE_META[code];
      expect(hint.trim().length, `hint for ${code}`).toBeGreaterThan(20);
    }
  });

  it('points every code at its own anchor on the docs base', () => {
    for (const code of ALL_CODES) {
      expect(ERROR_CODE_META[code].docUrl).toBe(`${DOCS_ERRORS_BASE}#${code}`);
    }
  });
});

describe('errorMetaFor', () => {
  it('returns the entry for a known code', () => {
    const meta = errorMetaFor(NOMBAONE_ERROR_CODES.CUSTOMER_NOT_FOUND);
    expect(meta.hint.length).toBeGreaterThan(0);
    expect(meta.docUrl).toBe(`${DOCS_ERRORS_BASE}#CUSTOMER_NOT_FOUND`);
  });

  it('falls back to the internal-error meta for an unknown value', () => {
    const meta = errorMetaFor('NOT_A_REAL_CODE' as NombaoneErrorCode);
    expect(meta).toEqual(ERROR_CODE_META.SYSTEM_INTERNAL_ERROR);
  });
});
