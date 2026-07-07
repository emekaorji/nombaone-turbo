'use client';

import { CircleAlert, ExternalLink, RefreshCw } from 'lucide-react';

/** Error-state card for the subscriptions list (matches the States board · ERROR). */
export function ErrorState({
  title = "Couldn't load subscriptions",
  hint = 'Something went wrong on our end while fetching\nyour subscriptions. This is not your fault.',
  requestId = 'req_7fa2c9e1b0',
  docsHref = 'https://docs.nombaone.xyz/errors',
  onRetry,
}: {
  title?: string;
  hint?: string;
  requestId?: string;
  docsHref?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[440px] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface-1 px-5 py-12 text-center">
      <div className="flex size-[52px] items-center justify-center rounded-lg border border-danger bg-danger-bg">
        <CircleAlert className="size-[22px] text-danger" strokeWidth={1.75} />
      </div>
      <span className="text-[16px] font-semibold text-foreground">{title}</span>
      <p className="whitespace-pre-line text-[12.5px] leading-[1.5] text-muted-foreground">{hint}</p>
      <div className="flex items-center gap-2 rounded-sm border border-border bg-surface-2 px-[11px] py-[7px]">
        <span className="font-mono text-[11px] text-subtle-foreground">requestId</span>
        <span className="font-mono text-[11px] text-muted-foreground">{requestId}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRetry}
          className="flex items-center gap-[7px] rounded bg-accent px-3.5 py-[9px] text-[13px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          <RefreshCw className="size-3.5" strokeWidth={2.25} />
          Retry
        </button>
        <a
          href={docsHref}
          className="flex items-center gap-1.5 rounded border border-border-strong bg-surface-2 px-3.5 py-[9px] text-[13px] font-medium text-foreground transition-colors hover:bg-surface-3"
        >
          <ExternalLink className="size-[13px]" strokeWidth={2} />
          View docs
        </a>
      </div>
    </div>
  );
}
