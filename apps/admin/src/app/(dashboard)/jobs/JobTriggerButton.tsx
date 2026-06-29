'use client';

import { useTransition } from 'react';
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
import { Button } from '@nombaone/ui/components/ui/button';

import { triggerJob } from '@/lib/queue/actions';

/**
 * Guarded ad-hoc job trigger. Fronts the `triggerJob` server action with a
 * CONSEQUENCE-LISTING confirm dialog so the operator sees exactly what firing
 * the job will do before it runs. The action itself re-checks the
 * `jobs:trigger` capability server-side and writes an audit row — the button is
 * only the UX; authority lives in the action.
 */
export function JobTriggerButton({
  task,
  label,
  consequences,
  disabled,
}: {
  task: string;
  label: string;
  consequences: readonly string[];
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const onConfirm = () => {
    startTransition(async () => {
      const result = await triggerJob(task);
      if (result.ok) {
        toast.success(`Triggered '${label}'.`);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || pending}>
          {pending ? 'Triggering…' : 'Run now'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Run “{label}” now?</AlertDialogTitle>
          <AlertDialogDescription>
            This triggers an ad-hoc run outside the normal schedule. It will:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {consequences.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            disabled={pending}
          >
            Run now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
