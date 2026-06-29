"use client";

import { Children, isValidElement, useState, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { InsideTabsContext } from "./inside-tabs-context";
import { TabStrip, type TabStripItem } from "./tabs";

/**
 * Status-coded request/response example tabs for the API reference.
 *
 *   <ResponseExample>
 *     <Response status={200} label="Created">
 *       ```json
 *       { "data": { … } }
 *       ```
 *     </Response>
 *     <Response status={422} label="Validation error">
 *       ```json
 *       { "error": { … } }
 *       ```
 *     </Response>
 *   </ResponseExample>
 *
 *   <RequestExample>
 *     <Variant label="cURL">```bash …```</Variant>
 *     <Variant label="TypeScript">```ts …```</Variant>
 *   </RequestExample>
 *
 * Both reuse the shared `<TabStrip>` chrome from `tabs.tsx` (so they match
 * `<Tabs>`/`<CodeGroup>` exactly) and render the active child's fenced `<Pre>`
 * flush. `<ResponseExample>` colors each tab's status chip by tone:
 * `<400` success (green), `400–499` client error (red), `>=500` server error
 * (also the error ramp, with a distinct label). The panel is wrapped in
 * `<InsideTabsContext.Provider value={true}>` so the inner block's caption is
 * suppressed (the tab already names the variant).
 */

// ---------------------------------------------------------------------------
// Response examples
// ---------------------------------------------------------------------------

export interface ResponseProps {
  /** HTTP status code, e.g. `200`, `201`, `422`, `500`. */
  status: number;
  /** Short human label for the case, e.g. `"Created"`, `"Validation error"`. */
  label: string;
  /** The fenced JSON block for this case. */
  children: ReactNode;
}

/** Marker component; its props are read by the parent `<ResponseExample>`. */
export function Response({ children }: ResponseProps) {
  return <>{children}</>;
}

type Tone = "success" | "client-error" | "server-error";

/** Classify a status code into a chip tone. */
function toneForStatus(status: number): Tone {
  if (status >= 500) return "server-error";
  if (status >= 400) return "client-error";
  return "success";
}

const chipTone: Record<Tone, string> = {
  success:
    "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300",
  "client-error":
    "bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-300",
  "server-error":
    "bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-300",
};

function StatusChip({ status }: { status: number }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums",
        chipTone[toneForStatus(status)],
      )}
    >
      {status}
    </span>
  );
}

function useResponseChildren(children: ReactNode) {
  return Children.toArray(children).filter(
    (child): child is ReactElement<ResponseProps> =>
      isValidElement(child) && typeof (child.props as ResponseProps).status === "number",
  );
}

export function ResponseExample({ children }: { children: ReactNode }) {
  const cases = useResponseChildren(children);
  const [active, setActive] = useState(0);

  if (cases.length === 0) return null;

  const items: TabStripItem[] = cases.map((c) => ({
    key: `${c.props.status}-${c.props.label}`,
    label: (
      <>
        <StatusChip status={c.props.status} />
        <span>{c.props.label}</span>
      </>
    ),
  }));

  return (
    <div className="not-prose my-6 overflow-hidden rounded-lg border border-border bg-[var(--code-bg)]">
      <TabStrip items={items} active={active} onSelect={setActive} variant="code" />
      <div className="[&_figure]:my-0 [&_figure]:rounded-none [&_figure]:border-0 [&_figure]:shadow-none">
        <InsideTabsContext.Provider value={true}>{cases[active]}</InsideTabsContext.Provider>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Request examples
// ---------------------------------------------------------------------------

export interface VariantProps {
  /** Short label for the variant, e.g. `"cURL"`, `"TypeScript"`, `"With idempotency key"`. */
  label: string;
  /** The fenced code block for this variant. */
  children: ReactNode;
}

/** Marker component; its props are read by the parent `<RequestExample>`. */
export function Variant({ children }: VariantProps) {
  return <>{children}</>;
}

function useVariantChildren(children: ReactNode) {
  return Children.toArray(children).filter(
    (child): child is ReactElement<VariantProps> =>
      isValidElement(child) && typeof (child.props as VariantProps).label === "string",
  );
}

export function RequestExample({ children }: { children: ReactNode }) {
  const variants = useVariantChildren(children);
  const [active, setActive] = useState(0);

  if (variants.length === 0) return null;

  const items: TabStripItem[] = variants.map((v) => ({
    key: v.props.label,
    label: v.props.label,
  }));

  return (
    <div className="not-prose my-6 overflow-hidden rounded-lg border border-border bg-[var(--code-bg)]">
      <TabStrip items={items} active={active} onSelect={setActive} variant="code" />
      <div className="[&_figure]:my-0 [&_figure]:rounded-none [&_figure]:border-0 [&_figure]:shadow-none">
        <InsideTabsContext.Provider value={true}>{variants[active]}</InsideTabsContext.Provider>
      </div>
    </div>
  );
}
