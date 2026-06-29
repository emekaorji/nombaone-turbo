import { getDb } from '@nombaone/docs-db/serverless';
import { docsPageFeedback } from '@nombaone/docs-db/schema';

/**
 * The DB seam for "Was this page helpful?": the single place that writes a
 * feedback row into the dedicated docs database. The route handler calls this;
 * nothing else touches the table.
 */
export interface FeedbackInput {
  pageSlug: string;
  helpful: boolean;
  anonymousId: string | null;
}

/** Insert one feedback row. Throws on a DB error; the caller swallows it. */
export async function recordFeedback(input: FeedbackInput): Promise<void> {
  await getDb().insert(docsPageFeedback).values({
    pageSlug: input.pageSlug,
    helpful: input.helpful,
    anonymousId: input.anonymousId,
  });
}
