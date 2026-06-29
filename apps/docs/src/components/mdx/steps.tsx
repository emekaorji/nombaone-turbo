import { Children, isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * `<Steps>` / `<Step title="…">`: a numbered, vertically-connected walkthrough
 * for quickstarts and guides. Step numbers are auto-derived from order; the
 * connecting rail is a left border.
 */

export function Steps({ children }: { children: ReactNode }) {
  const steps = Children.toArray(children).filter(isValidElement);
  return (
    <div className="not-prose my-6 space-y-0">
      {steps.map((step, index) => (
        <StepRow key={index} index={index + 1} isLast={index === steps.length - 1}>
          {step}
        </StepRow>
      ))}
    </div>
  );
}

function StepRow({
  index,
  isLast,
  children,
}: {
  index: number;
  isLast: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <span className="z-10 grid size-7 shrink-0 place-items-center rounded-full border border-purple-200 bg-purple-50 font-mono text-xs font-semibold text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300">
          {index}
        </span>
        {!isLast && <span aria-hidden className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </div>
  );
}

export function Step({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      {title && <p className="text-[15px] font-semibold text-foreground">{title}</p>}
      <div
        className={cn(
          "space-y-3 text-sm leading-relaxed text-muted-foreground",
          "[&_a]:font-medium [&_a]:text-primary [&_a]:underline",
          "[&_figure]:my-3 [&_p]:text-muted-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}
