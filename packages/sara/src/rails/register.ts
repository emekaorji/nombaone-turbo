import { setBillingNombaClientFactory, type NombaClientFactory } from '../nomba/injected';
import { createCardRail } from './card';
import { createMandateRail } from './mandate';
import { registerRail } from './registry';
import { createTransferRail } from './transfer';

/**
 * Register the three REAL Nomba rails behind the shared registry — the core
 * resolves a rail by key and never names a provider. Called once at API + worker
 * boot with a client FACTORY that selects the Nomba client by the request's
 * `mode` (`sandbox` | `live`), so one process serves both modes and a sandbox
 * charge never hits live Nomba. (The harness keeps its named fake adapter.)
 */
export function registerNombaRails(getClient: NombaClientFactory): void {
  registerRail(createCardRail(getClient));
  registerRail(createMandateRail(getClient));
  registerRail(createTransferRail(getClient));
  // Same factory powers the billing layer's OTP/3DS checkout-link mint (E4 fallback).
  setBillingNombaClientFactory(getClient);
}
