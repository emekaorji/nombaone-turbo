import { describe, expect, it } from 'vitest';

import { mintReference } from '@nombaone/sara/reference';

/**
 * Canonical reference format: `nbo` + 12 random digits + lowercase domain code.
 */
describe('reference.mintReference', () => {
  it('produces nbo + 12 digits + lowercased domain', () => {
    const ref = mintReference('ORG');
    expect(ref).toMatch(/^nbo\d{12}org$/);
  });

  it('lowercases the domain suffix for every domain', () => {
    expect(mintReference('USR')).toMatch(/^nbo\d{12}usr$/);
    expect(mintReference('LTX')).toMatch(/^nbo\d{12}ltx$/);
    expect(mintReference('WHK')).toMatch(/^nbo\d{12}whk$/);
  });

  it('mints distinct references across calls', () => {
    const refs = new Set(Array.from({ length: 50 }, () => mintReference('EXA')));
    // Collisions across 50 12-digit draws are astronomically unlikely.
    expect(refs.size).toBe(50);
  });
});
