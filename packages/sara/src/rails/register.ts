import { setBillingNombaClient } from '../nomba/injected';
import { createCardRail } from './card';
import { createMandateRail } from './mandate';
import { registerRail } from './registry';
import { createTransferRail } from './transfer';

import type { NombaClient } from '../nomba/client';

/**
 * Register the three REAL Nomba rails behind the shared registry — the core
 * resolves a rail by key and never names a provider. Called once at API + worker
 * boot with the built `NombaClient` (replacing the mock-rail registration in
 * product code; the harness keeps its named fake adapter).
 */
export function registerNombaRails(client: NombaClient): void {
  registerRail(createCardRail(client));
  registerRail(createMandateRail(client));
  registerRail(createTransferRail(client));
  // Same client powers the billing layer's OTP/3DS checkout-link mint (E4 fallback).
  setBillingNombaClient(client);
}
