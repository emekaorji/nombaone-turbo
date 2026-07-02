# Nomba One — Website Plan · 00 · Overview & Foundations

> **What this is.** The north-star document for building `nombaone.xyz` — the public front-door marketing site. It sets the positioning, the design language, the voice, the tech, and the working method. Read it first; the other four docs depend on it.
>
> **The doc set**
> - **00 · Overview & Foundations** *(this doc)*
> - **01 · Pages & Content** — sitemap, every page's anatomy, wireframes, copy, reasoning
> - **02 · The Live Simulator** — the signature interactive, full spec
> - **03 · Motion & "Alive"** — the interaction and animation spec
> - **04 · The Hard Parts Library** — the content system + one worked example
>
> **How to use it — two phases.**
> - **Phase A — design in pencil.** Before writing production code, produce low-fidelity wireframes / layout studies for every page in doc 01, plus interaction storyboards for the simulator (doc 02) and motion (doc 03). Use the design system's tokens and type scale, but keep fidelity rough — the goal is structure, hierarchy, and flow, reviewed before build. ASCII wireframes are included in doc 01 as the starting point; translate them into real low-fi frames.
> - **Phase B — build.** Only after the pencil pass is right, build the real site to the spec, deriving every color, type, spacing, and motion value from the design system.

---

## 1. The product, in one paragraph

Nomba One is a managed, multi-tenant subscriptions layer built on Nomba's payment primitives. It runs the whole recurring-billing lifecycle — plans, cycles, proration, invoices, dunning, reconciliation, settlement — so downstream product teams don't rebuild it. Its distinctive stance is that it's built for the Nigerian payment reality rather than ported from a card-on-file world: one subscription object over multiple rails (card, direct debit / mandate, bank transfer, and crypto), dunning tuned for thin balances, and a reconciliation engine that turns push transfers into managed subscriptions. Full detail lives in `nomba-one-product-overview.md`; this site sells that product.

## 2. What this site is — and isn't

**It is** the front door: the marketing site at the root domain, whose job is to make a visitor believe Nomba One is real, serious, and worth trusting with their revenue — and to get developers to start integrating.

**It is not** the product. The app surfaces already exist and are out of scope here: `api.` (the REST API), `console.` (tenant dashboard), `checkout.` (subscriber payment + self-service), `admin.` (platform operators), `docs.` (developer documentation). The site *links into* those; it doesn't rebuild them.

**Category:** a developer-first infrastructure site in the lineage of Vercel, Resend, Neon, Clerk. The defining trait of that category: the site is the product's first surface, not an advertisement for it. Quality of docs, clarity of the API, and honesty about the hard problems do the persuading — not testimonials you don't have yet.

## 3. Who we're selling to (and the one principle that resolves the conflict)

Four audiences, in one funnel:

- **Developers** — evaluate by reading docs and imagining the integration; they champion the product by word of mouth. **Center of gravity.**
- **Engineering & business leaders** — hold the authority to switch off an existing billing system; need to trust it with money.
- **Founders** — building fast, want something robust that just works.
- **Merchants** — need subscriptions implemented quickly, sometimes with little engineering.

**The resolving principle: layer by depth, not by page.** One homepage serves all four by changing *reading depth* down the scroll — a ten-second "what and why" for the decision-maker at the top, real code and the live demo for the developer in the middle, and self-identifying use-case paths for founders and merchants further down. When audiences conflict, **optimise for the developer** — win them and the leader gets convinced by their own team.

## 4. Positioning — the throughline

Every page threads one thesis:

> Nomba ships payment primitives but no managed subscriptions layer, so every team rebuilds billing from scratch — and the usual playbook assumes a card-on-file world Nigeria doesn't have. Nomba One is the missing layer, built for how money actually moves here: rail-agnostic, with dunning for thin balances and reconciliation that turns transfers into subscriptions.

The name helps: "Nomba One" reads as *the one subscriptions layer* every Nomba team plugs into. Lean on it.

## 5. The three things the site must land

1. **Why not just build it yourself on Nomba?** — answered instantly, without defensiveness. This is the decision-maker's question and it's on the homepage above the fold-ish, not buried.
2. **Best-in-class DX — "anywhere, anything, anyhow."** — usable in any stack, any language, any way, plus the ability to *try the core thing* before committing. (Detail: doc 01 §Integrations, and the simulator.)
3. **Honesty about the hard parts** — dunning, reconciliation, Nigerian-rail realities. Naming the real bottlenecks of building billing yourself, with clarity, is both the argument against DIY and the trust signal. (Detail: doc 04.)

**The signature** that carries all three: the live, sandbox-backed, time-compressed **subscription simulator** — pick a rail, subscribe, watch cycles tick, trigger a failure, watch dunning recover it, see the webhook fire. It collapses "can I use this?" into "I just did." (Full spec: doc 02.)

## 6. Design language — inherit, don't reinvent

The visual system is already defined and built: **`nomba-one-design-system.html` is the single source of truth.** Do not introduce new colors, type, spacing, radius, or motion values — consume the ones there.

