import type { NombaClient } from './client';

/**
 * A process-level Nomba client injected once at boot (`registerNombaRails`, and the
 * e2e harness's `__setNombaClient`). It lets the billing/dunning layer mint a
 * hosted-checkout link for OTP/3DS completion WITHOUT threading a `NombaClient`
 * through every collect/dunning call site (rails already bake their client in at
 * registration; this mirrors that boot-time injection for the one place that needs
 * a raw checkout call). Unset before boot / in pure unit tests ⇒ the mint returns
 * `null` and the caller still emits the action event, just without a link.
 */
let billingClient: NombaClient | null = null;

export const setBillingNombaClient = (client: NombaClient | null): void => {
  billingClient = client;
};

export const getBillingNombaClient = (): NombaClient | null => billingClient;
