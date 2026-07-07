import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, idPk, modeEnum } from './shared';
import { apiKeysTable } from './api-keys';
import { organizationsTable } from './organizations';

/**
 * The first-party console's own API key for calling `apps/api` on a merchant's
 * behalf (engine writes). The console is trusted — it authenticates the user
 * session and knows the validated org+mode — so it mints ONE dedicated API key
 * per (organization, mode) via the normal key path, then stores the otherwise
 * once-only secret ENCRYPTED here (AES via INFRA_PII_ENCRYPTION_KEY, same as PII)
 * so it can re-authenticate on every write without re-minting. Deleting the row
 * (or revoking the key) forces a fresh mint on next use.
 */
export const orgBridgeCredentialsTable = pgTable(
  'org_bridge_credentials',
  {
    id: idPk(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull(),
    apiKeyId: uuid('api_key_id')
      .notNull()
      .references(() => apiKeysTable.id, { onDelete: 'cascade' }),
    secretEncrypted: text('secret_encrypted').notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    orgModeUnique: uniqueIndex('org_bridge_credentials_org_mode_unique').on(table.organizationId, table.mode),
  })
);

export type OrgBridgeCredentialRow = typeof orgBridgeCredentialsTable.$inferSelect;
export type OrgBridgeCredentialInsert = typeof orgBridgeCredentialsTable.$inferInsert;
