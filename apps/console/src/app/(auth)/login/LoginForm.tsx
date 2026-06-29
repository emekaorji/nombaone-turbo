'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { loginBody } from '@nombaone/core-contracts/validations';
import { Button } from '@nombaone/ui/components/ui/button';

import { TextField } from '@/components/auth/TextField';
import { FormAlert } from '@/components/auth/FormAlert';
import { applyFieldErrors } from '@/components/auth/apply-field-errors';
import { loginAction } from '@/lib/auth-actions';

type LoginValues = z.infer<typeof loginBody>;

/**
 * Login form with the two-factor step modeled as a RESULT VALUE, not an error.
 * The first submit sends email+password; if the action returns
 * `status: 'TOTP_REQUIRED'` we flip to a second step that reveals the 6-digit
 * code field and resubmits the same form (now carrying `totpCode`). A genuine
 * credential failure is a root alert; field issues paint inline. `useTransition`
 * drives the pending state; `?next=` is honoured on success.
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [rootError, setRootError] = useState<string | null>(null);
  const [step, setStep] = useState<'credentials' | 'totp'>('credentials');

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginBody),
    defaultValues: { email: '', password: '', totpCode: undefined },
  });

  const onSubmit = (values: LoginValues) => {
    setRootError(null);
    startTransition(async () => {
      const result = await loginAction(values);
      if (!result.ok) {
        if (!applyFieldErrors(form, result.fields)) setRootError(result.message);
        return;
      }
      if (result.status === 'TOTP_REQUIRED') {
        setStep('totp');
        return;
      }
      const next = params.get('next');
      router.replace(next && next.startsWith('/') ? next : '/');
      router.refresh();
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {rootError ? <FormAlert>{rootError}</FormAlert> : null}

      {step === 'credentials' ? (
        <>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          <div className="space-y-1.5">
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              error={form.formState.errors.password?.message}
              {...form.register('password')}
            />
            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-purple-700 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app.
          </p>
          <TextField
            label="Authentication code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            error={form.formState.errors.totpCode?.message}
            {...form.register('totpCode')}
          />
          <button
            type="button"
            onClick={() => {
              setStep('credentials');
              form.setValue('totpCode', undefined);
              setRootError(null);
            }}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Use a different account
          </button>
        </>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Verifying…' : step === 'totp' ? 'Verify & log in' : 'Log in'}
      </Button>
    </form>
  );
}
