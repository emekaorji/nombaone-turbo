"use client";

import { createContext, useContext } from "react";

/**
 * Signals that a `<Pre>` is rendered inside a tab group, and which KIND:
 *
 *   • `"tabs"`      — a generic `<Tabs>` group. The tab label names the language,
 *                     so the block's caption is suppressed, but the block keeps
 *                     its own hover copy (the strip carries no copy button).
 *   • `"code-group"`— a `<CodeGroup>` / example group. The strip IS the block's
 *                     title bar and hosts the copy button for the active tab, so
 *                     the inner block suppresses BOTH its caption and its copy.
 *   • `null`        — a standalone fenced block: keeps its caption and copy.
 */
export type TabsKind = "tabs" | "code-group" | null;

export const InsideTabsContext = createContext<TabsKind>(null);

export const useInsideTabs = () => useContext(InsideTabsContext);
