"use client";

import { createContext, useContext } from "react";

/**
 * Signals that a `<Pre>` is rendered inside a tab group (`<Tabs>`,
 * `<CodeGroup>`, `<RequestExample>`, `<ResponseExample>`). Inside a group, the
 * tab label already names the language, so the block's own `<figcaption>`
 * caption is redundant and is suppressed. Standalone fenced blocks read
 * `false` and keep their caption.
 */
export const InsideTabsContext = createContext(false);

export const useInsideTabs = () => useContext(InsideTabsContext);
