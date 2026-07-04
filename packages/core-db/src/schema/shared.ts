import { sql } from 'drizzle-orm';
import { pgEnum, timestamp, uuid, text } from 'drizzle-orm/pg-core';

/**
 * Shared column conventions. Reuse these so every table looks the same:
 * a UUID PK, a public `reference` (unique), a first-class `mode`, and
 * append-only timestamps.
 */

/** sandbox | live — a first-class column on every tenant-scoped row. */
export const modeEnum = pgEnum('mode', ['sandbox', 'live']);

/** Internal UUID primary key. Never leaves the backend. */
export const idPk = () => uuid('id').primaryKey().defaultRandom();

/**
 * The public, merchant-facing identifier (the API `id`), distinct from the UUID
 * PK. Minted in the domain (`@nombaone/sara/reference`); a UNIQUE index is the
 * ONLY collision handling — no app-level retry loop.
 */
export const referenceCol = () => text('reference').notNull();

export const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date());
