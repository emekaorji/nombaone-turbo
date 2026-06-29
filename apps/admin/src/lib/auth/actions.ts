'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';

import { actionError, actionOk, runAction, type ActionResult } from '@/lib/action-helpers';
import { OPERATOR_COOKIE, operatorCookieOptions } from '@/lib/auth/operator';
import { loginOperator } from '@/lib/auth/login';

/**
 * Operator auth server actions. `signInAction` validates the form, calls the
 * login flow, and returns an `ActionResult` the client form switches on —
 * `totp_required` surfaces as a `needsTotp` flag (a result, not an error) so the
 * form reveals its code step. `signOutAction` clears the cookie.
 */

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
  totpCode: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type SignInData = { needsTotp: boolean };

export async function signInAction(
  raw: unknown
): Promise<ActionResult<SignInData>> {
  return runAction<SignInData>(async () => {
    const parsed = signInSchema.safeParse(raw);
    if (!parsed.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string') (fields[key] ??= []).push(issue.message);
      }
      return actionError('validation_failed', 'Please check the form.', fields);
    }

    const result = await loginOperator(parsed.data);
    switch (result.status) {
      case 'ok':
        return actionOk({ needsTotp: false });
      case 'totp_required':
        return actionOk({ needsTotp: true });
      case 'invalid':
        return actionError('invalid_credentials', 'Invalid email, password, or code.');
    }
  });
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  store.set(OPERATOR_COOKIE, '', operatorCookieOptions(0));
}
