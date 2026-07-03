/** A locally-`paid` invoice as seen during the Nomba cross-check. */
export interface LocalPaidInvoice {
  reference: string; // our charge reference = Nomba merchantTxRef/orderReference
  amountKobo: number;
}

/** A Nomba transaction (foreign shape, minimal) matched on `reference`. */
export interface NombaChargeTransaction {
  reference: string;
  amountKobo: number;
}

export type DiscrepancyClass = 'settled_at_nomba_missing_locally' | 'local_paid_missing_at_nomba' | 'amount_mismatch';

export interface ReconciliationDiscrepancy {
  class: DiscrepancyClass;
  reference: string;
  localKobo: number | null;
  nombaKobo: number | null;
}

/**
 * PURE Nomba cross-check (J7 ★, charge/invoice facet — the settlement facet is 08's
 * `reconcileSettlements`). Joins locally-`paid` invoices to Nomba `/transactions`
 * on `reference` and classifies: (a) settled at Nomba but missing locally (a partial
 * failure that self-heals by re-driving the settle path — the charge reference makes
 * the re-drive a no-op if it already landed); (b) local-paid but missing at Nomba
 * (human review); (c) amount mismatch. The nightly cron feeds live rows in.
 */
export function diffAgainstNomba(
  localPaid: LocalPaidInvoice[],
  nombaTransactions: NombaChargeTransaction[]
): ReconciliationDiscrepancy[] {
  const local = new Map(localPaid.map((i) => [i.reference, i]));
  const nomba = new Map(nombaTransactions.map((t) => [t.reference, t]));
  const out: ReconciliationDiscrepancy[] = [];

  for (const l of localPaid) {
    const n = nomba.get(l.reference);
    if (!n) out.push({ class: 'local_paid_missing_at_nomba', reference: l.reference, localKobo: l.amountKobo, nombaKobo: null });
    else if (n.amountKobo !== l.amountKobo) out.push({ class: 'amount_mismatch', reference: l.reference, localKobo: l.amountKobo, nombaKobo: n.amountKobo });
  }
  for (const n of nombaTransactions) {
    if (!local.has(n.reference)) out.push({ class: 'settled_at_nomba_missing_locally', reference: n.reference, localKobo: null, nombaKobo: n.amountKobo });
  }
  return out;
}
