import 'server-only';

import { AppError } from '@nombaone/errors';

/**
 * Standard result shape for the checkout's server actions — mirrors apps/console's
 * `ActionResult`. The client island branches on `ok`; failures carry a stable
 * `code` (the infra `NombaoneErrorCode` taxonomy) plus a human-readable `message`.
 */
export type ActionResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };

export const ok = <T>(value: T): ActionResult<T> => ({ ok: true, value });

export const fail = (code: string, message: string): ActionResult<never> => ({
  ok: false,
  code,
  message,
});

/**
 * Wraps an action body so a thrown `AppError` becomes a structured
 * `{ ok: false, code, message }` (mapped from the infra taxonomy — never leaked
 * raw), and any other thrown error is logged and collapsed to a generic
 * `internal_error` so a stack trace never reaches the client.
 */
export async function withAction<T>(
  fn: () => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) {
      return fail(err.code, err.message);
    }
    console.error('[checkout action] unhandled error', err);
    return fail('internal_error', 'Something went wrong. Please try again.');
  }
}
