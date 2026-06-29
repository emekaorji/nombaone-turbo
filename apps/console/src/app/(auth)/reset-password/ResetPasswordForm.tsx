'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { resetPasswordBody } from '@nombaone/core-contracts/validations';
import { Button } from '@nombaone/ui/components/ui/button';

import { TextField } from '@/components/auth/TextField';
import { FormAlert } from '@/components/auth/FormAlert';
import { applyFieldErrors } from '@/components/auth/apply-field-errors';
import { resetPasswordAction } from '@/lib/auth-actions';

type ResetValues = z.infer<typeof resetPasswordBody>;

/**
 * Set-new-password form. The single-use `token` comes from the URL (hidden,
 * pre-filled); the user supplies the new password. On success we toast via the
 * success alert and send them to /login to sign in with the new credentials.
 * An invalid/expired/used token surfaces as a root alert (the domain returns one
 * generic AUTH_RESET_TOKEN_INVALID — no detail about which condition failed).
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rootError, setRootError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetPasswordBody),
    defaultValues: { token, password: '' },
  });

  const onSubmit = (values: ResetValues) => {
    setRootError(null);
    startTransition(async () => {
      const result = await resetPasswordAction(values);
      if (result.ok) {
        setDone(true);
        setTimeout(() => router.replace('/login'), 1200);
        return;
      }
      if (!applyFieldErrors(form, result.fields)) setRootError(result.message);
    });
  };

  if (!token) {
    return (
      <FormAlert>
        This reset link is missing its token. Request a new link from the reset page.
      </FormAlert>
    );
  }

  if (done) {
    return <FormAlert tone="success">Password updated. Redirecting you to log in…</FormAlert>;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {rootError ? <FormAlert>{rootError}</FormAlert> : null}
      <input type="hidden" {...form.register('token')} />
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        autoFocus
        error={form.formState.errors.password?.message}
        {...form.register('password')}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}
