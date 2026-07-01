import type { Environment } from './common';

/** Fine-grained scopes gate each endpoint via requireScope(). Extend per domain. */
export type ApiKeyScope =
  | 'customers:read'
  | 'customers:write'
  | 'plans:read'
  | 'plans:write'
  | 'prices:read'
  | 'prices:write'
  | 'payment_methods:read'
  | 'payment_methods:write'
  | 'mandates:write'
  | 'subscriptions:read'
  | 'subscriptions:write'
  | 'invoices:read'
  | 'invoices:write'
  | 'coupons:read'
  | 'coupons:write'
  | 'billing_settings:read'
  | 'billing_settings:write'
  | 'settlements:read'
  | 'settings:read'
  | 'settings:write'
  | 'metrics:read'
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
