import type { SettlementResponseData } from '@nombaone/core-contracts/types';

/** A Nomba-side transaction as seen during reconciliation (foreign shape, minimal). */
export interface NombaTransaction {
  merchantTxRef: string;
  amountKobo: number;
}

export interface ReconcileResult {
  matched: number;
  orphansOnNomba: string[]; // merchantTxRefs on Nomba with no local settlement
  missingOnNomba: string[]; // local settlement refs with no Nomba transaction
  amountDrift: { merchantTxRef: string; localKobo: number; nombaKobo: number }[];
}

/**
 * PURE reconciliation diff (J7 ★, settlement-leg): match local settlements to Nomba
 * transactions by `merchant_tx_ref`, surfacing orphans (on Nomba, not local), missing
 * (local, not on Nomba), and amount drift (matched refs whose gross disagrees). The
 * charge/invoice facet of J7 is 09's `reconcileAgainstNomba`; this is the settlement
 * facet. The nightly cron feeds `selectSettlementsForReconcile` + a Nomba query in.
 */
export function reconcileSettlements(
  localSettlements: Pick<SettlementResponseData, 'merchantTxRef' | 'grossKobo'>[],
  nombaTransactions: NombaTransaction[]
): ReconcileResult {
  const byRefLocal = new Map(localSettlements.map((s) => [s.merchantTxRef, s]));
  const byRefNomba = new Map(nombaTransactions.map((t) => [t.merchantTxRef, t]));

  let matched = 0;
  const amountDrift: ReconcileResult['amountDrift'] = [];
  for (const local of localSettlements) {
    const nomba = byRefNomba.get(local.merchantTxRef);
    if (!nomba) continue;
    if (nomba.amountKobo === local.grossKobo) matched += 1;
    else amountDrift.push({ merchantTxRef: local.merchantTxRef, localKobo: local.grossKobo, nombaKobo: nomba.amountKobo });
  }

  const orphansOnNomba = nombaTransactions.filter((t) => !byRefLocal.has(t.merchantTxRef)).map((t) => t.merchantTxRef);
  const missingOnNomba = localSettlements.filter((s) => !byRefNomba.has(s.merchantTxRef)).map((s) => s.merchantTxRef);
  return { matched, orphansOnNomba, missingOnNomba, amountDrift };
}