Summary of what it dictates:
- **Dark-first**, with a real light mode that is a pure token remap. The marketing site ships dark by default; a theme toggle is optional (nice-to-have, not required for launch).
- **Pure-neutral OKLCH** neutral ramp (chroma 0 — genuinely no warm/cool cast), the deliberate choice that makes the grays feel expensive.
- **One signature accent: electric emerald.** Used with restraint — primary CTA, links, focus rings, and the simulator's success/recovery moment. Never decorative. Semantic hues (success/warning/danger/info) appear only in status and product contexts.
- **Typography: Geist Sans + Geist Mono** (Vercel's own, open-licensed), tight negative tracking on display sizes.
- **Motion is tokenised** (durations + three easing curves). See doc 03.

**Consuming the tokens in the build:** port the CSS custom properties from the design-system file into the app's global stylesheet as the source of truth, then map Tailwind's theme to `var(--…)` so utilities resolve to tokens (e.g. `colors.accent → var(--accent)`). Tokens stay authoritative; Tailwind is ergonomic sugar over them. Geist via `next/font`. The monochrome logo is embedded/invertible (white on dark, black on light) — mirror that behavior.

## 7. Voice & copy

Copy is design material, not decoration. It should read like it was written by the engineers who built the thing.

- Technical, precise, plain. Say what something does; don't sell it. Specific beats clever.
- Active voice, verb-first. Sentence case everywhere. Serial commas.
- Banned filler: "seamless", "leverage", "unlock", "empower", "simply", "just", "effortless", "revolutionary". If a sentence survives deleting the adjective, delete it.
- Name things from the user's side of the screen (a person manages *subscriptions* and *payouts*, not "webhook config").
- Errors and empty states give direction, not mood.
- One voice across the whole site; the same action keeps the same name from CTA to confirmation.

Draft copy for key moments is in doc 01. Where copy isn't specified, write to these rules — don't fall back to marketing-speak.

## 8. Global chrome (shared across every page)

**Header** — sticky, `backdrop-filter` blur over a translucent `--background`, hairline bottom border.
- Left: invertible logo + wordmark "Nomba One".
- Center/left nav: `Product`, `Integrations`, `Use cases`, `Docs ↗` (→ `docs.nombaone.xyz`), `Pricing`. A `Guides`/`Hard parts` entry can live here or under Resources.
- Right: `Log in` (→ console), `Start building` (accent, → console signup / quickstart). Optional theme toggle.
- Mobile: collapses to a sheet; nav becomes a full-height menu. Keyboard-navigable, focus-visible.

**Footer** — full sitemap in columns: Product, Developers (Docs, API reference, SDKs, CLI, Changelog, Status), Solutions (use-cases/verticals), Company, Legal. A quiet system-status pill ("All systems operational" → status page) and the invertible wordmark. No newsletter wall.

**Shared primitives** (from the design system): buttons (primary neutral, accent emerald, secondary, ghost), links with the underline-grow, status pills, the code block, cards, inputs. Reuse — don't re-style per page.

## 9. Tech stack

- **Next.js (App Router) + TypeScript**, React Server Components by default; client components only where interaction demands (simulator, tabs, toggles).
- **Styling:** design-system CSS variables as the token source, Tailwind mapped to them. Geist via `next/font`.
- **Content:** MDX for the Hard Parts library (and any long-form), via a typed content pipeline (Contentlayer2 or the App Router MDX + a small frontmatter schema). Content is version-controlled and reviewed like code. (Detail: doc 04.)
- **Motion:** Motion (framer-motion) for orchestrated reveals and the simulator; CSS for ambient loops and simple hovers. Respect `prefers-reduced-motion` everywhere. **No scroll-hijacking / smooth-scroll libraries that fight native scroll** — it hurts accessibility and perf; use native scroll + reveal-on-enter instead.
- **The simulator seam:** it calls a public, rate-limited **sandbox endpoint** so a skeptical developer can open devtools and see real network calls. Plan this endpoint as a first-class dependency, not an afterthought (contract in doc 02).
- **Deploy:** Vercel. Dynamic OG images via `@vercel/og`. Sitemap + robots. Analytics that respect privacy.

## 10. Repo & structure

The app surfaces already exist. The marketing site should live alongside them and share the design tokens rather than fork them.

- If there's a monorepo: add the marketing site as `apps/web`, and factor the design tokens into a shared package (e.g. `packages/tokens` or `packages/ui`) sourced from the design-system file, consumed by both the site and (where sensible) the console.
- If standalone: a single Next app is fine; vendor the tokens file in and treat it as read-only source of truth.
- Suggested app shape: `app/` route segments per page; `components/` for shared UI (Button, CodeBlock, Pill, Nav, Footer, Reveal); `components/simulator/` for the signature; `content/hard-parts/*.mdx`; `lib/` for the sandbox client and OG generation; `styles/tokens.css` (ported from the design system).

Claude Code should adapt this to what already exists — the point is *shared tokens, one visual language*, not a rigid folder layout.

## 11. Quality floor (non-negotiable, don't announce it)

- **Performance:** an infra site that's slow is self-refuting. Target LCP < 1.5s on a mid mobile, near-zero CLS, minimal JS on first paint (simulator and heavy interactions lazy-load). Optimise fonts and images; ship the hero without waiting on client JS.
- **Accessibility:** semantic HTML, visible keyboard focus, `prefers-reduced-motion` honoured, AA contrast (the token system is built for it), full keyboard paths through nav, simulator, and tabs.
- **Responsive** down to small mobile — every page, including the simulator (which gets a compacted layout, not a broken one).
- **SEO:** per-page metadata, dynamic OG images, sitemap; the Hard Parts library is the organic-growth engine (doc 04).

## 12. What "done" looks like for Phase A vs Phase B

- **Phase A (pencil) is done when:** every page in doc 01 has a reviewed low-fi layout; the simulator has an interaction storyboard (states + transitions); the motion catalog (doc 03) is mapped to specific sections; and the copy for the hero and section headers is drafted. Nothing is "designed" in high fidelity yet.
- **Phase B (build) is done when:** the site is live to the quality floor above, every value derives from the design system, the simulator hits the real sandbox, the Hard Parts library renders from MDX, and it passes the accessibility and performance targets.

Proceed to doc 01.
