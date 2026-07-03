import { and, asc, desc, eq, lt, or, sql } from 'drizzle-orm';

import { domainEventsTable } from '@nombaone/core-db/schema';

import { buildPage, clampLimit, decodeCursor } from '../pagination';
import { serializeDomainEvent } from './serialize';

import type { DomainContext, InfraDb } from '../context';
import type { Page } from '../pagination';
import type { DomainEventResponseData } from '@nombaone/core-contracts/types';

/**
 * The per-subscription audit trail (M / ties to A's event-sourcing): the ordered
 * `domain_events` whose payload `reference` is the subscription — its whole life,
 * replayable. Read-only; tenant-scoped.
 */
export async function listSubscriptionAuditTrail(
  db: InfraDb,
  ctx: DomainContext,
  subscriptionRef: string
): Promise<DomainEventResponseData[]> {
  const rows = await db
    .select()
    .from(domainEventsTable)
    .where(
      and(
        eq(domainEventsTable.organizationId, ctx.organizationId),
        eq(domainEventsTable.environment, ctx.environment),
        sql`${domainEventsTable.payload} ->> 'reference' = ${subscriptionRef}`
      )
    )
    .orderBy(asc(domainEventsTable.createdAt), asc(domainEventsTable.id));
  return rows.map(serializeDomainEvent);
}

export interface ListDomainEventsOptions {
  limit?: number;
  cursor?: string;
  type?: string;
}

/** Cursor list of a tenant's domain events (newest first), optional type filter. */
export async function listDomainEvents(
  db: InfraDb,
  ctx: DomainContext,
  opts: ListDomainEventsOptions = {}
): Promise<Page<DomainEventResponseData>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const scope = and(
    eq(domainEventsTable.organizationId, ctx.organizationId),
    eq(domainEventsTable.environment, ctx.environment),
    opts.type ? eq(domainEventsTable.type, opts.type) : undefined
  );
  const keyset = cursor
    ? or(
        lt(domainEventsTable.createdAt, new Date(cursor.createdAt)),
        and(eq(domainEventsTable.createdAt, new Date(cursor.createdAt)), lt(domainEventsTable.id, cursor.id))
      )
    : undefined;

  const rows = await db
    .select()
    .from(domainEventsTable)
    .where(keyset ? and(scope, keyset) : scope)
    .orderBy(desc(domainEventsTable.createdAt), desc(domainEventsTable.id))
    .limit(limit + 1);

  const page = buildPage(rows, limit, (row) => ({ createdAt: row.createdAt.toISOString(), id: row.id }));
  return { ...page, data: page.data.map(serializeDomainEvent) };
}
