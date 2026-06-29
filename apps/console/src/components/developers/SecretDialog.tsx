'use client';

import { useState } from 'react';
import { Eye, EyeSlash, TickCircle } from 'iconsax-react';

import { Button } from '@nombaone/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@nombaone/ui/components/ui/dialog';

import { CopyButton } from '@/components/common/CopyButton';
import { cn } from '@/lib/cn';

/**
 * PARADIGM — the secret-shown-ONCE dialog. A freshly minted secret (an API key
 * or a webhook signing secret) is returned by the domain exactly once and never
 * recoverable after. This dialog is the single moment it's visible: it opens
 * automatically when `secret` becomes non-null, shows the value MASKED by
 * default with a reveal toggle + copy, and a warning that it won't be shown
 * again. Closing clears the secret from the parent's state (`onClose`).
 */
export function SecretDialog({
  open,
  secret,
  title = 'Save your secret',
  description = "This is the only time you'll see this secret. Copy it now and store it somewhere safe — you won't be able to retrieve it again.",
  onClose,
}: {
  open: boolean;
  secret: string | null;
  title?: string;
  description?: string;
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setRevealed(false);
      onClose();
    }
  };

  const masked = secret ? `${secret.slice(0, 8)}${'•'.repeat(Math.max(secret.length - 8, 8))}` : '';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TickCircle size={18} color="currentColor" variant="Bold" className="text-success-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <code
            className={cn(
              'min-w-0 flex-1 truncate font-mono text-sm text-foreground',
              !revealed && 'tracking-wide'
            )}
          >
            {revealed ? secret : masked}
          </code>
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide secret' : 'Reveal secret'}
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {revealed ? (
              <EyeSlash size={15} color="currentColor" variant="Outline" />
            ) : (
              <Eye size={15} color="currentColor" variant="Outline" />
            )}
          </button>
          {secret ? <CopyButton value={secret} label="Copy secret" /> : null}
        </div>

        <DialogFooter>
          <Button onClick={() => handleOpenChange(false)}>I&apos;ve saved it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
