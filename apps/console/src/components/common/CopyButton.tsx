'use client';

import { useState } from 'react';
import { Copy, TickCircle } from 'iconsax-react';
import { toast } from 'sonner';

import { cn } from '@/lib/cn';

/**
 * Copy-to-clipboard button with a momentary "copied" tick. Used by `Reference`
 * and the secret dialogs. Falls back to a toast error if the Clipboard API is
 * unavailable (e.g. non-secure context).
 */
export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={label}
      className={cn(
        'grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      {copied ? (
        <TickCircle size={15} color="currentColor" variant="Bold" className="text-success-500" />
      ) : (
        <Copy size={15} color="currentColor" variant="Outline" />
      )}
    </button>
  );
}
