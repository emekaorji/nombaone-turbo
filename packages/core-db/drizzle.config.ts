import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFilePath);
const workspaceRoot = resolve(currentDirectory, '../..');

/**
 * ── WHICH DATABASE DOES A MIGRATION GO TO? ───────────────────────────────────
 *
 * THIS package's `.env` is the answer, and it is consulted FIRST.
 *
 * It did not used to be on the list at all. The candidates started at the repo root, dotenv is
 * `override: false` (first file to define a key wins), and the root `.env` defines
 * `INFRA_DATABASE_URL` — so `INFRA_DATABASE_URL` was pinned to the ROOT's database before this
 * package's own `.env` was even looked at. It was never looked at: it was not a candidate.
 *
 * The result was the worst kind of failure — a silent one. `pnpm db:migrate`, run from inside this
 * very directory, against a `.env` sitting right next to it naming the production database, migrated
 * a completely different database and reported success. Production received nothing, for as long as
 * the two files disagreed, and nothing anywhere said so.
 *
 * So: this package's `.env` leads. A file that lives next to the migrations decides where the
 * migrations go. And the resolved host is ECHOED below, every run — a migration is the one operation
 * where "which database am I talking to?" must never be something you have to infer.
 */
const envFileCandidates = [
  resolve(currentDirectory, '.env'),
  resolve(currentDirectory, '.env.local'),
  resolve(workspaceRoot, '.env'),
  resolve(workspaceRoot, '.env.local'),
  resolve(workspaceRoot, 'apps/api/.env'),
  resolve(workspaceRoot, 'apps/api/.env.local'),
];

for (const envFilePath of envFileCandidates) {
  if (existsSync(envFilePath)) {
    config({ path: envFilePath, override: false });
  }
}

if (!process.env.INFRA_DATABASE_URL) {
  throw new Error('`INFRA_DATABASE_URL` environment variable is required');
}

/**
 * Migrations must NOT run over Neon's connection pooler.
 *
 * The `-pooler` host is PgBouncer in transaction mode. It multiplexes statements across backend
 * connections, so anything that depends on session state — advisory locks, `SET`, prepared
 * statements, a DDL batch expected to share one session — is not safe there. A migration is exactly
 * that kind of workload, and the failure is not a clean error: it is a HALF-APPLIED schema, which is
 * far harder to recover from than a refusal.
 *
 * Neon's direct endpoint is the same host with `-pooler` removed. Rewriting it here means you cannot
 * forget; set `INFRA_MIGRATE_DATABASE_URL` explicitly if you ever need to override that.
 */
const configuredUrl = process.env.INFRA_MIGRATE_DATABASE_URL ?? process.env.INFRA_DATABASE_URL;
const migrationUrl = configuredUrl.replace('-pooler.', '.');

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return '<unparseable>';
  }
};

// Say it out loud. Every run, before a single statement is sent.
console.info(
  `[drizzle] migrating → ${hostOf(migrationUrl)}` +
    (migrationUrl === configuredUrl ? '' : `  (direct endpoint; ${hostOf(configuredUrl)} is pooled)`)
);

const drizzleConfig = defineConfig({
  schema: './src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: migrationUrl,
  },
  verbose: process.env.NODE_ENV !== 'production',
  strict: true,
  out: './migrations',
});

export default drizzleConfig;
