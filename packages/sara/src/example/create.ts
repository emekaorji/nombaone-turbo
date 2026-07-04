import { examplesTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { ensureSystemAccounts } from '../config';
import { emitEvent } from '../events';
import { ensureAccount, getAccountBalance, postTransaction } from '../ledger';
import { assertPositiveKobo } from '../money';
import { getRail } from '../rails';
import { mintReference } from '../reference';
import { serializeExample } from './serialize';

import type { DomainContext, InfraDb, InfraTxDb } from '../context';
import type { CreateExampleInput, ExampleResponseData } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * createExample — the canonical MONEY-PATH walkthrough.
 *
 * Every line below names a reusable paradigm; this is the file you read to learn
 * how a money movement is recorded in this codebase. The deletable example proves
 * the primitives compose end to end before you model your real domain.
 *
 * The path, in order:
 *
 *  1. VALIDATION AT THE BOUNDARY — `assertPositiveKobo`. Money is positive integer
 *     kobo; direction (debit/credit) carries the sign. We reject bad input before
 *     touching the database.
 *
 *  2. THE REFERENCE = THE JOIN KEY — `mintReference('EXA')`. The minted reference
 *     is the public `id`, the idempotency key, AND the reconciliation join key
 *     across the example row, the ledger, the emitted event, and the rail. One
 *     stable string ties the whole lifecycle together.
 *
 *  3. THE RESOURCE ROW — a bare, queryable `examples` row (typed columns + enum
 *     discriminator, NO opaque status column: status is derived from the ledger).
 *
 *  4. WELL-KNOWN ACCOUNTS — `ensureSystemAccounts` idempotently provisions this
 *     tenant's `cash` and `platform_revenue` accounts so step 5 has somewhere to
 *     post. Safe to call on every create.
 *
 *  5. THE LEDGER POST — `postTransaction` records the charge as a balanced
 *     double-entry transaction (debit `cash`, credit `platform_revenue`,
 *     amount = input.amount). The ledger is the single source of truth for money
 *     state; the invariant Σdebits = Σcredits is asserted before any row is
 *     written.
 *
 *  6. THE EVENT EMIT — `emitEvent('example.created')` appends to the domain-event
 *     spine and fans out webhook deliveries (the transactional-outbox paradigm).
 *
 *  7. THE RAIL COLLECT — `getRail('mock_pull').collect(...)` initiates collection
 *     through the rail abstraction. PULL rails (card token, mandate) are initiated
 *     by us and answer succeeded/pending/failed; PUSH rails (transfer to a virtual
 *     account) instead return pay-instructions and settle later via an inbound
 *     webhook + reconciliation. The core resolves the rail by KEY and never
 *     branches on a provider's name.
 *
 * Tenancy: every write is stamped with `ctx.organizationId` / `ctx.mode`;
 * the handler never trusts org/env from the client.
 *
 * Note on atomicity: `ensureSystemAccounts` and `postTransaction` each open their
 * own interactive transaction off the passed pooled handle. They run in sequence
 * here; the reference is the recovery anchor if a later step fails (a retry with
 * the same reference is idempotent at the resource and reconcilable at the rail).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function createExample(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: CreateExampleInput
): Promise<ExampleResponseData> {
  // 1. Validation at the boundary.
  assertPositiveKobo(input.amount);

  // 2. Mint the reference — the public id + idempotency + reconciliation join key.
  const reference = mintReference('EXA');

  // 3. Persist the resource row (tenant-scoped, append-only, no status column).
  const [row] = await txDb
    .insert(examplesTable)
    .values({
      reference,
      organizationId: ctx.organizationId,
      mode: ctx.mode,
      kind: input.kind,
      amount: input.amount,
    })
    .returning();

  if (!row) {
    throw AppError.InternalServerError(
      'failed to persist example',
      { reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  // 4. Idempotently provision this tenant's well-known accounts.
  await ensureSystemAccounts(txDb, ctx);
  const cash = await ensureAccount(txDb, ctx, { key: 'cash', kind: 'asset' });
  const platformRevenue = await ensureAccount(txDb, ctx, {
    key: 'platform_revenue',
    kind: 'revenue',
  });

  // 5. Post the charge as a balanced double-entry transaction.
  await postTransaction(txDb, ctx, {
    kind: 'charge',
    memo: `example ${reference}`,
    entries: [
      { accountId: cash.id, direction: 'debit', amount: input.amount },
      { accountId: platformRevenue.id, direction: 'credit', amount: input.amount },
    ],
  });

  // 6. Emit the domain event (outbox: persist + fan out deliveries).
  await emitEvent(txDb, {
    ...ctx,
    type: 'example.created',
    payload: { reference, amount: input.amount, kind: input.kind },
  });

  // 7. Initiate collection through the rail abstraction (mock pull "succeeds").
  await getRail('mock_pull').collect({
    ...ctx,
    reference,
    amountKobo: input.amount,
  });

  // The status surfaced now is the freshly-derived one — collection initiated.
  const status = await deriveExampleStatus(txDb, cash.id);
  return serializeExample(row, status);
}

/**
 * Derive the example's status from the LEDGER, never from a stored field.
 *
 * Under the fixed sign convention (credit +amount, debit -amount), a successful
 * pull collection debits `cash` (asset), so a non-zero `cash` balance reflects
 * that money has moved. We treat that as `settled`; an untouched `cash` account
 * means the collection is still `pending`. This is intentionally simple — its
 * purpose is to demonstrate "status is computed from the source of truth". The
 * rule is colocated with its only producers (create + read) so the derivation
 * lives in exactly one place.
 */
export async function deriveExampleStatus(
  db: InfraDb,
  cashAccountId: string
): Promise<'pending' | 'settled'> {
  const balance = await getAccountBalance(db, cashAccountId);
  return balance !== 0 ? 'settled' : 'pending';
}
