import 'server-only';

import { revalidatePath } from 'next/cache';

import { OperatorAuthError } from '@/lib/auth/operator';

/**
 * PARADIGM — `ActionResult<T>` + `withRevalidation()` as THE action convention.
 *
 * Every server action in the panel returns a discriminated union the caller
 * switches on, NOT a thrown error the UI must try/catch and not a bare value:
 *
 *   { ok: true;  data: T }
 *   { ok: false; code: string; message: string; fields?: Record<string,string[]> }
 *
 * This makes the failure path a first-class value a client island can render
 * (toast + inline field errors) without an error boundary. `runAction` wraps an
 * action body so domain throws are normalized into the `ok:false` shape:
 *   • `OperatorAuthError`  → `unauthorized` / `forbidden`
 *   • a sara `AppError`    → its public code + message + field errors, detected
 *     STRUCTURALLY (admin does not depend on `@nombaone/errors`; the thrown
 *     error carries `code` + numeric `status` + optional `fieldErrors`)
 *   • anything else        → a generic `internal_error` (no internals leaked)
 *
 * `withRevalidation` runs the action, and on success revalidates the given
 * path(s) so the affected RSC reads re-render with fresh data — the standard
 * "mutate then refresh" step folded into one call.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; fields?: Record<string, string[]> };

export const actionOk = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const actionError = (
  code: string,
  message: string,
  fields?: Record<string, string[]>
): ActionResult<never> => ({ ok: false, code, message, fields });

type AppErrorLike = Error & {
  code: string;
  status: number;
  fieldErrors?: Record<string, string[]>;
};

/** Structural detection of a sara `AppError` without importing the class. */
function isAppErrorLike(error: unknown): error is AppErrorLike {
  return (
    error instanceof Error &&
    typeof (error as Partial<AppErrorLike>).code === 'string' &&
    typeof (error as Partial<AppErrorLike>).status === 'number'
  );
}

/**
 * Normalize a thrown error into the `ok:false` branch. Keeps the failure
 * taxonomy in one place so every action fails the same shape.
 */
function normalizeError(error: unknown): Extract<ActionResult, { ok: false }> {
  if (error instanceof OperatorAuthError) {
    return {
      ok: false,
      code: error.code,
      message: error.message,
    };
  }
  if (isAppErrorLike(error)) {
    return {
      ok: false,
      code: error.code,
      message: error.message,
      fields: error.fieldErrors,
    };
  }
  return {
    ok: false,
    code: 'internal_error',
    message: 'Something went wrong. Please try again.',
  };
}

/**
 * Run an action body, returning its `ActionResult` and normalizing any throw
 * into the `ok:false` branch. Actions write their happy path with `actionOk` /
 * `actionError` and let domain guards throw; this catches and shapes them.
 */
export async function runAction<T>(
  body: () => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  try {
    return await body();
  } catch (error) {
    return normalizeError(error);
  }
}

/**
 * Run an action and, ON SUCCESS, revalidate the supplied path(s) so the
 * affected server-rendered reads refresh. A failure does not revalidate (the
 * data did not change). This is the canonical "mutate then refresh" wrapper.
 */
export async function withRevalidation<T>(
  paths: string | readonly string[],
  body: () => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  const result = await runAction(body);
  if (result.ok) {
    for (const path of typeof paths === 'string' ? [paths] : paths) {
      revalidatePath(path);
    }
  }
  return result;
}
