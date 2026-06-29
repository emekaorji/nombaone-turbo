/**
 * `@nombaone/sara/config` — platform money policy.
 *
 * Two seams that the financial core defers to: how fees are computed
 * (`fees`) and which well-known ledger accounts every tenant gets
 * (`system-accounts`). Both ship a sensible generic default and a clearly
 * documented override point, so a product can layer real pricing and its own
 * chart of accounts without forking the ledger.
 */
export {
  computeClampedFee,
  resolveFee,
  DEFAULT_FEE_SCHEDULE,
  type FeeSchedule,
  type ComputeClampedFeeInput,
} from './fees';
export {
  ensureSystemAccounts,
  SYSTEM_ACCOUNTS,
  type SystemAccountSpec,
} from './system-accounts';
