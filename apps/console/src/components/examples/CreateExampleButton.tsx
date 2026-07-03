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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nombaone/ui/components/ui/select';
import { Label } from '@nombaone/ui/components/ui/label';

import { TextField } from '@/components/auth/TextField';
import { FormAlert } from '@/components/auth/FormAlert';
import { createExampleAction } from '@/lib/example-actions';

interface FormValues {
  kind: 'standard' | 'priority';
  amount: string;
}

/**
 * Create-example dialog. Posts the amount (kobo) + kind through
 * `createExampleAction`, which runs the full money path (ledger post, event
 * emit, mock-rail collect). On success the list is revalidated and we route to
 * the new example's detail page. A non-developer never sees this (the page gates
 * it), and the action re-checks the capability anyway.
 */
export function CreateExampleButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rootError, setRootError] = useState<string | null>(null);

  const form = useForm<FormValues>({ defaultValues: { kind: 'standard', amount: '' } });
  const kind = form.watch('kind');

  const onSubmit = (values: FormValues) => {
    setRootError(null);
    const amount = Number(values.amount);
    startTransition(async () => {
      const result = await createExampleAction({ kind: values.kind, amountInKobo: amount });
      if (result.ok) {
        setOpen(false);
        form.reset();
        toast.success('Example created.');
        router.push(`/examples/${result.value.reference}`);
        return;
      }
      if (result.fields?.amountInKobo) {
        form.setError('amount', { type: 'server', message: result.fields.amountInKobo[0] });
      } else {
        setRootError(result.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create example</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create example</DialogTitle>
          <DialogDescription>
            Posts a balanced double-entry charge and emits an <code>example.created</code> event.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {rootError ? <FormAlert>{rootError}</FormAlert> : null}

          <div className="space-y-1.5">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => form.setValue('kind', v as FormValues['kind'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TextField
            label="Amount (kobo)"
            inputMode="numeric"
            placeholder="e.g. 250000 = ₦2,500.00"
            error={form.formState.errors.amount?.message}
            {...form.register('amount', { required: 'Enter an amount in kobo.' })}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? 'Creating…' : 'Create example'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
