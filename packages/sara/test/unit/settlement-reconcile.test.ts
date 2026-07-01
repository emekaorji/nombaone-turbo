import { describe, expect, it } from 'vitest';

import { reconcileSettlements } from '@nombaone/sara/settlement';
import { withTenantLog } from '@nombaone/sara/observability';

describe('settlement/reconcile — J7 ★ settlement-leg diff', () => {
  it('matches by merchant_tx_ref and surfaces orphans / missing / drift', () => {
    const local = [
      { merchantTxRef: 'nbo1inv', grossKobo: 100000 },
      { merchantTxRef: 'nbo2inv', grossKobo: 50000 },
      { merchantTxRef: 'nbo3inv', grossKobo: 30000 }, // no Nomba match → missingOnNomba
    ];
    const nomba = [
      { merchantTxRef: 'nbo1inv', amountKobo: 100000 }, // matched
      { merchantTxRef: 'nbo2inv', amountKobo: 49999 }, // drift
      { merchantTxRef: 'nbo9inv', amountKobo: 7000 }, // orphan on Nomba
    ];
    const r = reconcileSettlements(local, nomba);
    expect(r.matched).toBe(1);
    expect(r.amountDrift).toEqual([{ merchantTxRef: 'nbo2inv', localKobo: 50000, nombaKobo: 49999 }]);
    expect(r.missingOnNomba).toEqual(['nbo3inv']);
    expect(r.orphansOnNomba).toEqual(['nbo9inv']);
  });
});

describe('observability/tenant-log — H8 / M1 field bag', () => {
  it('binds organizationId + environment + correlationId (no PII)', () => {
    expect(withTenantLog({ organizationId: 'org_1', environment: 'test' }, 'req_9')).toEqual({
      organizationId: 'org_1',
      environment: 'test',
      correlationId: 'req_9',
    });
  });
});
