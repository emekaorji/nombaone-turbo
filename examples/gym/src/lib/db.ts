import 'server-only';

import { createClient, type Client, type InArgs } from '@libsql/client';

/**
 * ── THE GYM'S OWN DATABASE ───────────────────────────────────────────────────
 *
 * Iron Republic is a MERCHANT. It owns its members; NombaOne owns the money. A member here is a row
 * in this database, linked by `customer_id` to a NombaOne customer — which is exactly the shape a
 * real merchant integration takes.
 *
 * ── Why not keep the password in NombaOne's `customer.metadata`? ─────────────
 * It was the obvious idea and it is unsafe, for two reasons I checked in the engine:
 *   1. `customers/serialize.ts` puts `metadata` in the DTO verbatim — so the hash would be
 *      BROADCAST in every `customer.created` webhook we send the merchant.
 *   2. `customers/update.ts` does `patch.metadata = input.metadata` — a REPLACE, not a merge. The
 *      first time a member edited their phone number their password would be silently destroyed and
 *      they would be locked out.
 *
 * ── Why not the platform's Postgres? ────────────────────────────────────────
 * This app talks to the engine ONLY through the published SDK. Reaching into `packages/*` would be
 * something no real merchant could do, and would make the reference app a liar.
 *
 * ── Why Turso, and not the local SQLite file this used to be? ────────────────
 * The file was fine on a laptop and fatal in production. Members, password hashes, sessions,
 * pay-links and the webhook-dedupe table all lived in `.data/iron-republic.db`, and a deployed
 * container's disk is ephemeral: every redeploy or cold start would silently reset the gym's entire
 * membership. Worse, on a read-only filesystem the very first request would throw trying to create
 * the directory, and horizontally you would get one database PER INSTANCE — a member who signed up
 * on one and signed in on another would simply not exist.
 *
 * Turso is the same SQLite, kept somewhere that survives a deploy. The cost is that libSQL is
 * ASYNC where better-sqlite3 was synchronous, so every read and write below is awaited.
 */

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_SECRET;

type GlobalStore = { __gymDb?: Client; __gymSchema?: Promise<void> };
const store = globalThis as unknown as GlobalStore;

function client(): Client {
  if (store.__gymDb) return store.__gymDb;

  // Fail loudly and immediately. A gym that boots without a database and only discovers it when the
  // first member tries to sign up has already lost that member.
  if (!url) throw new Error('DATABASE_URL is not set — the gym has nowhere to keep its members.');
  if (!authToken) throw new Error('DATABASE_SECRET is not set — Turso will refuse every query.');

  store.__gymDb = createClient({ url, authToken });
  return store.__gymDb;
}

const SCHEMA: string[] = [
  // A member of the gym. Linked to their NombaOne customer.
  `CREATE TABLE IF NOT EXISTS members (
     id             TEXT PRIMARY KEY,
     email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
     name           TEXT NOT NULL,
     phone          TEXT,
     password_hash  TEXT NOT NULL,          -- scrypt: salt:hash
     customer_id    TEXT NOT NULL,          -- the NombaOne customer reference
     member_no      TEXT NOT NULL,          -- OUR number (IR-2841). Never a platform id.
     created_at     TEXT NOT NULL
   )`,

  // Sign-in sessions. The raw token lives only in the member's cookie; we keep the SHA-256 of it,
  // so a dump of this database cannot be replayed as a login.
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash  TEXT PRIMARY KEY,
     member_id   TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
     expires_at  TEXT NOT NULL,
     created_at  TEXT NOT NULL
   )`,

  // A checkout link we were handed at subscribe time. The engine returns `checkoutLink` ONLY on the
  // create response (it is hardcoded null on every read), so without this a member who closes
  // Nomba's payment page could never get back to it. This table is the "Finish joining" button.
  `CREATE TABLE IF NOT EXISTS pending_checkouts (
     subscription_id TEXT PRIMARY KEY,
     member_id       TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
     checkout_link   TEXT NOT NULL,
     created_at      TEXT NOT NULL
   )`,

  // A one-tap link to settle a failed payment. The SDK has no invoices.pay() and no hosted invoice
  // URL, so the ONLY place a payable link for a failed charge ever appears is the
  // `invoice.action_required` webhook. We capture it there and hand the member an opaque token —
  // never a raw platform reference in a URL.
  `CREATE TABLE IF NOT EXISTS pay_links (
     token         TEXT PRIMARY KEY,
     member_id     TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
     invoice_ref   TEXT NOT NULL,
     checkout_link TEXT NOT NULL,
     amount_kobo   INTEGER NOT NULL,
     used_at       TEXT,
     created_at    TEXT NOT NULL
   )`,

  // What the gym has told this member. Written by the webhook handler; read by /account/updates.
  // This is what "we'll let you know" actually means here — we do not send SMS or email from this
  // app, so we must not claim to.
  `CREATE TABLE IF NOT EXISTS notices (
     id         TEXT PRIMARY KEY,
     member_id  TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
     kind       TEXT NOT NULL,
     title      TEXT NOT NULL,
     body       TEXT NOT NULL,
     created_at TEXT NOT NULL
   )`,

  // Webhook de-duplication. The engine may redeliver; a member must not be told "Payment received"
  // twice for one payment.
  `CREATE TABLE IF NOT EXISTS webhook_events (
     event_id    TEXT PRIMARY KEY,
     received_at TEXT NOT NULL
   )`,

  `CREATE INDEX IF NOT EXISTS members_customer_idx ON members(customer_id)`,
  `CREATE INDEX IF NOT EXISTS notices_member_idx   ON notices(member_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS pay_links_member_idx ON pay_links(member_id, used_at)`,
];

/**
 * Bring the schema up ONCE per process, and make every query wait on that one attempt.
 *
 * Memoized on the PROMISE, not on a boolean: several requests can arrive before the first one has
 * finished creating the tables, and a boolean would let the second through against a database that
 * does not have them yet. A failure is not cached — the next request retries rather than inheriting
 * a permanently broken process.
 */
function ready(): Promise<void> {
  store.__gymSchema ??= (async () => {
    const c = client();
    await c.execute('PRAGMA foreign_keys = ON');
    for (const statement of SCHEMA) await c.execute(statement);
  })().catch((error: unknown) => {
    store.__gymSchema = undefined;
    throw error;
  });
  return store.__gymSchema;
}

/** One row, or undefined. */
export async function get<T>(sql: string, ...args: unknown[]): Promise<T | undefined> {
  await ready();
  const result = await client().execute({ sql, args: args as InArgs });
  return result.rows[0] as T | undefined;
}

/** Every row. */
export async function all<T>(sql: string, ...args: unknown[]): Promise<T[]> {
  await ready();
  const result = await client().execute({ sql, args: args as InArgs });
  return result.rows as unknown as T[];
}

/**
 * A write. Returns the number of rows it actually changed.
 *
 * The count is load-bearing, not decoration: the webhook handler claims an event id with
 * `INSERT OR IGNORE` and treats "0 rows changed" as "someone already handled this". That is what
 * stops an at-least-once redelivery telling a member "Payment received" twice for one payment.
 */
export async function run(sql: string, ...args: unknown[]): Promise<number> {
  await ready();
  const result = await client().execute({ sql, args: args as InArgs });
  return result.rowsAffected;
}

export interface MemberRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  password_hash: string;
  customer_id: string;
  member_no: string;
  created_at: string;
}
