'use server';

import { z } from 'zod';

import {
  loginBody,
  signupBody,
  requestPasswordResetBody,
  resetPasswordBody,
} from '@nombaone/core-contracts/validations';
import { NOMBAONE_ERROR_CODES, type ApiFieldErrors } from '@nombaone/errors';
import {
  loginOrgUser,
  signupOrganization,
  requestPasswordReset,
  resetPassword,
  revokeSession,
} from '@nombaone/sara/auth';
import type { PoolDatabase } from '@nombaone/core-db/pool';

import { db } from './db';
import { txDb } from './db-tx';
import { withAction, fail, ok, type ActionResult } from './actions';
import { setSessionCookie, clearSessionCookie, getSessionToken } from './session';

/**
 * The (auth) route group's server actions. Each validates with the SAME contracts
 * zod schema the form uses (`@nombaone/core-contracts/validations`), maps a zod
 * failure to per-field errors, then delegates to `@nombaone/sara/auth`. On a
 * session-opening success the opaque token is written to the httpOnly cookie
 * here — the only place the console mints the cookie.
 *
 * `loginOrgUser`/`signupOrganization`/`resetPassword` open interactive
 * transactions, so they take the concrete `PoolDatabase` (the `txDb()` handle is
 * one at runtime, typed as the wider `InfraTxDb`; narrow it as the checkout/
 * signup actions do).
 */

/** Map a zod error to the action `fields` shape (field → messages[]). */
function zodFields(error: z.ZodError): ApiFieldErrors {
  const fields: ApiFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/* ── Signup ──────────────────────────────────────────────────────────────── */

export async function signupAction(raw: unknown): Promise<ActionResult> {
  return withAction(async () => {
    const parsed = signupBody.safeParse(raw);
    if (!parsed.success) {
      return fail(
        NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED,
        'Please correct the highlighted fields.',
        zodFields(parsed.error)
      );
    }

    const { token } = await signupOrganization(txDb() as PoolDatabase, parsed.data);
    await setSessionCookie(token);
    return ok(undefined);
  });
}

/* ── Login (two-factor as a RESULT value) ──────────────────────────────────── */

/** Login resolves to one of three outcomes the client switches on. */
export type LoginActionResult =
  | { ok: true; status: 'AUTHENTICATED' }
  | { ok: true; status: 'TOTP_REQUIRED' }
  | { ok: false; code: string; message: string; fields?: ApiFieldErrors };

export async function loginAction(raw: unknown): Promise<LoginActionResult> {
  const result = await withAction<'AUTHENTICATED' | 'TOTP_REQUIRED'>(async () => {
    const parsed = loginBody.safeParse(raw);
    if (!parsed.success) {
      return fail(
        NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED,
        'Please correct the highlighted fields.',
        zodFields(parsed.error)
      );
    }

    const outcome = await loginOrgUser(txDb() as PoolDatabase, parsed.data);

    // The second factor is a NORMAL branch of the protocol, surfaced as a result
    // value (not an error) so the client can render its TOTP step.
    if (outcome.status === 'totp_required') {
      return ok('TOTP_REQUIRED' as const);
    }

    await setSessionCookie(outcome.token);
    return ok('AUTHENTICATED' as const);
  });

  if (!result.ok) return result;
  return { ok: true, status: result.value };
}

/* ── Password reset ─────────────────────────────────────────────────────────── */

export async function requestPasswordResetAction(raw: unknown): Promise<ActionResult> {
  return withAction(async () => {
    const parsed = requestPasswordResetBody.safeParse(raw);
    if (!parsed.success) {
      return fail(
        NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED,
        'Enter a valid email address.',
        zodFields(parsed.error)
      );
    }

    // Enumeration-safe: returns void regardless of whether the email exists.
    // The reset link is delivered out of band (email seam); the console only
    // confirms "if that address exists, a link is on its way".
    await requestPasswordReset(db, parsed.data.email);
    return ok(undefined);
  });
}

export async function resetPasswordAction(raw: unknown): Promise<ActionResult> {
  return withAction(async () => {
    const parsed = resetPasswordBody.safeParse(raw);
    if (!parsed.success) {
      return fail(
        NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED,
        'Please correct the highlighted fields.',
        zodFields(parsed.error)
      );
    }

    await resetPassword(txDb() as PoolDatabase, parsed.data.token, parsed.data.password);
    return ok(undefined);
  });
}

/* ── Sign out ───────────────────────────────────────────────────────────────── */

export async function signOutAction(): Promise<ActionResult> {
  return withAction(async () => {
    const token = await getSessionToken();
    if (token) await revokeSession(db, token);
    await clearSessionCookie();
    return ok(undefined);
  });
}
