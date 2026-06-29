import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFilePath);
const workspaceRoot = resolve(currentDirectory, '../..');
const envFileCandidates = [
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

const drizzleConfig = defineConfig({
  schema: './src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.INFRA_DATABASE_URL,
  },
  verbose: process.env.NODE_ENV !== 'production',
  strict: true,
  out: './migrations',
});

export default drizzleConfig;
