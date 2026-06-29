'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@nombaone/ui/components/ui/button';
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
import { createWebhookEndpointAction } from '@/lib/developer-actions';

interface FormValues {
  url: string;
  events: string;
}

/**
 * Create-webhook-endpoint flow. The endpoint URL + a comma-separated event
 * subscription (defaulting to `*` = all) are submitted through
 * `createWebhookEndpointAction`; the server validates with the contracts schema.
 * On success the signing secret is surfaced ONCE via `SecretDialog` — the tenant
 * verifies deliveries with it and it's never recoverable after.
 */
export function CreateWebhookDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rootError, setRootError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const form = useForm<FormValues>({ defaultValues: { url: '', events: '*' } });

  const onSubmit = (values: FormValues) => {
    setRootError(null);
    const enabledEvents = values.events
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    startTransition(async () => {
      const result = await createWebhookEndpointAction({
        url: values.url,
        enabledEvents: enabledEvents.length > 0 ? enabledEvents : ['*'],
      });
      if (result.ok) {
        setSecret(result.value.signingSecret);
        setOpen(false);
        form.reset();
        router.refresh();
        return;
      }
      // Map server field errors; the contracts schema field is `url` /
      // `enabledEvents`, so route the latter onto the `events` text field.
      if (result.fields?.url) {
        form.setError('url', { type: 'server', message: result.fields.url[0] });
      } else if (result.fields?.enabledEvents) {
        form.setError('events', { type: 'server', message: result.fields.enabledEvents[0] });
      } else if (!applyFieldErrors(form, result.fields)) {
        setRootError(result.message);
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>Add endpoint</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add webhook endpoint</DialogTitle>
            <DialogDescription>
              We&apos;ll POST HMAC-signed events to this URL. The signing secret is shown once.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {rootError ? <FormAlert>{rootError}</FormAlert> : null}
            <TextField
              label="Endpoint URL"
              type="url"
              placeholder="https://api.example.com/webhooks/nombaone"
              error={form.formState.errors.url?.message}
              {...form.register('url', { required: 'Enter a valid HTTPS URL.' })}
            />
            <TextField
              label="Events"
              placeholder="* or example.created, example.settled"
              error={form.formState.errors.events?.message}
              {...form.register('events')}
            />
            <p className="-mt-2 text-xs text-muted-foreground">
              Comma-separated event types, or <code className="font-mono">*</code> for all.
            </p>
            <DialogFooter>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? 'Adding…' : 'Add endpoint'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SecretDialog
        open={secret !== null}
        secret={secret}
        title="Your webhook signing secret"
        description="Verify every delivery's signature with this secret. It's shown only once — store it securely. If you lose it, you'll need a new endpoint."
        onClose={() => {
          setSecret(null);
          toast.success('Webhook endpoint added.');
        }}
      />
    </>
  );
}
