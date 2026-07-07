'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { voidCreditGrantAction } from '@/lib/engine-actions';

export function GrantVoidButton({ grantReference, customerReference, canManage }: { grantReference: string; customerReference: string; canManage: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!canManage) return null;

  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await voidCreditGrantAction(customerReference, grantReference);
          router.refresh();
        })
      }
      disabled={pending}
      title="Void this credit grant"
      className="shrink-0 text-[10.5px] text-subtle-foreground transition-colors hover:text-danger disabled:opacity-50"
    >
      Void
    </button>
  );
}
