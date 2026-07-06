"use client";

import { Children, isValidElement, useState, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { extractText } from "./code-block";
import { CopyButton } from "./copy-button";
import { InsideTabsContext } from "./inside-tabs-context";

/**
 * `<Tabs>` / `<Tab>` and `<CodeGroup>`: a branded, keyboard-accessible tab
 * switcher used in MDX (e.g. curl vs TypeScript snippets). Client component:
 * tab state is interactive.
 *
 *   <Tabs>
 *     <Tab label="cURL">…</Tab>
 *     <Tab label="TypeScript">…</Tab>
 *   </Tabs>
 *
 * `<CodeGroup>` is the same machine with code-tuned chrome (flush, no padding
 * around the panel) for grouping fenced code blocks by label.
 */

export interface TabProps {
  label: string;
  children: ReactNode;
}

/** Marker component; its props are read by the parent `<Tabs>`. */
export function Tab({ children }: TabProps) {
  return <>{children}</>;
}

function useTabChildren(children: ReactNode) {
  const tabs = Children.toArray(children).filter(
    (child): child is ReactElement<TabProps> =>
      isValidElement(child) && typeof (child.props as TabProps).label === "string",
  );
  return tabs;
}

export function Tabs({ children }: { children: ReactNode }) {
  const tabs = useTabChildren(children);
  const [active, setActive] = useState(0);

  if (tabs.length === 0) return null;

  return (
    <div className="not-prose my-6 overflow-hidden rounded-lg border border-border">
      <TabStrip items={tabs.map((tab) => ({ key: tab.props.label, label: tab.props.label }))} active={active} onSelect={setActive} />
      <div className="bg-card px-4 py-4 text-sm leading-relaxed text-foreground [&_pre]:my-0 [&_figure]:my-0 [&_figure]:border-0 [&_figure]:shadow-none">
        <InsideTabsContext.Provider value="tabs">{tabs[active]}</InsideTabsContext.Provider>
      </div>
    </div>
  );
}

export function CodeGroup({ children }: { children: ReactNode }) {
  const tabs = useTabChildren(children);
  const [active, setActive] = useState(0);

  if (tabs.length === 0) return null;

  // The strip is this group's title bar, so it hosts the copy button for the
  // active tab (the inner block suppresses its own copy via the "code-group"
  // context). Recover the active block's raw text from its rendered subtree.
  const activeCode = extractText(tabs[active]);

  return (
    <div className="not-prose my-6 overflow-hidden rounded-lg border border-border bg-[var(--code-bg)]">
      <TabStrip
        items={tabs.map((tab) => ({ key: tab.props.label, label: tab.props.label }))}
        active={active}
        onSelect={setActive}
        variant="code"
        trailing={<CopyButton value={activeCode} />}
      />
      <div className="[&_figure]:my-0 [&_figure]:rounded-none [&_figure]:border-0 [&_figure]:shadow-none">
        <InsideTabsContext.Provider value="code-group">{tabs[active]}</InsideTabsContext.Provider>
      </div>
    </div>
  );
}

/** One tab in a {@link TabStrip}: a stable key plus its (rich) label content. */
export interface TabStripItem {
  key: string;
  label: ReactNode;
}

/**
 * The shared, keyboard-accessible tab strip (tablist + buttons) backing every
 * tab group in the docs: `<Tabs>`, `<CodeGroup>`, and the API example tabs.
 * `label` is arbitrary content so callers can render plain text or status
 * chips; the chrome (border, spacing, selected affordance, arrow-key nav) is
 * identical across all of them.
 */
export function TabStrip({
  items,
  active,
  onSelect,
  variant = "default",
  trailing,
}: {
  items: TabStripItem[];
  active: number;
  onSelect: (index: number) => void;
  variant?: "default" | "code";
  /** Optional right-aligned content (e.g. a copy button for the active tab). */
  trailing?: ReactNode;
}) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "flex items-center gap-1 border-b border-border px-2",
        variant === "code" ? "bg-[var(--code-titlebar-bg)]" : "bg-muted/40",
      )}
    >
      {items.map((item, index) => {
        const selected = index === active;
        return (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(index)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") onSelect((active + 1) % items.length);
              if (event.key === "ArrowLeft") onSelect((active - 1 + items.length) % items.length);
            }}
            className={cn(
              "relative -mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              selected
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
      {trailing && <div className="ml-auto flex items-center pr-1">{trailing}</div>}
    </div>
  );
}
