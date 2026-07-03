# Nomba One website content

**The content here is authoritative. The MDX, components, and formatting are not.**

This folder holds the written content for the nombaone.xyz marketing site while the site itself is still being
designed (Phase A). The prose, the frontmatter data, and every technical claim in these files have been
reviewed like code and are meant to be preserved. They are grounded in how the real engine actually works
(`packages/sara`, `packages/core-db`, `apps/api`), and they hold the project's truthfulness rules (below).

What is **not** authoritative, and what the Phase-B implementing agent should feel free to change, replace, or
restructure to make the site look and work perfectly:

- the MDX file structure, headings markup, and section ordering,
- any embedded components or JSX, imports, and shortcodes,
- code-fence languages, callout styling, and formatting,
- the rendering pipeline, routes, and link targets.

In short: **keep the words and the claims, change the packaging.**

## Where this goes in Phase B

Move `hard-parts/*.mdx` into the real app at `apps/website/content/hard-parts/`. The render pipeline should
mirror the working one in `apps/docs` (App Router MDX with `gray-matter` frontmatter, `remark-gfm`,
`rehype-slug`, `rehype-pretty-code` / Shiki, `rehype-autolink-headings`). `frontmatter.ts` is the typed schema
to enforce. `readingTime` should be computed from the body at build time; the values here are estimates.

## Truthfulness rules (do not soften)

- Outbound webhooks are signed, at-least-once, deduplicated, retried, and replayable. They are **never**
  "exactly-once."
- "Retry the webhook" is not "retry the charge." A redelivered webhook re-POSTs a notification of an
  already-recorded event; the money is settled once, by the period claim and the unique constraints, no matter
  how many times its event is delivered.
- Direct-debit (NIBSS) mandates, payouts, refunds (the real money-return leg), escrow, and the bank-transfer
  provider leg are **built but live-gated** behind the payment provider. Describe them as capabilities we have
  implemented, not as things proven in production.
- Card auto-renewal is best-effort: a bank OTP or 3DS step-up routes to a one-tap checkout link, it is not
  completed silently.
- All amounts are integer kobo. The ledger is immutable and append-only.

## Articles

Launch set (fully written): the double-charge bug; dunning for thin balances; why bank transfer is not just
another method; what to check before you trust a billing layer. The rest of the roster is present as
`draft: true` stubs (a title and a one-line problem) to be written over time.
