import 'server-only';

import { revalidatePath } from 'next/cache';

import { AppError, type ApiFieldErrors } from '@nombaone/errors';

/**
 * PARADIGM — the ONE server-action result shape. Every console mutation returns
 * `ActionResult`, a discriminated union the client island switches on:
 *
 *   { ok: true }                                  → success (optionally a value)
 *   { ok: false; code; message; fields? }         → failure
 *
 * `fields` carries per-field validation errors (zod issues, mapped to the form's
 * field names) so react-hook-form can paint them inline; a non-field failure
 * shows `message` in a root alert. The `code` is the stable
 * `@nombaone/errors` taxonomy — never a raw stack — so the client can branch
 * without string-matching messages.
 */
export type ActionResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string; fields?: ApiFieldErrors };

export const ok = <T = undefined>(value: T): ActionResult<T> => ({ ok: true, value });

export const fail = (
  code: string,
  message: string,
  fields?: ApiFieldErrors
): ActionResult<never> => ({ ok: false, code, message, fields });

/**
 * Wrap an action body so a thrown `AppError` becomes a structured
 * `{ ok:false, code, message, fields? }` (mapped from the taxonomy — never
 * leaked raw), and any other throw is logged and collapsed to a generic
 * `internal_error` so a stack trace never reaches the client. The body may also
 * return its own `fail(...)` for expected, non-exceptional failures.
 *
 * `revalidate` paths are revalidated only on success, so a failed mutation never
 * busts a cache for nothing.
 */
export async function withAction<T>(
  fn: () => Promise<ActionResult<T>>,
  options: { revalidate?: string | string[] } = {}
): Promise<ActionResult<T>> {
  let result: ActionResult<T>;
  try {
    result = await fn();
  } catch (err) {
    if (err instanceof AppError) {
      result = fail(err.code, err.message, err.fieldErrors);
    } else {
      console.error('[console action] unhandled error', err);
      result = fail('internal_error', 'Something went wrong. Please try again.');
    }
  }

  if (result.ok && options.revalidate) {
    const paths = Array.isArray(options.revalidate) ? options.revalidate : [options.revalidate];
    for (const path of paths) revalidatePath(path);
  }

  return result;
}
