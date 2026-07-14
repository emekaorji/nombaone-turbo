import type { Mode } from '../context';

/** A cached Nomba OAuth bearer + its absolute expiry (we refresh off `expiresAt`). */
export interface NombaToken {
  accessToken: string;
  refreshToken?: string;
  /** ISO-8601 absolute expiry from `data.expiresAt`. */
  expiresAt: string;
}

/**
 * What the rail adapters / capture flows need to talk to Nomba for one MODE.
 * Deliberately carries NO sub-account: a sub-account belongs to a merchant
 * (per-org `org_nomba_accounts` row, resolved per request), never to the
 * deployment's credential set — the old `subAccountId` field here was dead
 * weight the client never read, and env-coding one routes every tenant's money
 * through a single merchant.
 */
export interface NombaConfig {
  baseUrl: string;
  parentAccountId: string;
  clientId: string;
  clientSecret: string;
  mode: Mode;
  /** Seconds before `expiresAt` to proactively refresh (default 300). */
  tokenRefreshMarginSec: number;
}
