import { NextResponse } from 'next/server';

import { recordFeedback } from '@/lib/feedback';

/**
 * "Was this page helpful?" sink. The `<Feedback>` island POSTs one click here;
 * we validate the shape, write a row into the dedicated docs analytics database
 * (NOT the financial DB), and reply `{ success: true }`.
 *
 * Failure is silent by design: the widget never blocks reading the docs, so on
 * any error we return a generic 500 WITHOUT leaking internals (no DB strings,
 * no stack). `runtime = "nodejs"` keeps the Neon HTTP driver on a stable runtime.
 */

export const runtime = 'nodejs';

interface FeedbackRequest {
  pageSlug?: unknown;
  helpful?: unknown;
  anonymousId?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  let payload: FeedbackRequest;
  try {
    payload = (await request.json()) as FeedbackRequest;
  } catch {
    return error(400, 'INVALID_REQUEST', 'Request body must be valid JSON.');
  }

  const { pageSlug, helpful, anonymousId } = payload;

  if (typeof pageSlug !== 'string' || pageSlug.length === 0) {
    return error(422, 'INVALID_PAGE_SLUG', '`pageSlug` must be a non-empty string.');
  }
  if (typeof helpful !== 'boolean') {
    return error(422, 'INVALID_HELPFUL', '`helpful` must be a boolean.');
  }

  try {
    await recordFeedback({
      pageSlug,
      helpful,
      anonymousId: typeof anonymousId === 'string' && anonymousId ? anonymousId : null,
    });
    return NextResponse.json({ success: true });
  } catch {
    // Never leak DB/internal details to the public docs.
    return error(500, 'FEEDBACK_FAILED', 'Could not record feedback.');
  }
}

/** Uniform error envelope (mirrors the playground proxy's shape). */
function error(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, message, data: null, error: { status, code } },
    { status }
  );
}
