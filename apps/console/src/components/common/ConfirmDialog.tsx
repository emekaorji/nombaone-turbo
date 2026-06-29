'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@nombaone/ui/components/ui/alert-dialog';

import type { ActionResult } from '@/lib/actions';
import { cn } from '@/lib/cn';

/**
 * A confirm-before-destruction dialog wrapping a server action. The `trigger`
 * (e.g. a "Revoke" button) opens it; confirming runs `onConfirm` inside a
 * transition, toasts the outcome, and closes on success. Consequence-listing
 * copy goes in `description` so the operator knows what they're committing to.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = true,
  onConfirm,
  successMessage,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<ActionResult<unknown>>;
  successMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    startTransition(async () => {
      const result = await onConfirm();
      if (result.ok) {
        if (successMessage) toast.success(successMessage);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
            className={cn(
              destructive &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            )}
          >
            {pending ? 'Working…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
