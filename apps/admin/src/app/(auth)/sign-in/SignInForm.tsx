'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@nombaone/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@nombaone/ui/components/ui/card';
import { Input } from '@nombaone/ui/components/ui/input';
import { Label } from '@nombaone/ui/components/ui/label';

import { signInAction } from '@/lib/auth/actions';

/**
 * Operator sign-in form. Models the second factor as a RESULT, not an error: a
 * `needsTotp` action result reveals the TOTP step instead of failing. Field
 * errors from the action map back onto inputs; a root failure shows a toast.
 * `useTransition` drives the pending state on submit.
 */
export function SignInForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [needsTotp, setNeedsTotp] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
      totpCode: data.get('totpCode') ? String(data.get('totpCode')) : undefined,
    };

    startTransition(async () => {
      setFieldErrors({});
      const result = await signInAction(payload);
      if (!result.ok) {
        if (result.fields) setFieldErrors(result.fields);
        toast.error(result.message);
        return;
      }
      if (result.data.needsTotp) {
        setNeedsTotp(true);
        toast.message('Enter the 6-digit code from your authenticator app.');
        return;
      }
      toast.success('Signed in.');
      router.replace('/');
      router.refresh();
    });
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Operator sign-in</CardTitle>
        <CardDescription>Authenticate to access the operator console.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              disabled={needsTotp}
              aria-invalid={Boolean(fieldErrors.email)}
            />
            {fieldErrors.email ? (
              <p className="text-xs text-red-600">{fieldErrors.email[0]}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={needsTotp}
              aria-invalid={Boolean(fieldErrors.password)}
            />
            {fieldErrors.password ? (
              <p className="text-xs text-red-600">{fieldErrors.password[0]}</p>
            ) : null}
          </div>

          {needsTotp ? (
            <div className="space-y-1.5">
              <Label htmlFor="totpCode">Authenticator code</Label>
              <Input
                id="totpCode"
                name="totpCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                autoFocus
                required
              />
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Signing in…' : needsTotp ? 'Verify code' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
