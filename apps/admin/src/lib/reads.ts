import 'server-only';

import { desc, eq, sql } from 'drizzle-orm';
import {
  adminAuditLogTable,
  examplesTable,
  ledgerEntriesTable,
  ledgerTransactionsTable,
  operatorsTable,
  organizationsTable,
  type AdminAuditLogRow,
} from '@nombaone/core-db/schema';
import type { Mode } from '@nombaone/sara/context';

import { getDb } from '@/lib/db';

/**
 * OPERATOR-SCOPE READS (platform-wide, NOT tenant-scoped).
 *
 * The `@nombaone/sara` domain readers (e.g. `listExamples`) take a `(org, env)`
 * `DomainContext` — they are for a tenant looking at its OWN data. An OPERATOR
 * looks ACROSS every tenant, so the panel owns its own cross-org reads here.
 *
 * Two invariants hold for all of them:
 *   • the operator's selected mode is passed in and applied in the WHERE
 *     clause SERVER-SIDE — the env cookie is a preference, never authority, so
 *     each read re-filters by the ring;
 *   • the public `reference` is the surfaced id; the internal UUID never leaves
 *     the server except where it joins rows together here.
 *
 * These are all single-statement reads, so they use the read handle (`getDb`).
 */

/* ----------------------------- dashboard ------------------------------- */

export type DashboardStats = {
  organizations: number;
  examples: number;
  operators: number;
  /** Ledger totals for the selected ring (kobo). */
  totalDebits: number;
  totalCredits: number;
  /** totalDebits − totalCredits; 0 when the ledger balances. */
  drift: number;
};

/** Platform headline counters + a ledger zero-sum snapshot for one ring. */
export async function getDashboardStats(mode: Mode): Promise<DashboardStats> {
  const db = getDb();

  const [[orgCount], [exampleCount], [operatorCount], [ledger]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(organizationsTable),
    db
      .select({ count: sql<number>`count(*)` })
      .from(examplesTable)
      .where(eq(examplesTable.mode, mode)),
    db.select({ count: sql<number>`count(*)` }).from(operatorsTable),
    db
      .select({
        totalDebits: sql<number>`coalesce(sum(case when ${ledgerEntriesTable.direction} = 'debit' then ${ledgerEntriesTable.amount} else 0 end), 0)`,
        totalCredits: sql<number>`coalesce(sum(case when ${ledgerEntriesTable.direction} = 'credit' then ${ledgerEntriesTable.amount} else 0 end), 0)`,
      })
      .from(ledgerEntriesTable)
      .innerJoin(
        ledgerTransactionsTable,
        eq(ledgerEntriesTable.transactionId, ledgerTransactionsTable.id)
      )
      .where(eq(ledgerTransactionsTable.mode, mode)),
  ]);

  const totalDebits = Number(ledger?.totalDebits ?? 0);
  const totalCredits = Number(ledger?.totalCredits ?? 0);

  return {
    organizations: Number(orgCount?.count ?? 0),
    examples: Number(exampleCount?.count ?? 0),
    operators: Number(operatorCount?.count ?? 0),
    totalDebits,
    totalCredits,
    drift: totalDebits - totalCredits,
  };
}

/* ------------------------------ examples ------------------------------- */

export type PlatformExampleRow = {
  reference: string;
  organizationName: string;
  organizationReference: string;
  kind: string;
  amount: number;
  mode: Mode;
  attemptCount: number;
  createdAt: string;
};

/**
 * Platform-wide example list for the operator read view: every tenant's
 * examples in the selected ring, joined to the org for a human name, newest
 * first. Bounded by `limit` (no operator-facing pagination needed for the
 * read view).
 */
export async function listPlatformExamples(
  mode: Mode,
  limit = 50
): Promise<PlatformExampleRow[]> {
  const rows = await getDb()
    .select({
      reference: examplesTable.reference,
      organizationName: organizationsTable.name,
      organizationReference: organizationsTable.reference,
      kind: examplesTable.kind,
      amount: examplesTable.amount,
      mode: examplesTable.mode,
      attemptCount: examplesTable.attemptCount,
      createdAt: examplesTable.createdAt,
    })
    .from(examplesTable)
    .innerJoin(organizationsTable, eq(examplesTable.organizationId, organizationsTable.id))
    .where(eq(examplesTable.mode, mode))
    .orderBy(desc(examplesTable.createdAt), desc(examplesTable.id))
    .limit(limit);

  return rows.map((row) => ({
    reference: row.reference,
    organizationName: row.organizationName,
    organizationReference: row.organizationReference,
    kind: row.kind,
    amount: Number(row.amount),
    mode: row.mode as Mode,
    attemptCount: row.attemptCount,
    createdAt: new Date(row.createdAt).toISOString(),
  }));
}

/* ----------------------------- audit log ------------------------------- */

export type AuditLogEntry = AdminAuditLogRow & { operatorName: string | null };

/**
 * Newest-first slice of the append-only operator audit log, joined to the
 * operator for a display name. Not env-scoped — operators act across rings, so
 * the audit row carries no `(org, env)` filter.
 */
export async function listAuditLog(limit = 100): Promise<AuditLogEntry[]> {
  const rows = await getDb()
    .select({
      id: adminAuditLogTable.id,
      operatorId: adminAuditLogTable.operatorId,
      action: adminAuditLogTable.action,
      targetType: adminAuditLogTable.targetType,
      targetReference: adminAuditLogTable.targetReference,
      summary: adminAuditLogTable.summary,
      createdAt: adminAuditLogTable.createdAt,
      operatorName: operatorsTable.name,
    })
    .from(adminAuditLogTable)
    .leftJoin(operatorsTable, eq(adminAuditLogTable.operatorId, operatorsTable.id))
    .orderBy(desc(adminAuditLogTable.createdAt))
    .limit(limit);

  return rows as AuditLogEntry[];
}

/* -------------------------- reconciliation ----------------------------- */

export type PlatformReconciliation = {
  balanced: boolean;
  totalDebits: number;
  totalCredits: number;
  drift: number;
};

/**
 * Platform-wide ledger zero-sum check for one ring. Mirrors the per-tenant
 * `reconcileLedger` from `@nombaone/sara/reconciliation`, but aggregated across
 * every organization (the operator view): sum debits vs credits over all
 * transactions in the ring.
 */
export async function getPlatformReconciliation(
  mode: Mode
): Promise<PlatformReconciliation> {
  const [totals] = await getDb()
    .select({
      totalDebits: sql<number>`coalesce(sum(case when ${ledgerEntriesTable.direction} = 'debit' then ${ledgerEntriesTable.amount} else 0 end), 0)`,
      totalCredits: sql<number>`coalesce(sum(case when ${ledgerEntriesTable.direction} = 'credit' then ${ledgerEntriesTable.amount} else 0 end), 0)`,
    })
    .from(ledgerEntriesTable)
    .innerJoin(
      ledgerTransactionsTable,
      eq(ledgerEntriesTable.transactionId, ledgerTransactionsTable.id)
    )
    .where(eq(ledgerTransactionsTable.mode, mode));

  const totalDebits = Number(totals?.totalDebits ?? 0);
  const totalCredits = Number(totals?.totalCredits ?? 0);
  const drift = totalDebits - totalCredits;

  return { balanced: drift === 0, totalDebits, totalCredits, drift };
}
