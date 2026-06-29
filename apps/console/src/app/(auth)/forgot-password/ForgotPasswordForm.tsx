'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { requestPasswordResetBody } from '@nombaone/core-contracts/validations';
import { Button } from '@nombaone/ui/components/ui/button';

import { TextField } from '@/components/auth/TextField';
import { FormAlert } from '@/components/auth/FormAlert';
import { applyFieldErrors } from '@/components/auth/apply-field-errors';
import { requestPasswordResetAction } from '@/lib/auth-actions';

type ForgotValues = z.infer<typeof requestPasswordResetBody>;

/**
 * Request-reset form. Enumeration-safe: on success we always show the same
 * "if that address exists, a link is on its way" notice regardless of whether
 * the email is registered, mirroring the domain's no-enumeration contract.
 */
export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [rootError, setRootError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotValues>({
    resolver: zodResolver(requestPasswordResetBody),
    defaultValues: { email: '' },
  });

  const onSubmit = (values: ForgotValues) => {
    setRootError(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction(values);
      if (result.ok) {
        setSent(true);
        return;
      }
      if (!applyFieldErrors(form, result.fields)) setRootError(result.message);
    });
  };

  if (sent) {
    return (
      <FormAlert tone="success">
        If an account exists for that email, a password-reset link is on its way. Check your inbox.
      </FormAlert>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {rootError ? <FormAlert>{rootError}</FormAlert> : null}
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        error={form.formState.errors.email?.message}
        {...form.register('email')}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
