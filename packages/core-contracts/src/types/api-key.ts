import type { Environment } from './common';

/** Fine-grained scopes gate each endpoint via requireScope(). Extend per domain. */
export type ApiKeyScope =
  | 'example:read'
  | 'example:write'
  | 'webhooks:read'
  | 'webhooks:write';

export interface ApiKeyResponseData {
  id: string; // public reference
  name: string;
  /** First chars of the secret, for display only (e.g. `nbo_test_a1b2…`). */
  keyPrefix: string;
  scopes: ApiKeyScope[];
  environment: Environment;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** Returned ONCE at mint time — the full secret is never stored or shown again. */
export interface CreatedApiKeyResponseData extends ApiKeyResponseData {
  secret: string;
}
