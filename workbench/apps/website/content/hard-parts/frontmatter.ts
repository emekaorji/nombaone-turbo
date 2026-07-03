// Typed frontmatter for the Hard Parts library (nombaone.xyz /guides).
// Mirror of the per-app content pattern in apps/docs/src/lib/content.ts.
// This file documents the schema; the Phase-B app should enforce it (e.g. with zod).

export type HardPartGroup =
  | "reliability"
  | "nigerian-reality"
  | "billing-mechanics"
  | "multi-tenant"
  | "migration";

export type Difficulty = "foundational" | "intermediate" | "deep";

export interface HardPartFrontmatter {
  /** Sentence case; written as the question a developer types. */
  title: string;
  /** URL slug, kebab-case; matches the file name. */
  slug: string;
  /** One-line pain, shown on cards and in listings. */
  problem: string;
  group: HardPartGroup;
  difficulty: Difficulty;
  /** Estimated minutes; compute from the body at build time in Phase B. */
  readingTime: number;
  /** Optional simulator deep-link: a doc-02 failureMode ("insufficient_funds",
   *  "expired_card", "hard_decline", "mid_run_interrupt") or a rail ("card",
   *  "transfer", "mandate", "crypto"). */
  simulator?: string;
  /** ISO date, last reviewed. */
  updated: string;
  /** Roster stubs not yet written. */
  draft?: boolean;
}

export const GROUP_ORDER: HardPartGroup[] = [
  "reliability",
  "nigerian-reality",
  "billing-mechanics",
  "multi-tenant",
  "migration",
];

export const GROUP_LABELS: Record<HardPartGroup, string> = {
  reliability: "Reliability & correctness",
  "nigerian-reality": "The Nigerian payment reality",
  "billing-mechanics": "Billing mechanics, done right",
  "multi-tenant": "Multi-tenant & infrastructure",
  migration: "Migration guides",
};
