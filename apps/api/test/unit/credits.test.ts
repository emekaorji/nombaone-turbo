import { describe, expect, it } from 'vitest';

import { consumeGrants } from '@shared/services/credits';

const grants = (remainings: number[]): Array<{ id: string; reference: string; remaining: number }> =>
  remainings.map((remaining, i) => ({ id: `g${i}`, reference: `crg${i}`, remaining }));

describe('credits/consumeGrants — oldest-first (C8 ★)', () => {
  it('consumes grants in array (oldest-first) order until covered', () => {
    const c = consumeGrants(grants([300, 500, 200]), 600);
    expect(c.map((x) => x.grantId)).toEqual(['g0', 'g1']);
    expect(c.map((x) => x.applied)).toEqual([300, 300]); // g0 fully, g1 partial
  });
  it('stops at amountDue, leaving later grants untouched', () => {
    expect(consumeGrants(grants([1000]), 400)).toEqual([
      { grantId: 'g0', grantReference: 'crg0', applied: 400 },
    ]);
  });
  it('exhausts all grants when amountDue exceeds total credit', () => {
    const c = consumeGrants(grants([100, 200]), 1000);
    expect(c.reduce((s, x) => s + x.applied, 0)).toBe(300);
  });
  it('zero amountDue → no consumption', () => {
    expect(consumeGrants(grants([500]), 0)).toEqual([]);
  });
  it('skips zero-remaining grants', () => {
    expect(consumeGrants(grants([0, 500]), 300).map((x) => x.grantId)).toEqual(['g1']);
  });
});
