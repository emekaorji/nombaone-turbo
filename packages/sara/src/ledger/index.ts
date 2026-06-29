/**
 * `@nombaone/sara/ledger` — the double-entry financial core.
 *
 * The single source of truth for money state: immutable transactions composed of
 * balanced entries, materialized account balances mutated atomically, and
 * corrections expressed as linked reversals. Every public function takes a db /
 * txDb handle and a ctx; reads are tenant-scoped, writes are atomic. Higher
 * layers (config, settlement, a future billing product) compose these primitives
 * — they never write `ledger_*` rows directly.
 */
export {
  assertBalanced,
  balanceDelta,
  postTransaction,
  type EntryInput,
  type LedgerTransactionKind,
  type PostTransactionInput,
  type PostedTransaction,
} from './post';
export { reverseTransaction } from './reverse';
export { getAccountBalance } from './balance';
export {
  ensureAccount,
  type EnsureAccountParams,
  type LedgerAccountKind,
} from './accounts';
export { listTransactions, type ListTransactionsOptions } from './queries';
