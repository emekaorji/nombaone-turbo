import type { Environment } from '../context';

/** A cached Nomba OAuth bearer + its absolute expiry (we refresh off `expiresAt`). */
export interface NombaToken {
  accessToken: string;
  refreshToken?: string;
  /** ISO-8601 absolute expiry from `data.expiresAt`. */
  expiresAt: string;
}

/** What the rail adapters / capture flows need to talk to Nomba for one tenant. */
export interface NombaConfig {
  baseUrl: string;
  parentAccountId: string;
  subAccountId: string;
  clientId: string;
  clientSecret: string;
  environment: Environment;
  /** Seconds before `expiresAt` to proactively refresh (default 300). */
  tokenRefreshMarginSec: number;
}
