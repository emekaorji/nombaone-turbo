/**
 * Side-effecting env loader for the local seed. Imported FIRST (before any
 * `@nombaone/*` import) so `process.env.INFRA_DATABASE_URL` /
 * `INFRA_PII_ENCRYPTION_KEY` are populated before `@nombaone/core-db/pool`
 * evaluates its top-level pool singleton (which reads those eagerly).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const envPath = join(__dirname, '..', '.env');
let raw: string;
try {
  raw = readFileSync(envPath, 'utf8');
} catch {
  throw new Error(`Could not read ${envPath}`);
}
for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!(key in process.env)) process.env[key] = value;
}
