import 'server-only';

import { eq } from 'drizzle-orm';

import { examplesTable, organizationsTable } from '@nombaone/core-db/schema';
import { getExampleByReference } from '@nombaone/sara/example';
import { AppError, HTTP_STATUS_CODES } from '@nombaone/errors';

import { db } from './db';

import type { DomainContext, Mode } from '@nombaone/sara/context';
import type { ExampleResponseData } from '@nombaone/core-contracts/types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE REFERENCE-ONLY RESOLVER — deriving the tenant FROM the resource.
 *
 * The hosted checkout is the PUBLIC end-subscriber surface. It is UNAUTHENTICATED
 * and keyed solely by the resource's public reference (the `nbo…exa` id baked
 * into the URL). Every other surface (console, api) pins (org, environment) from
 * a trusted caller — a signed-in session or an API key — and threads that scope
 * into the domain. The checkout has no caller, so it must derive the scope the
 * other way round: from the resource itself.
 *
 * sara's domain reads all take a `DomainContext` precisely so a handler can NEVER
 * select the tenant from client input. `getExampleByReference(db, ctx, reference)`
 * re-resolves the reference WITHIN `ctx` — a reference from another tenant simply
 * does not exist for that ctx. For a public page there is no ctx to hand it, so
 * this thin resolver does the one safe thing the domain can't do for us: it looks
 * the resource up by its globally-unique reference alone (the reference column has
 * a UNIQUE index, so at most one row matches across all tenants), reads the
 * (org, environment) OFF that trusted row, and only then calls the domain with the
 * ctx it just derived. The reference is the authority; the URL is never trusted as
 * proof of ownership beyond "this exact reference exists".
 *
 * SEAM — subscriber session-auth within a tenant. A production checkout would let
 * a returning payer authenticate (passwordless email link / saved instrument) and
 * scope their session to THIS tenant + THIS resource. That session would never
 * widen the scope derived here; it would only personalise the page (prefill, saved
 * instruments). It is deliberately omitted from the boilerplate — the reference is
 * the only authority the public page needs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** The org + environment a resource belongs to, derived from its own row. */
export interface CheckoutScope {
  /** Resolved internal org id — needed to build the `DomainContext`. */
  organizationId: string;
  /** The resource's own environment dimension (drives which data it lives in). */
  mode: Mode;
}

/** A resolved checkout view: the public DTO + the collecting merchant + scope. */
export interface CheckoutResource {
  /** The public, serialized example DTO (money in kobo, status derived). */
  example: ExampleResponseData;
  /** The collecting merchant's display name + public org reference. */
  merchant: { name: string; reference: string };
  /** The scope derived from the row — reused to re-resolve on the pay action. */
  scope: CheckoutScope;
}

/**
 * Look up the (org, environment) scope for a reference by querying `examples`
 * directly — the ONE step the domain can't do for a caller-less surface. Joins
 * the collecting org so the branded header can name the merchant. Returns `null`
 * when no row matches; the page renders a terminal not-found state.
 */
async function resolveScopeByReference(
  reference: string
): Promise<{ scope: CheckoutScope; merchant: { name: string; reference: string } } | null> {
  const [row] = await db
    .select({
      organizationId: examplesTable.organizationId,
      mode: examplesTable.mode,
      orgName: organizationsTable.name,
      orgReference: organizationsTable.reference,
    })
    .from(examplesTable)
    .innerJoin(organizationsTable, eq(examplesTable.organizationId, organizationsTable.id))
    .where(eq(examplesTable.reference, reference))
    .limit(1);

  if (!row) return null;

  return {
    scope: { organizationId: row.organizationId, mode: row.mode },
    merchant: { name: row.orgName, reference: row.orgReference },
  };
}

/**
 * Resolve a resource for the public checkout by its reference ALONE.
 *
 * Two steps, in order:
 *   1. Derive the (org, environment) ctx from the trusted row (reference-only).
 *   2. Hand that ctx to the canonical domain read — `getExampleByReference` —
 *      so the wire DTO (and its LEDGER-DERIVED status) is produced by sara's real
 *      serializer, identical to every other surface. The status is computed from
 *      the ledger, never read from a column, so a returning payer always sees the
 *      true state — `pending` until the money has actually moved, never "assumed
 *      paid" because they came back to the page.
 *
 * Returns `null` only when the reference matches nothing.
 */
export async function getCheckoutResource(reference: string): Promise<CheckoutResource | null> {
  const resolved = await resolveScopeByReference(reference);
  if (!resolved) return null;

  const ctx: DomainContext = {
    organizationId: resolved.scope.organizationId,
    mode: resolved.scope.mode,
  };

  try {
    const example = await getExampleByReference(db, ctx, reference);
    return { example, merchant: resolved.merchant, scope: resolved.scope };
  } catch (err) {
    // The scope was derived from the row above, so the domain read should always
    // find it — but if it has since vanished (cascade delete between the two
    // reads), treat it as not-found rather than surfacing a 500.
    if (err instanceof AppError && err.status === HTTP_STATUS_CODES.NOT_FOUND) return null;
    throw err;
  }
}

/**
 * The scope for a write, re-resolved by reference. The pay action calls this to
 * rebuild the `DomainContext` server-side from the trusted row rather than
 * trusting any client input beyond the reference itself.
 */
export async function getCheckoutScope(reference: string): Promise<CheckoutScope | null> {
  const resolved = await resolveScopeByReference(reference);
  return resolved ? resolved.scope : null;
}

/** Whether a resource is in an open state a subscriber can still act on. */
export function isPayable(status: ExampleResponseData['status']): boolean {
  return status === 'pending';
}
