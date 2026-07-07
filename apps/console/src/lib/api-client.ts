import { randomUUID } from 'node:crypto';

import { apiKeysTable, orgBridgeCredentialsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { db as poolDb } from '@nombaone/core-db/pool';
import { createApiKey } from '@nombaone/sara/api-keys';
import { decryptPii, encryptPii } from '@nombaone/sara/crypto';
import { and, eq } from 'drizzle-orm';

import type { SessionMode } from '@/lib/auth';

const API_BASE = process.env.NOMBAONE_API_URL ?? 'http://localhost:8000/v1';

/** Scopes the console needs to drive every engine write on a merchant's behalf. */
const BRIDGE_SCOPES = [
  'customers:read',
  'customers:write',
  'plans:read',
  'prices:read',
  'subscriptions:read',
  'subscriptions:write',
  'invoices:read',
  'invoices:write',
  'payment_methods:read',
  'payment_methods:write',
  'coupons:read',
  'settlements:read',
  'settlements:write',
  'webhooks:read',
  'webhooks:write',
  'metrics:read',
];

/** A typed failure carrying the API's own error envelope, for honest UI messages. */
export class ApiError extends Error {
  code: string;
  status: number;
  requestId?: string;
  constructor(message: string, opts: { code?: string; status: number; requestId?: string }) {
    super(message);
    this.name = 'ApiError';
    this.code = opts.code ?? 'api_error';
    this.status = opts.status;
    this.requestId = opts.requestId;
  }
}

/**
 * The one dedicated API key the console uses to call apps/api for this org+mode.
 * Minted once through the real key path, secret stored encrypted, reused after.
 */
async function getBridgeSecret(organizationId: string, mode: SessionMode): Promise<string> {
  const [existing] = await db
    .select({ secretEncrypted: orgBridgeCredentialsTable.secretEncrypted, apiKeyId: orgBridgeCredentialsTable.apiKeyId })
    .from(orgBridgeCredentialsTable)
    .where(and(eq(orgBridgeCredentialsTable.organizationId, organizationId), eq(orgBridgeCredentialsTable.mode, mode)));

  if (existing) {
    // Guard against a revoked underlying key — re-mint if so.
    const [key] = await db.select({ revokedAt: apiKeysTable.revokedAt }).from(apiKeysTable).where(eq(apiKeysTable.id, existing.apiKeyId));
    if (key && !key.revokedAt) return decryptPii(existing.secretEncrypted);
    await db.delete(orgBridgeCredentialsTable).where(and(eq(orgBridgeCredentialsTable.organizationId, organizationId), eq(orgBridgeCredentialsTable.mode, mode)));
  }

  const created = await createApiKey(poolDb, { organizationId, mode }, { name: 'Console bridge (internal)', scopes: BRIDGE_SCOPES });
  const [keyRow] = await db.select({ id: apiKeysTable.id }).from(apiKeysTable).where(eq(apiKeysTable.reference, created.reference));
  try {
    await db.insert(orgBridgeCredentialsTable).values({
      organizationId,
      mode,
      apiKeyId: keyRow!.id,
      secretEncrypted: encryptPii(created.secret),
    });
  } catch {
    // Lost a mint race — another request stored one first; use theirs.
    const [row] = await db
      .select({ secretEncrypted: orgBridgeCredentialsTable.secretEncrypted })
      .from(orgBridgeCredentialsTable)
      .where(and(eq(orgBridgeCredentialsTable.organizationId, organizationId), eq(orgBridgeCredentialsTable.mode, mode)));
    if (row) return decryptPii(row.secretEncrypted);
  }
  return created.secret;
}

type ApiEnvelope<T> = { success: true; statusCode: number; data: T; meta?: { requestId?: string } } | { success: false; error?: { message?: string; code?: string }; meta?: { requestId?: string } };

/**
 * Call an apps/api `/v1` endpoint as the current org+mode. Returns the unwrapped
 * `data`, or throws ApiError with the upstream message. Money POSTs get a fresh
 * Idempotency-Key per call (one user intent = one key).
 */
export async function callApi<T = unknown>(
  session: { organizationId: string; mode: SessionMode },
  path: string,
  opts: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const method = opts.method ?? 'GET';
  const secret = await getBridgeSecret(session.organizationId, session.mode);

  const headers: Record<string, string> = { Authorization: `Bearer ${secret}`, Accept: 'application/json' };
  let body: string | undefined;
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['Idempotency-Key'] = opts.idempotencyKey ?? randomUUID();
    body = JSON.stringify(opts.body ?? {});
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body, cache: 'no-store' });
  } catch {
    throw new ApiError('Could not reach the billing engine. Is apps/api running?', { status: 503, code: 'api_unreachable' });
  }

  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!json) throw new ApiError('The billing engine returned an unreadable response.', { status: res.status });
  if (!res.ok || json.success === false) {
    const err = json.success === false ? json.error : undefined;
    throw new ApiError(err?.message ?? `Request failed (${res.status}).`, {
      status: res.status,
      code: err?.code,
      requestId: json.meta?.requestId,
    });
  }
  return json.data;
}
