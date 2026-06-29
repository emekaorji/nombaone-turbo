# `@nombaone/core-db`

`@nombaone/core-db` owns the Nombaone **infra** database boundary. It is an isolated sibling of `@nombaone/db` so infra tables, migrations, and connection pools never mix with the product database.

It contains:

- Drizzle tables in `src/schema/*`
- the schema barrel in `src/schema.ts`
- pooled and serverless clients
- `drizzle.config.ts` and migrations

Import by job:

```ts
import { db, pool } from '@nombaone/core-db/pool';
import { db as edgeDb } from '@nombaone/core-db/serverless';
import { schema } from '@nombaone/core-db/schema';
```

Use `@nombaone/core-db/pool` for long-lived Node services like `apps/api`.
Use `@nombaone/core-db/serverless` for Next/serverless runtimes.

This package reads `INFRA_DATABASE_URL` (not `DATABASE_URL`) so the two databases stay strictly separate.

Common commands:

```bash
pnpm --filter @nombaone/core-db db:generate
pnpm --filter @nombaone/core-db db:migrate
pnpm --filter @nombaone/core-db db:check
pnpm --filter @nombaone/core-db db:drop
pnpm --filter @nombaone/core-db db:studio
```

When adding a table:

1. add the file under `src/schema`
2. re-export it from `src/schema/index.ts`
3. expose a package subpath in `package.json` if callers need one
4. generate the migration
5. add `insert` and `select` types in `@nombaone/contracts/types` (if shared with other consumers)
