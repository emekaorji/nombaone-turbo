import 'server-only';

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import Database from 'better-sqlite3';

/**
 * ── THE GYM'S OWN DATABASE ───────────────────────────────────────────────────
 *
 * Iron Republic is a MERCHANT. It owns its members; NombaOne owns the money. A member
 * here is a row in this file, linked by `customer_id` to a NombaOne customer — which is
 * exactly the shape a real merchant integration takes.
 *
 * ── Why not keep the password in NombaOne's `customer.metadata`? ─────────────
 * It was the obvious idea and it is unsafe, for two reasons I checked in the engine:
 *   1. `customers/serialize.ts` puts `metadata` in the DTO verbatim — so the hash would
 *      be **broadcast in every `customer.created` webhook** we send the merchant.
 *   2. `customers/update.ts` does `patch.metadata = input.metadata` — a REPLACE, not a
 *      merge. The first time a member edited their phone number, their password would be
 *      silently destroyed and they'd be locked out.
 *
 * ── Why not the platform's Postgres? ────────────────────────────────────────
 * This app talks to the engine ONLY through the published SDK. Reaching into
 * `packages/*` would be a thing no real merchant could do, and would make the reference
 * app a liar.
 */

const DB_PATH = resolve(process.cwd(), process.env.GYM_DB_PATH ?? '.data/iron-republic.db');

type GlobalStore = { __gymDb?: Database.Database };
const store = globalThis as unknown as GlobalStore;

export function db(): Database.Database {
  if (store.__gymDb) return store.__gymDb;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  const handle = new Database(DB_PATH);
  handle.pragma('journal_mode = WAL');
  handle.pragma('foreign_keys = ON');

  handle.exec(`
    -- A member of the gym. Linked to their NombaOne customer.
    CREATE TABLE IF NOT EXISTS members (
      id             TEXT PRIMARY KEY,
      email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name           TEXT NOT NULL,
      phone          TEXT,
      password_hash  TEXT NOT NULL,          -- scrypt: salt:hash
      customer_id    TEXT NOT NULL,          -- the NombaOne customer reference
      member_no      TEXT NOT NULL,          -- OUR number (IR-2841). Never a platform id.
      created_at     TEXT NOT NULL
    );

    -- Sign-in sessions. The raw token lives only in the member's cookie; we keep the
    -- SHA-256 of it, so a dump of this file cannot be replayed as a login.
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash  TEXT PRIMARY KEY,
      member_id   TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );

    -- A checkout link we were handed at subscribe time.
    -- The engine returns checkoutLink ONLY on the create response (it is hardcoded
    -- null on every read), so if we don't keep it here, a member who closes Nomba's
    -- payment page can never get back to it. This table is the "Finish joining" button.
    CREATE TABLE IF NOT EXISTS pending_checkouts (
      subscription_id TEXT PRIMARY KEY,
      member_id       TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      checkout_link   TEXT NOT NULL,
      created_at      TEXT NOT NULL
    );

    -- A one-tap link to settle a failed payment.
    -- The SDK has no invoices.pay() and no hosted invoice URL, so the ONLY place a
    -- payable link for a failed charge ever appears is the invoice.action_required
    -- webhook. We capture it there and hand the member an opaque token — never a raw
    -- platform reference in a URL.
    CREATE TABLE IF NOT EXISTS pay_links (
      token        TEXT PRIMARY KEY,
      member_id    TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      invoice_ref  TEXT NOT NULL,
      checkout_link TEXT NOT NULL,
      amount_kobo  INTEGER NOT NULL,
      used_at      TEXT,
      created_at   TEXT NOT NULL
    );

    -- What the gym has told this member. Written by the webhook handler; read by
    -- /account/updates. This is what "we'll let you know" actually means here — we do
    -- not send SMS or email from this app, so we must not claim to.
    CREATE TABLE IF NOT EXISTS notices (
      id         TEXT PRIMARY KEY,
      member_id  TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      kind       TEXT NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Webhook de-duplication. Nomba/the engine may redeliver; a member must not get the
    -- same "Payment received" twice.
    CREATE TABLE IF NOT EXISTS webhook_events (
      event_id    TEXT PRIMARY KEY,
      received_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS members_customer_idx ON members(customer_id);
    CREATE INDEX IF NOT EXISTS notices_member_idx   ON notices(member_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS pay_links_member_idx ON pay_links(member_id, used_at);
  `);

  store.__gymDb = handle;
  return handle;
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
