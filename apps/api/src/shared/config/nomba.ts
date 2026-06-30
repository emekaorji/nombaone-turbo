import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { createNombaClient, type NombaClient, type NombaConfig } from '@nombaone/sara/nomba';
import { registerNombaRails } from '@nombaone/sara/rails';

import { env } from './env';
import { redis } from './redis';

/**
 * The app's single Nomba client, built from env (the secrets live here, never in
 * source — N2). Lazy: the catalog/customer surfaces boot and run without Nomba
 * configured; only the rail/capture endpoints need it. `__setNombaClient` is a
 * TEST-ONLY seam the e2e harness uses to inject a fake (no network).
 */
let testOverride: NombaClient | null = null;
let cached: NombaClient | null = null;

export const __setNombaClient = (client: NombaClient | null): void => {
  testOverride = client;
  cached = null;
};

export const isNombaConfigured = (): boolean =>
  Boolean(
    env.NOMBA_BASE_URL &&
      env.NOMBA_PARENT_ACCOUNT_ID &&
      env.NOMBA_CLIENT_ID &&
      env.NOMBA_CLIENT_SECRET
  );

export const getNombaClient = (): NombaClient => {
  if (testOverride) return testOverride;
  if (cached) return cached;
  if (!isNombaConfigured()) {
    throw AppError.ServiceUnavailable(
      'Nomba is not configured for this deployment',
      undefined,
      NOMBAONE_ERROR_CODES.NOMBA_REQUEST_FAILED
    );
  }
  const config: NombaConfig = {
    baseUrl: env.NOMBA_BASE_URL as string,
    parentAccountId: env.NOMBA_PARENT_ACCOUNT_ID as string,
    subAccountId: env.NOMBA_SUBACCOUNT_ID ?? '',
    clientId: env.NOMBA_CLIENT_ID as string,
    clientSecret: env.NOMBA_CLIENT_SECRET as string,
    environment: env.INFRA_ENVIRONMENT,
    tokenRefreshMarginSec: env.NOMBA_TOKEN_REFRESH_MARGIN_SEC,
  };
  cached = createNombaClient({ redis, config });
  return cached;
};

/** Register the real Nomba rails at boot IFF configured (else the mock/fake stands). */
export const registerRailsIfConfigured = (): boolean => {
  if (!isNombaConfigured()) return false;
  registerNombaRails(getNombaClient());
  return true;
};
