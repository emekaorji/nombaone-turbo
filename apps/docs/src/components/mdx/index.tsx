import Link from "next/link";

import { cn } from "@/lib/cn";

import { ApiExplorer } from "./api-explorer";
import { RequestExample, Response, ResponseExample, Variant } from "./api-examples";
import { ApiReference } from "./api-reference";
import { Callout } from "./callout";
import { Card, CardGroup } from "./card";
import { InlineCode, Pre } from "./code-block";
import { EndpointHeader } from "./endpoint-header";
import { ErrorReference } from "./error-reference";
import { EventCatalog } from "./event-catalog";
import { IdempotencyLab } from "./idempotency-lab";
import { MoneyUnit } from "./money-unit";
import { QuickstartGrid } from "./quickstart-grid";
import { RailSwitcher } from "./rail-switcher";
import { Snippet } from "./snippet";
import { FeeBreakdown } from "./fee-breakdown";
import { ParamField, ResponseField } from "./fields";
import { Glossary } from "./glossary";
import { LifecycleStateMachine } from "./lifecycle-state-machine";
import { MoneyFlow } from "./money-flow";
import { Quickstart } from "./quickstart";
import { ReferenceDecoder } from "./reference-decoder";
import { Step, Steps } from "./steps";
import { CodeGroup, Tab, Tabs } from "./tabs";
import { WebhookVerifier } from "./webhook-verifier";

import type { AnchorHTMLAttributes, HTMLAttributes } from "react";
import type { MDXComponents } from "mdx/types";

/**
 * The MDX component map. Native markdown elements are mapped to our bespoke
 * prose typography (the type scale from `apps/admin/design/design_system.md`,
 * NOT `@tailwindcss/typography`), and the signature kit components are exposed
 * by name so authors can drop `<Callout>`, `<Tabs>`, `<EndpointHeader>`, etc.
 * straight into `.mdx`.
 *
 * Headings are wrapped by `rehype-autolink-headings` (behavior: "wrap") in an
 * anchor we style via `.heading-anchor` (see globals.css), so each h2/h3 is a
 * deep-linkable target with a hover ¶ affordance.
 */

type HeadingProps = HTMLAttributes<HTMLHeadingElement>;

function Anchor({ href = "", className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isInternal = href.startsWith("/") || href.startsWith("#");
  const classes = cn("font-medium text-primary underline-offset-4 hover:underline", className);

  if (isInternal) {
    return <Link href={href} className={classes} {...props} />;
  }
  return <a href={href} target="_blank" rel="noreferrer" className={classes} {...props} />;
}

export const mdxComponents: MDXComponents = {
  // ---- Headings (the prose scale) -----------------------------------------
  h1: (props: HeadingProps) => (
    <h1
      className="mt-2 scroll-mt-24 text-[32px] font-bold leading-[40px] tracking-tight text-foreground"
      {...props}
    />
  ),
  h2: (props: HeadingProps) => (
    <h2
      className="mt-12 scroll-mt-24 border-b border-border pb-2 text-[22px] font-semibold leading-7 text-foreground"
      {...props}
    />
  ),
  h3: (props: HeadingProps) => (
    <h3
      className="mt-8 scroll-mt-24 text-[18px] font-semibold leading-6 tracking-[-0.1px] text-foreground"
      {...props}
    />
  ),
  h4: (props: HeadingProps) => (
    <h4
      className="mt-6 scroll-mt-24 text-base font-semibold leading-[22px] tracking-[-0.1px] text-foreground"
      {...props}
    />
  ),

  // ---- Text ----------------------------------------------------------------
  p: (props: HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mt-4 text-[15px] leading-7 text-foreground/85" {...props} />
  ),
  a: Anchor,
  strong: (props: HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  ul: (props: HTMLAttributes<HTMLUListElement>) => (
    <ul className="mt-4 list-disc space-y-2 pl-6 text-[15px] leading-7 text-foreground/85 marker:text-accent" {...props} />
  ),
  ol: (props: HTMLAttributes<HTMLOListElement>) => (
    <ol className="mt-4 list-decimal space-y-2 pl-6 text-[15px] leading-7 text-foreground/85 marker:text-muted-foreground" {...props} />
  ),
  li: (props: HTMLAttributes<HTMLLIElement>) => <li className="pl-1" {...props} />,
  blockquote: (props: HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="mt-6 border-l-2 border-accent-border bg-muted/40 py-2 pl-4 pr-2 text-[15px] italic leading-7 text-muted-foreground"
      {...props}
    />
  ),
  hr: () => <hr className="my-10 border-border" />,

  // ---- Tables --------------------------------------------------------------
  table: (props: HTMLAttributes<HTMLTableElement>) => (
    <div className="my-6 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: (props: HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-muted/60" {...props} />
  ),
  th: (props: HTMLAttributes<HTMLTableCellElement>) => (
    <th
      className="border-b border-border px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      {...props}
    />
  ),
  td: (props: HTMLAttributes<HTMLTableCellElement>) => (
    <td className="border-b border-border px-4 py-2.5 align-top text-foreground/85 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]" {...props} />
  ),
  tr: (props: HTMLAttributes<HTMLTableRowElement>) => (
    <tr className="last:[&>td]:border-0" {...props} />
  ),

  // ---- Code ----------------------------------------------------------------
  pre: Pre,
  code: InlineCode,

  // ---- Signature kit (used by name in MDX) --------------------------------
  Callout,
  Tabs,
  Tab,
  CodeGroup,
  Steps,
  Step,
  ParamField,
  ResponseField,
  EndpointHeader,
  Card,
  CardGroup,
  ErrorReference,
  EventCatalog,
  ApiReference,
  IdempotencyLab,
  MoneyUnit,
  RailSwitcher,
  Snippet,
  Glossary,
  RequestExample,
  Variant,
  ResponseExample,
  Response,

  // ---- Signature experiences (the "wow") ----------------------------------
  Quickstart,
  ReferenceDecoder,
  FeeBreakdown,
  MoneyFlow,
  LifecycleStateMachine,
  ApiExplorer,
  WebhookVerifier,
};
