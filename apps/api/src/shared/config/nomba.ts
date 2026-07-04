import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import type { Mode } from '@nombaone/sara/context';
import {
  createNombaClient,
  setBillingNombaClientFactory,
  type NombaClient,
  type NombaConfig,
} from '@nombaone/sara/nomba';
import { registerNombaRails } from '@nombaone/sara/rails';

import { env } from './env';
import { redis } from './redis';

/**
 * Nomba clients, selected by ACCOUNT MODE (`sandbox` | `live`) — never by
 * deployment. ONE process serves BOTH modes: every request resolves its `mode`
 * from the API-key prefix, and `getNombaClient(mode)` returns the client wired
 * to THAT mode's credentials (separate Nomba accounts, separate token caches),
 * so a sandbox charge can never reach the live Nomba and vice-versa (N2/safety).
 *
 * Lazy + per-mode cached: the catalog/customer surfaces boot without any Nomba
 * config; only the rail/capture endpoints need a client, and only for the modes
 * that are actually configured. `__setNombaClient` is a TEST-ONLY seam the e2e
 * harness uses to inject one fake for every mode (no network).
 */
type NombaCreds = {
  baseUrl?: string;
  parentAccountId?: string;
  subAccountId?: string;
  clientId?: string;
  clientSecret?: string;
};

const credsFor = (mode: Mode): NombaCreds =>
  mode === 'live'
    ? {
        baseUrl: env.NOMBA_LIVE_BASE_URL,
        parentAccountId: env.NOMBA_LIVE_PARENT_ACCOUNT_ID,
        subAccountId: env.NOMBA_LIVE_SUBACCOUNT_ID,
        clientId: env.NOMBA_LIVE_CLIENT_ID,
        clientSecret: env.NOMBA_LIVE_CLIENT_SECRET,
      }
    : {
        baseUrl: env.NOMBA_SANDBOX_BASE_URL,
        parentAccountId: env.NOMBA_SANDBOX_PARENT_ACCOUNT_ID,
        subAccountId: env.NOMBA_SANDBOX_SUBACCOUNT_ID,
        clientId: env.NOMBA_SANDBOX_CLIENT_ID,
        clientSecret: env.NOMBA_SANDBOX_CLIENT_SECRET,
      };

let testOverride: NombaClient | null = null;
const cache = new Map<Mode, NombaClient>();

export const __setNombaClient = (client: NombaClient | null): void => {
  testOverride = client;
  cache.clear();
  // Keep the billing-layer checkout-link mint in sync with the injected fake:
  // one factory that returns the same fake for every mode.
  setBillingNombaClientFactory(client ? () => client : null);
};

/** True when the given mode has a full credential set (else its rails stay unwired). */
export const isNombaConfigured = (mode: Mode): boolean => {
  const c = credsFor(mode);
  return Boolean(c.baseUrl && c.parentAccountId && c.clientId && c.clientSecret);
};

/**
 * Resolve the Nomba client for a request's `mode`. SAFETY GUARD: `live` is only
 * reachable on a `production` deployment — a `development` box (a laptop, CI)
 * physically cannot mint a live client, so it cannot move real money even if a
 * live key leaks into its env.
 */
export const getNombaClient = (mode: Mode): NombaClient => {
  if (testOverride) return testOverride;

  if (mode === 'live' && env.INFRA_ENVIRONMENT !== 'production') {
    throw AppError.ServiceUnavailable(
      'Live Nomba is only available on a production deployment',
      { infraEnvironment: env.INFRA_ENVIRONMENT },
      NOMBAONE_ERROR_CODES.NOMBA_REQUEST_FAILED
    );
  }

  const hit = cache.get(mode);
  if (hit) return hit;

  if (!isNombaConfigured(mode)) {
    throw AppError.ServiceUnavailable(
      `Nomba is not configured for ${mode} mode`,
      { mode },
      NOMBAONE_ERROR_CODES.NOMBA_REQUEST_FAILED
    );
  }
  const c = credsFor(mode);
  const config: NombaConfig = {
    baseUrl: c.baseUrl as string,
    parentAccountId: c.parentAccountId as string,
    subAccountId: c.subAccountId ?? '',
    clientId: c.clientId as string,
    clientSecret: c.clientSecret as string,
    mode,
    tokenRefreshMarginSec: env.NOMBA_TOKEN_REFRESH_MARGIN_SEC,
  };
  const client = createNombaClient({ redis, config });
  cache.set(mode, client);
  return client;
};

/**
 * The modes a background sweep can actually drive a Nomba client for on THIS
 * deployment: configured AND allowed (live only on production). A dev box returns
 * just `['sandbox']` (or `[]`); a production box with both sets returns both — so
 * the crons iterate the whole shared DB without ever tripping the live guard.
 */
export const availableNombaModes = (): Mode[] =>
  (['sandbox', 'live'] as Mode[]).filter((mode) => {
    if (mode === 'live' && env.INFRA_ENVIRONMENT !== 'production') return false;
    // A client is obtainable when the mode's creds are set OR a test fake is
    // injected (the e2e harness drives the sweeps through an injected client).
    return testOverride != null || isNombaConfigured(mode);
  });

/**
 * Register the real Nomba rails at boot IFF at least one mode is configured
 * (else the mock/fake stands). The rails hold the FACTORY, not a client, and
 * call `getNombaClient(input.mode)` per charge — so the same registration serves
 * both modes and honours the live-on-production guard at call time.
 */
export const registerRailsIfConfigured = (): boolean => {
  if (!isNombaConfigured('sandbox') && !isNombaConfigured('live')) return false;
  registerNombaRails((mode) => getNombaClient(mode));
  return true;
};
