/**
 * Sub-account resolution for OPERATOR SCRIPTS.
 *
 * Sub-accounts are per-merchant rows in `org_nomba_accounts` — never env keys
 * (the old `NOMBA_*_SUBACCOUNT_ID` envs routed every tenant's money through one
 * merchant and are gone). A script that needs to scope a charge/checkout passes
 * the merchant's sub-account explicitly:
 *
 *   npx tsx scripts/<script>.ts --account-id=<nomba-sub-account-id>
 *
 * (or exports SCRIPT_SUBACCOUNT_ID for a session). Scripts that PROBE rather
 * than settle may run without one — unscoped orders never fire webhooks, which
 * is sometimes exactly what a probe wants to demonstrate.
 */
/* eslint-disable turbo/no-undeclared-env-vars */
const flag = process.argv.find((a) => a.startsWith('--account-id='));

export const scriptSubAccountId: string | undefined =
  flag?.slice('--account-id='.length) || process.env.SCRIPT_SUBACCOUNT_ID || undefined;

export function requireScriptSubAccountId(scriptName: string): string {
  if (!scriptSubAccountId) {
    console.error(`usage: npx tsx scripts/${scriptName}.ts --account-id=<nomba-sub-account-id>`);
    console.error('(sub-accounts are per-merchant org_nomba_accounts rows, never env keys)');
    process.exit(1);
  }
  return scriptSubAccountId;
}
