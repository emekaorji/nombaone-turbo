'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { removePaymentMethodAction, setDefaultPaymentMethodAction } from '@/lib/engine-actions';

export function MethodActions({
  methodReference,
  customerReference,
  isDefault,
  canManage,
}: {
  methodReference: string;
  customerReference: string;
  isDefault: boolean;
  canManage: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!canManage) return null;

  function setDefault() {
    start(async () => {
      await setDefaultPaymentMethodAction(methodReference, customerReference);
      router.refresh();
    });
  }
  function remove() {
    start(async () => {
      await removePaymentMethodAction(methodReference, customerReference);
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {isDefault ? (
        <span className="rounded-full bg-accent-muted px-[7px] py-0.5 text-[10.5px] font-medium text-accent">Default</span>
      ) : (
        <button type="button" onClick={setDefault} disabled={pending} className="text-[11.5px] text-accent transition-opacity hover:opacity-80 disabled:opacity-50">
          Set default
        </button>
      )}
      <button type="button" onClick={remove} disabled={pending} className="text-[11.5px] text-subtle-foreground transition-colors hover:text-danger disabled:opacity-50">
        Remove
      </button>
    </div>
  );
}
