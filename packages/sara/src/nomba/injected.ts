import type { NombaClient } from './client';
import type { Mode } from '../context';

/**
 * A process-level Nomba client FACTORY injected once at boot (`registerNombaRails`,
 * and the e2e harness's `__setNombaClient`). It lets the billing/dunning layer mint
 * a hosted-checkout link for OTP/3DS completion WITHOUT threading a `NombaClient`
 * through every collect/dunning call site (rails resolve their client by `ctx.mode`
 * at collect time; this mirrors that for the one place that needs a raw checkout
 * call).
 *
 * The factory selects the client for the request's MODE (`sandbox` | `live`), so a
 * sandbox link is minted against sandbox Nomba and a live link against live Nomba —
 * never crossed. Unset before boot / in pure unit tests, or unconfigured for the
 * mode ⇒ the mint returns `null` and the caller still emits the action event, just
 * without a link.
 */
export type NombaClientFactory = (mode: Mode) => NombaClient;

let billingClientFactory: NombaClientFactory | null = null;

export const setBillingNombaClientFactory = (factory: NombaClientFactory | null): void => {
  billingClientFactory = factory;
};

export const getBillingNombaClient = (mode: Mode): NombaClient | null => {
  if (!billingClientFactory) return null;
  try {
    return billingClientFactory(mode);
  } catch {
    return null;
  }
};
