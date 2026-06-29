"use client";

import { useSyncExternalStore } from "react";

/**
 * Client-only value helpers built on `useSyncExternalStore`: the React-blessed
 * way to read browser state during hydration without `setState`-in-effect
 * (which Next 16's `react-hooks/set-state-in-effect` rule forbids).
 *
 * The store never changes after mount, so `subscribe` is a no-op; the snapshot
 * differs between server (false / fallback) and client (the real value), and
 * React reconciles on hydration.
 */

const noopSubscribe = () => () => {};

/** `true` once mounted on the client, `false` during SSR. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** `true` on Apple platforms (for the ⌘ vs Ctrl hint); `true` during SSR. */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => true,
  );
}
