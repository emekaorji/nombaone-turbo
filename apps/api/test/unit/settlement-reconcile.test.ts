import { describe, expect, it } from 'vitest';

import { reconcileSettlements } from '@/domain/settlement';
import { diffAgainstNomba } from '@/domain/reconciliation';
import { withTenantLog } from '@/domain/observability';

describe('settlement/reconcile — J7 ★ settlement-leg diff', () => {
  it('matches by merchant_tx_ref and surfaces orphans / missing / drift', () => {
    const local = [
      { merchantTxRef: 'nbo1inv', grossInKobo: 100000 },
      { merchantTxRef: 'nbo2inv', grossInKobo: 50000 },
      { merchantTxRef: 'nbo3inv', grossInKobo: 30000 }, // no Nomba match → missingOnNomba
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

describe('reconciliation/nomba — J7 ★ charge-leg diff (O partial-failure)', () => {
  it('classifies settled-at-Nomba-missing-locally / local-missing / amount mismatch', () => {
    const local = [
      { reference: 'nboAinv', amountKobo: 100000 }, // matched
      { reference: 'nboBinv', amountKobo: 50000 }, // amount mismatch
      { reference: 'nboCinv', amountKobo: 30000 }, // local, not at Nomba
    ];
    const nomba = [
      { reference: 'nboAinv', amountKobo: 100000 },
      { reference: 'nboBinv', amountKobo: 49999 },
      { reference: 'nboDinv', amountKobo: 7000 }, // at Nomba, not local → self-heal candidate
    ];
    const d = diffAgainstNomba(local, nomba);
    expect(d.find((x) => x.class === 'amount_mismatch')?.reference).toBe('nboBinv');
    expect(d.find((x) => x.class === 'local_paid_missing_at_nomba')?.reference).toBe('nboCinv');
    expect(d.find((x) => x.class === 'settled_at_nomba_missing_locally')?.reference).toBe('nboDinv');
    expect(d).toHaveLength(3); // A matched → no discrepancy
  });
});

describe('observability/tenant-log — H8 / M1 field bag', () => {
  it('binds organizationId + environment + correlationId (no PII)', () => {
    expect(withTenantLog({ organizationId: 'org_1', mode: 'sandbox' }, 'req_9')).toEqual({
      organizationId: 'org_1',
      mode: 'sandbox',
      correlationId: 'req_9',
    });
  });
});
