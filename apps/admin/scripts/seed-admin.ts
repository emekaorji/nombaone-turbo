/**
 * Deterministic admin seed — `pnpm -F @nombaone/admin seed:admin`.
 *
 * Creates (or upserts, by email) ONE `super_admin` operator so a fresh database
 * can be signed into. It is deterministic and idempotent: re-running it updates
 * the same row rather than creating duplicates.
 *
 * PARADIGM — the seed goes THROUGH the same domain primitives the panel uses,
 * not raw hand-rolled crypto: the password is hashed with
 * `@nombaone/sara/auth`'s `hashPassword` (the one place that knows how a
 * password becomes a hash), and after upserting it VERIFIES the result by
 * resolving the operator with the SAME `verifyPassword` check the login flow
 * runs — so a green seed proves the credential actually works end to end.
 *
 * Single database: everything reads `INFRA_DATABASE_URL`. This script only reads
 * the domain + writes the one operator row via Drizzle; it never edits packages.
 */

// Env FIRST — before any `@nombaone/*` import — so the core-db pool singleton +
// PII crypto bind to the configured INFRA_DATABASE_URL / keys.
import './load-env';

import { eq } from 'drizzle-orm';
import { createPoolDb } from '@nombaone/core-db/pool';
import { operatorsTable } from '@nombaone/core-db/schema';
import { hashPassword, verifyPassword } from '@nombaone/sara/auth';

const EMAIL = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'operator@nombaone.local').trim().toLowerCase();
const PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? 'Operator123!';
const NAME = process.env.ADMIN_BOOTSTRAP_NAME ?? 'Local Operator';

async function main(): Promise<void> {
  if (!process.env.INFRA_DATABASE_URL) {
    throw new Error('INFRA_DATABASE_URL is required (see apps/admin/.env.example).');
  }

  const { db, pool } = createPoolDb({ databaseUrl: process.env.INFRA_DATABASE_URL });

  try {
    const passwordHash = await hashPassword(PASSWORD);

    // Upsert by the email unique index: insert, or refresh the existing row's
    // name/role/password on conflict. Deterministic + idempotent.
    const [operator] = await db
      .insert(operatorsTable)
      .values({
        email: EMAIL,
        name: NAME,
        role: 'super_admin',
        passwordHash,
      })
      .onConflictDoUpdate({
        target: operatorsTable.email,
        set: { name: NAME, role: 'super_admin', passwordHash },
      })
      .returning();

    if (!operator) {
      throw new Error('Upsert returned no operator row.');
    }

    // Verify through the SAME readers/crypto the login flow uses: re-fetch by
    // email and re-run verifyPassword. A green seed proves the credential works.
    const [resolved] = await db
      .select()
      .from(operatorsTable)
      .where(eq(operatorsTable.email, EMAIL))
      .limit(1);

    if (!resolved) {
      throw new Error('Verification failed: operator not found after upsert.');
    }
    const ok = await verifyPassword(PASSWORD, resolved.passwordHash);
    if (!ok) {
      throw new Error('Verification failed: password does not verify against the stored hash.');
    }

    console.log('[seed:admin] super_admin operator ready:');
    console.log(`  email    : ${resolved.email}`);
    console.log(`  password : ${PASSWORD}`);
    console.log(`  role     : ${resolved.role}`);
    console.log(`  id       : ${resolved.id}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[seed:admin] failed:', error);
  process.exit(1);
});
