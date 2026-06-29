"use client";

import { useState } from "react";

import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Copy-to-clipboard button overlaid on code blocks. Reads the text from a
 * sibling `<pre>` via a ref-free DOM lookup is avoided; instead the rendered
 * code string is passed in so it works in RSC-streamed markup.
 */
export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can reject (insecure context / denied permission); fail soft.
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? "Copied" : "Copy code"}
      className={cn(
        "grid size-7 place-items-center rounded-sm border border-border/60 bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        className,
      )}
    >
      {copied ? (
        <Check size={14} className="text-success-600" />
      ) : (
        <Copy size={14} />
      )}
    </button>
  );
}
