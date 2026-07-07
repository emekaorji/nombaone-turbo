'use client';

import { Download } from 'lucide-react';

/** Download as PDF via the browser's print-to-PDF (no external dependency). Print CSS hides the app chrome. */
export function InvoicePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-[7px] rounded border border-border bg-surface-2 px-[13px] py-2 text-[13px] font-medium text-foreground transition-colors hover:border-border-strong"
    >
      <Download className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
      Download PDF
    </button>
  );
}
