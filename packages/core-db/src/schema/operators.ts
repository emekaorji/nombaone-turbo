import { index, integer, pgEnum, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

import { createdAt, idPk } from './shared';

export const operatorRoleEnum = pgEnum('operator_role', [
  'super_admin',
  'operator',
  'support',
  'viewer',
]);
export type OperatorRole = (typeof operatorRoleEnum.enumValues)[number];

/**
 * Platform operator (internal staff for the admin panel). `token_version` backs
 * instant JWT revocation: bump it and every outstanding operator JWT is invalid.
 */
export const operatorsTable = pgTable(
  'operators',
  {
    id: idPk(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: operatorRoleEnum('role').notNull().default('viewer'),
    passwordHash: text('password_hash').notNull(),
    totpSecretEncrypted: text('totp_secret_encrypted'),
    tokenVersion: integer('token_version').notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => ({
    emailUnique: uniqueIndex('operators_email_unique').on(table.email),
  })
);
export type OperatorRow = typeof operatorsTable.$inferSelect;

/** An audit row is written on every privileged operator mutation. Append-only. */
export const adminAuditLogTable = pgTable(
  'admin_audit_log',
  {
    id: idPk(),
    operatorId: text('operator_id').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetReference: text('target_reference'),
    summary: text('summary').notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    createdIdx: index('admin_audit_log_created_idx').on(table.createdAt),
  })
);
export type AdminAuditLogRow = typeof adminAuditLogTable.$inferSelect;

export const operatorThemeEnum = pgEnum('operator_theme', ['light', 'dark', 'system']);
export const operatorDensityEnum = pgEnum('operator_density', ['compact', 'cozy', 'comfortable']);

/** Per-operator UI preferences. Staff default environment is `live` (a preference,
 * NOT authority — reads always re-filter server-side). */
export const operatorPreferencesTable = pgTable('operator_preferences', {
  id: idPk(),
  operatorId: text('operator_id').notNull().unique(),
  theme: operatorThemeEnum('theme').notNull().default('system'),
  density: operatorDensityEnum('density').notNull().default('cozy'),
  defaultEnvironment: text('default_environment').notNull().default('live'),
  createdAt: createdAt(),
});
export type OperatorPreferencesRow = typeof operatorPreferencesTable.$inferSelect;
