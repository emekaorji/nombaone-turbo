import { jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { updatedAt } from './shared';

/**
 * Key→value platform config: backs the kill-switch / maintenance gate and
 * feature flags. The platform-gate middleware reads this with a TTL cache +
 * in-flight dedup, and fails OPEN if the DB is unreachable.
 */
export const platformConfigTable = pgTable('platform_config', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: updatedAt(),
});

export type PlatformConfigRow = typeof platformConfigTable.$inferSelect;
