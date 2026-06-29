'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { createApiKeyBody } from '@nombaone/core-contracts/validations';
import { Button } from '@nombaone/ui/components/ui/button';
import { Checkbox } from '@nombaone/ui/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@nombaone/ui/components/ui/dialog';

import { TextField } from '@/components/auth/TextField';
import { FormAlert } from '@/components/auth/FormAlert';
import { applyFieldErrors } from '@/components/auth/apply-field-errors';
import { SecretDialog } from '@/components/developers/SecretDialog';
import { createApiKeyAction } from '@/lib/developer-actions';

type CreateValues = z.infer<typeof createApiKeyBody>;

/** The selectable scopes, mirroring the contracts `apiKeyScope` enum. */
const SCOPES: { value: CreateValues['scopes'][number]; label: string; hint: string }[] = [
  { value: 'example:read', label: 'example:read', hint: 'Read example resources' },
  { value: 'example:write', label: 'example:write', hint: 'Create example resources' },
  { value: 'webhooks:read', label: 'webhooks:read', hint: 'Read webhook config' },
  { value: 'webhooks:write', label: 'webhooks:write', hint: 'Manage webhook config' },
];

/**
 * Create-API-key flow. The form (validated with the SAME `createApiKeyBody`
 * schema the server uses) submits through `createApiKeyAction`; on success the
 * returned secret is handed to `SecretDialog` (shown once, masked + copy) and
 * the route is revalidated so the new key appears in the list. Scopes are a
 * checkbox group bound to the form's array field.
 */
export function CreateApiKeyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rootError, setRootError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const form = useForm<CreateValues>({
    resolver: zodResolver(createApiKeyBody),
    defaultValues: { name: '', scopes: [] },
  });

  const selectedScopes = form.watch('scopes');

  const toggleScope = (value: CreateValues['scopes'][number], checked: boolean) => {
    const next = checked
      ? [...selectedScopes, value]
      : selectedScopes.filter((s) => s !== value);
    form.setValue('scopes', next, { shouldValidate: true });
  };

  const onSubmit = (values: CreateValues) => {
    setRootError(null);
    startTransition(async () => {
      const result = await createApiKeyAction(values);
      if (result.ok) {
        setSecret(result.value.secret);
        setOpen(false);
        form.reset();
        router.refresh();
        return;
      }
      if (!applyFieldErrors(form, result.fields)) setRootError(result.message);
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>Create key</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Choose the scopes this key needs. The secret is shown once, immediately after.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {rootError ? <FormAlert>{rootError}</FormAlert> : null}
            <TextField
              label="Key name"
              placeholder="e.g. Production backend"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Scopes</p>
              <div className="space-y-2 rounded-md border border-border p-3">
                {SCOPES.map((scope) => (
                  <label key={scope.value} className="flex items-start gap-2.5">
                    <Checkbox
                      checked={selectedScopes.includes(scope.value)}
                      onCheckedChange={(c) => toggleScope(scope.value, c === true)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block font-mono text-xs text-foreground">{scope.label}</span>
                      <span className="block text-xs text-muted-foreground">{scope.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              {form.formState.errors.scopes ? (
                <p className="text-xs text-error-600">Select at least one scope.</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? 'Creating…' : 'Create key'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SecretDialog
        open={secret !== null}
        secret={secret}
        title="Your new API key"
        description="Copy this secret now — it's shown only once and can't be retrieved again. If you lose it, rotate the key."
        onClose={() => {
          setSecret(null);
          toast.success('API key created.');
        }}
      />
    </>
  );
}
