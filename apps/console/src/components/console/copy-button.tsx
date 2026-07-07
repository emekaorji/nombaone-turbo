'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** Copies `value` to the clipboard, briefly confirming with a check. */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={label ?? 'Copy'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          // Clipboard unavailable (insecure context / denied) — no-op, never throw.
        }
      }}
      className="text-subtle-foreground transition-colors hover:text-foreground"
    >
      {copied ? <Check className="size-[15px] text-success" strokeWidth={2} /> : <Copy className="size-[15px]" strokeWidth={1.75} />}
    </button>
  );
}
