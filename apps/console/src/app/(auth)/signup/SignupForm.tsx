'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { signupBody } from '@nombaone/core-contracts/validations';
import { Button } from '@nombaone/ui/components/ui/button';

import { TextField } from '@/components/auth/TextField';
import { FormAlert } from '@/components/auth/FormAlert';
import { signupAction } from '@/lib/auth-actions';
import { applyFieldErrors } from '@/components/auth/apply-field-errors';

type SignupValues = z.infer<typeof signupBody>;

/**
 * Atomic-signup form. Validates with the SAME `signupBody` schema the server
 * uses (zodResolver), submits through `signupAction` inside a `useTransition`
 * (pending state), maps any returned `fields` back onto the form via
 * `setError`, and shows non-field failures in a root alert. On success the
 * session cookie is already set server-side, so we push to the overview.
 */
export function SignupForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rootError, setRootError] = useState<string | null>(null);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupBody),
    defaultValues: { organizationName: '', name: '', email: '', password: '' },
  });

  const onSubmit = (values: SignupValues) => {
    setRootError(null);
    startTransition(async () => {
      const result = await signupAction(values);
      if (result.ok) {
        router.replace('/');
        router.refresh();
        return;
      }
      if (!applyFieldErrors(form, result.fields)) {
        setRootError(result.message);
      }
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {rootError ? <FormAlert>{rootError}</FormAlert> : null}
      <TextField
        label="Organization name"
        autoComplete="organization"
        error={form.formState.errors.organizationName?.message}
        {...form.register('organizationName')}
      />
      <TextField
        label="Your name"
        autoComplete="name"
        error={form.formState.errors.name?.message}
        {...form.register('name')}
      />
      <TextField
        label="Work email"
        type="email"
        autoComplete="email"
        error={form.formState.errors.email?.message}
        {...form.register('email')}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="new-password"
        error={form.formState.errors.password?.message}
        {...form.register('password')}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Creating…' : 'Create organization'}
      </Button>
    </form>
  );
}
