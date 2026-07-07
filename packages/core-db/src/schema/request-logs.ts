import { index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, idPk, modeEnum } from './shared';
import { organizationsTable } from './organizations';

/**
 * The append-only API request log — one row per inbound `/v1` HTTP request, the
 * source for the console's Developers → Logs surface (method, path, status,
 * latency, the request id you can quote to support, and the response body).
 *
 * Written best-effort by apps/api middleware AFTER the response flushes, so a
 * logging failure can never affect the request. `organizationId`/`mode` are
 * nullable so unauthenticated/failed-auth requests (401s) are still recorded.
 * The response body is size-capped at write time; rows are pruned by a retention
 * sweep. Merchant-scoped: a caller only ever reads its own org+mode rows.
 */
export const requestLogsTable = pgTable(
  'request_logs',
  {
    id: idPk(),
    // The X-Request-Id correlation id (req_…) — the natural, human-quotable key.
    requestId: text('request_id').notNull(),
    organizationId: uuid('organization_id').references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode'),
    apiKeyId: uuid('api_key_id'),
    method: text('method').notNull(),
    // Concrete path WITHOUT the query string (query can carry secrets).
    path: text('path').notNull(),
    // The low-cardinality matched route pattern (e.g. /v1/subscriptions/:id), when known.
    route: text('route'),
    statusCode: integer('status_code').notNull(),
    durationMs: integer('duration_ms').notNull(),
    ip: text('ip'),
    idempotencyKey: text('idempotency_key'),
    apiVersion: text('api_version'),
    // Size-capped serialized response body (a truncation marker is stored past the cap).
    responseBody: jsonb('response_body').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (table) => ({
    requestIdUnique: uniqueIndex('request_logs_request_id_unique').on(table.requestId),
    keysetIdx: index('request_logs_keyset_idx').on(
      table.organizationId,
      table.mode,
      table.createdAt.desc(),
      table.id.desc()
    ),
    retentionIdx: index('request_logs_created_at_idx').on(table.createdAt),
  })
);

export type RequestLogRow = typeof requestLogsTable.$inferSelect;
export type RequestLogInsert = typeof requestLogsTable.$inferInsert;
