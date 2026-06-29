import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * "Was this page helpful?" feedback, one row per click.
 *
 * This table lives in a DEDICATED docs database (its own Neon instance, read
 * from `DOCS_DATABASE_URL`), deliberately isolated from the financial
 * `@nombaone/core-db`, so public docs traffic never touches money data.
 *
 * `anonymousId` is a browser-local UUID (localStorage), nullable because the
 * server never blocks a write on it. The `(pageSlug, createdAt desc)` index
 * serves the only query we care about: "recent helpful/not-helpful for a page".
 */
export const docsPageFeedback = pgTable(
  'docs_page_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    pageSlug: text('page_slug').notNull(),
    helpful: boolean('helpful').notNull(),
    anonymousId: text('anonymous_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    pageCreatedIdx: index('docs_page_feedback_page_created_idx').on(
      table.pageSlug,
      table.createdAt.desc(),
    ),
  }),
);

/** The full schema object, passed to the Drizzle client. */
export const schema = { docsPageFeedback };
