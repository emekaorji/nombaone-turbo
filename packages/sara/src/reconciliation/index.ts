/**
 * `@nombaone/sara/reconciliation` — the ledger-wide zero-sum cross-check.
 *
 * Independent of the write path: it re-derives totals from the entry ledger and
 * proves the whole system still balances. Run it on a schedule (and after bulk
 * operations) to catch drift early; `assertZeroSum` turns a report into a hard
 * failure when drift exceeds the allowed band.
 */
export {
  reconcileLedger,
  assertZeroSum,
  type ReconciliationReport,
} from './reconcile';
export * from './nomba';
