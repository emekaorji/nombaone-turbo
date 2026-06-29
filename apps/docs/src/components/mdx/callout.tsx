import type { ReactNode } from "react";

import { AlertTriangle, Info, Lightbulb, OctagonAlert } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * `<Callout type="note|tip|warning|danger">`: branded admonition block.
 * Colour-coded against the Nombaone status tokens, accessible (role + icon has a
 * text label via `aria-hidden` + visible kind in the title), light/dark.
 */

type CalloutType = "note" | "tip" | "warning" | "danger";

const STYLES: Record<
  CalloutType,
  { icon: typeof Info; label: string; wrap: string; iconColor: string; title: string }
> = {
  note: {
    icon: Info,
    label: "Note",
    wrap: "border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/40",
    iconColor: "text-purple-600 dark:text-purple-300",
    title: "text-purple-800 dark:text-purple-200",
  },
  tip: {
    icon: Lightbulb,
    label: "Tip",
    wrap: "border-success-200 bg-success-50 dark:border-success-900 dark:bg-success-900/20",
    iconColor: "text-success-600 dark:text-success-400",
    title: "text-success-800 dark:text-success-300",
  },
  warning: {
    icon: AlertTriangle,
    label: "Warning",
    wrap: "border-warning-200 bg-warning-50 dark:border-warning-900 dark:bg-warning-900/20",
    iconColor: "text-warning-600 dark:text-warning-400",
    title: "text-warning-800 dark:text-warning-300",
  },
  danger: {
    icon: OctagonAlert,
    label: "Danger",
    wrap: "border-error-200 bg-error-50 dark:border-error-900 dark:bg-error-900/20",
    iconColor: "text-error-600 dark:text-error-400",
    title: "text-error-800 dark:text-error-300",
  },
};

export function Callout({
  type = "note",
  title,
  children,
}: {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}) {
  const style = STYLES[type];
  const Icon = style.icon;

  return (
    <div
      role="note"
      className={cn(
        "not-prose my-6 flex gap-3 rounded-lg border p-4 text-sm leading-relaxed",
        style.wrap,
      )}
    >
      <Icon size={18} aria-hidden className={cn("mt-0.5 shrink-0", style.iconColor)} />
      <div className="min-w-0 space-y-1.5 text-foreground/90">
        <p className={cn("font-semibold", style.title)}>{title ?? style.label}</p>
        <div className="space-y-2 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-card/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]">
          {children}
        </div>
      </div>
    </div>
  );
}
