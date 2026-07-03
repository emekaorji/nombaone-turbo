# Nomba One · Console Plan · 06 · Components

> **What this is.** The console component library and the app-level extensions to the shared design system. It specifies every primitive the console reuses from the `.pen` design language v2, every net-new app component the marketing system lacks, the app type and density scale, the overlay and z-index layer model, and the finite-state-machine status-badge system that renders one badge per state for every resource enum. It is authored so a build can lift each component into the shared `@nombaone/ui` package and back-port it into `workbench/NOMBAONE.pen` without redesign. Cited token names, status enums, DTO fields, endpoint paths, and error codes are real and confirmed against the repository. Where a name is not confirmable in code, it is marked "(verify)".
>
> **Depends on:** doc 00 (north star, personas, scope boundary, inherited design language, voice), doc 01 (information architecture and navigation), and the shipped surfaces it renders: `packages/core-contracts/src/types/*` (DTOs and status enums), `packages/errors/src/codes.ts` (error taxonomy), `apps/api/src/apps/main/modules/*` (routes), and `workbench/apps/website/nomba-one-design-system.html` (design language v2). Docs 02 through 05 consume these components; doc 07 specifies their motion.

---

## 1. The binding token set

The console introduces no new values. Every component reads the design language v2 tokens verbatim. Components consume Tier-2 semantic tokens only. They never read a Tier-1 primitive directly, so light mode stays a pure token remap and no component restyles itself. This section is the binding source. Any value not listed here does not exist for the console.

### 1.1 Semantic colors (dark default, light remap)

| Token | Dark | Light | Role in the console |
|---|---|---|---|
| `--background` | `#040404` | `#fcfcfc` | App canvas behind the shell |
| `--surface-1` | `#0d0d0d` | `#ffffff` | Cards, sidebar, drawer panel, table container |
| `--surface-2` | `#171717` | `#f6f6f6` | Inputs, table zebra band, hover fill |
| `--surface-3` | `#232323` | `#ededed` | Pressed rows, neutral pill fill, code panel chrome |
| `--foreground` | `#fafafa` | `#0d0d0d` | Primary text, numerals |
| `--muted-foreground` | `#9e9e9e` | `#525252` | Secondary text, column headers, meta |
| `--subtle-foreground` | `#696969` | `#7a7a7a` | Placeholders, mono labels, timestamps |
| `--border` | `#262626` | `#dedede` | The universal 0.5px hairline |
| `--border-strong` | `#424242` | `#bebebe` | Hover borders, focused field rest border |
| `--primary` | `#fafafa` | `#0d0d0d` | Primary button fill |
| `--primary-foreground` | `#0a0a0a` | `#fcfcfc` | Text on primary |
| `--accent` | `#0bdfa3` | `#00a473` | The one accent: primary action highlight, links, focus, the active subscription, the recovery moment |
| `--accent-hover`, `--accent-muted`, `--accent-border`, `--accent-foreground` | derived | derived | Accent hover, tinted fill, tinted border, text on accent |
| `--ring` | `#0bdfa3` | `#00c38b` | Focus ring |
| `--success` / `--success-bg` | `#58cd78` | `#0e8c41` | Money confirmed good, recovery, delivered |
| `--warning` / `--warning-bg` | `#f6b84d` | `#df9134` | Needs attention, in flight, not yet bank-confirmed |
| `--danger` / `--danger-bg` | `#f14949` | `#cc3336` | Failed, dead, churned, uncollectible |
| `--info` / `--info-bg` | `#1899ec` | `#0076d3` | Trialing, open, scheduled, pending delivery |

Primitive ramps exist for reference only: `--gray-50` through `--gray-1000`, `--emerald-50` through `--emerald-900`, and the `400`/`500` stops of `--red`, `--amber`, `--blue`, and `--grn`. No console component names a primitive.

Accent restraint is a hard rule. Emerald appears on the primary action, on links, on the focus ring, on the single `active` subscription state, and on the moment a payment recovers. It never tints table chrome, sidebars, or headers. When you see emerald, it means something.

### 1.2 Spacing, radii, motion, type

**Spacing (base ramp):** `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-6` 24, `--space-8` 32, `--space-12` 48, `--space-16` 64. The ramp skips 20 and 40. The console adds two density steps in section 4, `--space-5` 20 and `--space-10` 40, so dense table and form rhythm does not round to the wrong step.

**Radii:** `--r-sm` 6, `--r` 8, `--r-md` 10, `--r-lg` 14, `--r-xl` 20, `--r-full` 999.

**Motion:** durations `--dur-fast` 120, `--dur-base` 200, `--dur-slow` 320, `--dur-slower` 520. Easings `--ease-out` for entrances, `--ease-in-out` for ambient loops, `--ease-spring` reserved for the one earned peak, the payment recovery pulse. Components animate transform and opacity only, and honor `prefers-reduced-motion`. Doc 07 owns the full motion spec; this doc names only the token each component binds.

**Fonts:** `--font-sans` Geist, `--font-mono` Geist Mono. Numerals and money use `font-variant-numeric: tabular-nums` so columns align.

### 1.3 The money law (binding on every component that shows or takes an amount)

Money is integer kobo on the wire. Every money field ends in `InKobo` (for example `unitAmountInKobo`, `amountDueInKobo`, `netToTenantInKobo`, `mrrInKobo`). The console renders naira by dividing by 100 with integer arithmetic, never with floats, and always with `tabular-nums` and the `NGN` marker. A value of `250000` renders as `₦2,500.00`.

No component sends a naked amount to a charge or renewal path. There is a known and unresolved 100x risk: the Nomba charge and renewal endpoint unit is not yet live-confirmed as kobo, and if it expects naira while the console sends kobo, every renewal is 100 times too large. Any component that captures an amount (the amount input in section 14) or emits a charge call (the reproduce-this-object panel in section 12) pins the unit explicitly, converts at the boundary, and annotates the unit inline. This constraint repeats at each such component below.

---

## 2. Component principles and the reuse contract

Five rules govern the whole library. Every component section restates the ones it depends on.

1. **Tier-2 only.** Components read semantic tokens. A component that hardcodes a hex or names a primitive is a defect.
2. **Reuse before build.** If a `.pen` primitive already covers a need, the console reuses it as-is. Section 3 lists the inherited set. Net-new components exist only where the marketing system has no equivalent.
3. **One vocabulary.** Every label, badge, and action name uses the exact resource nouns and status enums from the API. No synonyms. `subscription.canceled` (voluntary) and `subscription.churned` (involuntary) are different outcomes and never share a label.
4. **Name from the user's side.** A merchant manages plans, subscriptions, and payouts. A developer manages webhook endpoints, events, and keys. Components carry the noun the person on that screen owns.
5. **Errors and empty states give direction.** Every component that can fail renders `error.hint` verbatim, the `error.docUrl` link, and `meta.requestId`. Every empty state states the next action. No mood copy.

**Two-phase method.** Phase A designs each component as a low-fi frame in Pencil against the wireframes in this doc. Phase B builds it to token-bound spec in `@nombaone/ui`. Each component below states its Phase A done criterion (the frame reads correctly in dark and light with real enum labels) and its Phase B done criterion (the built component passes the token, state, and accessibility checks named in its section). Once frames exist in `NOMBAONE.pen`, the `.pen` file is the 1:1 gate.

---

## 3. Inherited primitives from the `.pen` (reuse as-is)

The design language v2 ships 33 components. The console inherits the app-relevant ones verbatim and extends only where noted. It does not fork them.

### 3.1 Inherited without change

| `.pen` component | CSS entry | Console reuse |
|---|---|---|
| **Button** | `.btn` with `.btn-primary`, `.btn-accent`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, sizes `.btn-sm`/`.btn-lg`, `.spinner`, `:disabled`, `:focus-visible` ring | Every action. Primary for the main action per screen, accent held for the single emphasized call to action, danger for destructive confirms, ghost for table row actions. |
| **Pill** | `.pill` with `.pill-neutral`/`-accent`/`-success`/`-warning`/`-danger`/`-info`, `.dot`, `.dot.live` | The base of the status-badge system (section 6). The console defines label and token per enum state on top of these six variants. |
| **Input** | `.input`, `label.fl`, `.hint`, `.hint.err`, `.input.invalid`, focus ring, `textarea.input` | Text, number, email, search fields. The base for the amount input, combobox trigger, and secret field. |
| **Card** | `.content-card` / `.card` container, 0.5px border, `--r-lg`, `--surface-1` | Metric tiles, drawer sections, form panels, empty-state frames. |
| **Callout** | `.callout` with `.ci` icon and `.ct` text, accent-tinted | Inline honesty notes, the escrow explainer, the "cannot be retrieved again" secret warning, the price-immutability note. |
| **CodeBlock** | `.code`, `.code-wrap`, `pre`, syntax spans `.kw`/`.st`/`.cm`, `.copy` | The base of the reproduce-this-object panel and every raw-JSON view. |
| **LangTabs** | `.tabs`, `.tab`, `.tab.active` underline | Node, Python, and cURL tabs in the reproduce panel; the request and response tabs in the delivery inspector. |
| **StatBand** | the big-numeral band pattern | The base for the metric stat row (section 11), retuned to the app numeral size. |
| **WebhookTicker** | the streaming delivery row pattern | The base for the live delivery and event stream (section 13), rebound to real `webhook_deliveries`. |
| **NavItem** | `.nav` item pattern | Sidebar items in the app shell (section 17). |
| **Header** | `header .bar`, sticky, `z-index: 50`, backdrop blur | The app top bar chrome and z-index parity. |
| **MobileHeader**, **NavSheet** | compact header and slide-in sheet | The responsive shell below 900px: the sidebar collapses into a `NavSheet`. |
| **Footer** | `footer` | The app footer strip (version, environment, status link). |
| **SectionHeader** | `.sec-head`, `.sec-num`, `.sec-desc` | Section headers inside detail drawers and settings pages. |
| **Tag** | `.chip` | Non-status classifications rendered as neutral mono tags: `collectionMethod`, `PaymentMethodKind`, `DunningBranch`, `OrgUserRole`, `billingReason`. |
| **LifecycleRail** | the vertical staged rail from the site | The structural base for the timeline and event stream (section 10). |
| **SimulatorStage** | the framed live-demo stage | The frame for the in-console test clock and the bill-fail-recover preview. |

### 3.2 Marketing-only, not inherited

These are page-marketing components with no app job: **Swatch**, **TokenRow**, **LogoWordmark** (the console uses the wordmark in the shell but not the swatch tooling), **FeatureLine**, **TrustItem**, **GuideCard**, **UseCaseCard**, **CTABand**, **HeroGlow**, **PricingTier**, **FAQItem**, **MatrixTile**, **ChangelogEntry**, **ArticleBeat**. The console does not import them. If a settings or onboarding page needs a marketing-style beat, it reuses `Callout` and `Card` rather than pulling a marketing component into the app bundle.

**Phase A done:** each inherited primitive renders in a console frame with app content and reads correct in dark and light. **Phase B done:** the console imports the primitive from `@nombaone/ui` with zero style overrides beyond documented app extensions.

---

## 4. App type scale and density scale

The marketing scale runs big: a hero display to 96px, inner-page H1 near 72px, body 20 to 24px. That scale is wrong for a table-heavy product surface. The console defines a denser working scale derived from the same font and color tokens. It introduces no new fonts and no new colors.

### 4.1 App type scale

| Token (proposed) | Size / line-height | Weight | Use |
|---|---|---|---|
| `--app-metric` | 32 / 1.1 | 600, tabular-nums | The single numeral on a metric tile |
| `--app-title` | 22 / 1.25 | 600 | Page title in the shell header row |
| `--app-h2` | 17 / 1.3 | 600 | Section header inside a page or drawer |
| `--app-h3` | 15 / 1.35 | 600 | Card title, drawer subsection, form group |
| `--app-body` | 14 / 1.5 | 400 | Default body, form values, drawer field values |
| `--app-body-sm` | 13 / 1.5 | 400 | Table cell text, secondary detail |
| `--app-caption` | 12 / 1.4 | 400 | Meta, helper text, timestamps (muted or subtle) |
| `--app-micro` | 11 / 1.3 | 500, mono | Column headers, key prefixes, references, tags |

Money numerals always use `tabular-nums`. References (the `nbo…` ids) and timestamps always use `--font-mono` at `--app-micro` or `--app-caption`.

### 4.2 Density spacing (the added steps)

The console adds the two missing ramp steps and uses them for app rhythm:

- `--space-5` 20: the default table row vertical padding (comfortable density) and the gap between form groups.
- `--space-10` 40: the gap between major page regions and the drawer section spacing.

Console table density has two modes bound to these steps:

- **Comfortable** (default): row padding `--space-3` vertical (12) inside a `--space-5` (20) row rhythm, cell horizontal padding `--space-4` (16).
- **Compact** (opt-in per table, remembered per user): row padding `--space-2` (8), cell horizontal padding `--space-3` (12).

### 4.3 App container width

The marketing container is `1080px`. It is too narrow for the invoice, subscription, and delivery tables. The console defines a wider app frame:

- `--app-max` 1440: the outer app width. Content centers within it.
- `--app-sidebar` 248: fixed left navigation width. `--app-rail` 64: the collapsed rail width below the sidebar breakpoint.
- `--app-content-max` 1120: the readable measure for forms, detail drawers, and settings, so long-form reading never sprawls.
- Tables and the delivery stream stretch to fill the full content region inside `--app-max`, not the 1120 reading measure, and scroll horizontally inside their own `overflow-x: auto` container when columns exceed the viewport. The page body never scrolls horizontally.

Breakpoints: the marketing system defines one at 640px. The console adds `900px` (sidebar collapses to `NavSheet`, tables enter compact-by-default) and holds a `390px` floor (single column, drawer becomes a full-height sheet, filter bar collapses to a single "Filter" button that opens a sheet).

**Phase A done:** a frame at 1440, 900, and 390 shows the type scale and container widths holding without horizontal body scroll. **Phase B done:** the scale and spacing steps are tokens in `@nombaone/ui`, and a table at 390 scrolls inside its own container only.

---

## 5. The overlay and z-index layer model

Today the design system defines only two stacking contexts: the header at `z-index: 50` and the toast at `z-index: 99`. The console needs modals, drawers, dropdowns, comboboxes, date pickers, and tooltips, several of which stack on top of each other (a combobox opened inside a drawer must float above the drawer). This section defines the full layer scale as tokens, to be back-ported into the shared system.

| Token (proposed) | Value | Layer |
|---|---|---|
| `--z-base` | 0 | Page content |
| `--z-sticky` | 10 | Sticky table header, sticky section headers, pinned first column |
| `--z-sidebar` | 20 | The left navigation |
| `--z-topbar` | 50 | The app top bar (parity with the inherited header) |
| `--z-drawer` | 1000 | Detail drawer and slide-over. Scrim 1000, panel 1001 |
| `--z-modal` | 1100 | Modal and confirm dialog. Scrim 1100, panel 1101. Sits above a drawer, so a confirm launched from inside a drawer is reachable |
| `--z-popover` | 1200 | Menus, combobox listbox, multi-select, date picker, select. Portalled to the document body so they always float above the surface that opened them |
| `--z-tooltip` | 1300 | Tooltips |
| `--z-toast` | 9999 | Toasts. Always the topmost layer |

Rules the model enforces:

- **Popovers portal.** Menus, comboboxes, and date pickers render in a body-level portal at `--z-popover`, not inside their trigger's DOM subtree, so an overflow-clipped table cell or a drawer cannot clip them and they always sit above the surface that opened them.
- **Scrims are shared.** The drawer scrim and modal scrim use the same fill, `color-mix(in oklch, var(--background) 60%, transparent)` with a `2px` backdrop blur, and animate opacity over `--dur-base` `--ease-out`.
- **Toast supersedes.** The console raises the toast layer above popovers and tooltips. The marketing value of 99 was sufficient because the site had no popovers; the app needs the full stack, and a toast must beat everything. This raises the inherited `99` to `9999` and is a documented extension, not a conflict.
- **One scrim at a time.** Opening a modal from a drawer does not stack a second scrim; the modal scrim replaces the drawer scrim visually while the drawer stays mounted beneath.
- **Focus and dismissal.** Every scrimmed layer traps focus, restores focus to the trigger on close, closes on `Escape`, and closes on scrim click unless it holds a dirty form (then it routes through the confirm dialog in section 15).

**Phase A done:** frames show a combobox open inside a drawer, and a confirm dialog open inside a drawer, both correctly above their parent. **Phase B done:** the layer tokens exist in `@nombaone/ui`, popovers portal, focus traps and `Escape` work, and no two scrims stack.

---

## 6. The finite-state-machine status-badge system

The single most repeated component in the console. Every list cell, drawer header, and timeline node that shows a resource state renders exactly one badge, one badge per state, for every enum in the API. The badge is a `.pill` bound to a semantic token, plus a sentence-case label that is the human reading of the enum, never a synonym.

### 6.1 Anatomy, variants, and states

**Anatomy:** an inline pill, `--r-full`, 0.5px border, `--app-micro` to `--app-caption` label, an optional leading `.dot` (6px) that inherits the pill's foreground, and an optional `.dot.live` that pulses (`--dur` 1.6s, `--ease-in-out`) reserved for the few live moments named below.

**Variants (the six inherited pill tokens):**

| Variant | Fill / text | Meaning in the console |
|---|---|---|
| `pill-neutral` | `--surface-3` / `--muted-foreground` | Inert, terminal-benign, draft, disabled, or a clean intended end |
| `pill-accent` | `--accent-muted` / `--accent` | The one healthy revenue state: a subscription that is `active` |
| `pill-success` | `--success-bg` / `--success` | Money confirmed good, recovered, delivered |
| `pill-warning` | `--warning-bg` / `--warning` | Needs attention, in flight, not yet bank-confirmed |
| `pill-danger` | `--danger-bg` / `--danger` | Failed, dead, churned, uncollectible |
| `pill-info` | `--info-bg` / `--info` | Awaiting a normal next step: trialing, open, scheduled, pending delivery |

A `neutral-muted` treatment (neutral fill with `--subtle-foreground` text) distinguishes an archived or ended catalog object from a merely draft one.

**Live-dot budget (scarce by rule):** the pulsing dot appears only on a subscription `active` badge at the instant of recovery, on a dunning attempt while `attempting` and on its `succeeded` (recovered) badge, and on a webhook delivery while `pending` (in flight). Nowhere else.

### 6.2 The canonical inherited mapping (verbatim from design language v2)

The design system ships six canonical status pills. The console inherits this mapping unchanged as its baseline, then extends it per enum in 6.3.

| Canonical label | Variant | Notes |
|---|---|---|
| Draft | neutral | |
| Active | accent | |
| Payment recovered | success | with live dot |
| Past due | warning | |
| Canceled | danger | |
| Trialing | info | |

### 6.3 The full per-enum badge map

Every state below is a real enum member confirmed in `packages/core-contracts/src/types`. Labels are sentence case.

**Subscription (`SubscriptionStatus`, 7 states) plus the cancellation split:**

| State | Label | Variant | Gating note |
|---|---|---|---|
| `incomplete` | Incomplete | warning | Awaiting first payment; expires if unpaid |
| `incomplete_expired` | Expired | neutral | Terminal, never activated |
| `trialing` | Trialing | info | |
| `active` | Active | accent | Live dot only at the recovery moment |
| `past_due` | Past due | warning | In dunning |
| `paused` | Paused | neutral | Intentionally on hold |
| `canceled` + `cancellationReason: voluntary` | Canceled | neutral | A clean intended end reads calm, not alarming |
| `canceled` + `cancellationReason: involuntary` | Churned | danger | A revenue loss reads red |

The cancellation split is a deliberate console refinement of the canonical "Canceled to danger" pill. The API models one status, `canceled`, and carries the reason in `cancellationReason` and in the distinct events `subscription.canceled` versus `subscription.churned`. The console renders these as visibly different badges so voluntary and involuntary outcomes are never conflated. Same status enum, two badges, two labels, two tokens.

**Invoice (`InvoiceStatus`, 6 states). Status is derived, never stored.**

| State | Label | Variant |
|---|---|---|
| `draft` | Draft | neutral |
| `open` | Open | info |
| `partially_paid` | Partially paid | warning |
| `paid` | Paid | success |
| `void` | Void | neutral |
| `uncollectible` | Uncollectible | danger |

**Dunning (`DunningAttemptStatus`, 6 states, plus the rolled-up `none`):**

| State | Label | Variant | Note |
|---|---|---|---|
| `none` | Not in recovery | neutral | The rolled-up `DunningStateResponseData.status` when nothing is due. A good state |
| `scheduled` | Scheduled | info | |
| `attempting` | Attempting | info | Live dot while running |
| `rescheduled` | Rescheduled | warning | Payday-biased next attempt |
| `card_update_required` | Card update needed | warning | The UI routes to a card swap or the fresh checkout link, never a blind retry |
| `succeeded` | Recovered | success | Live dot; the earned recovery peak |
| `exhausted` | Exhausted | danger | Leads to churn |

`DunningBranch` (`reschedule`, `card_update_required`, `short_path`) is a classification, not a health state. It renders as a neutral mono `Tag`, not a colored badge.

**Payment method (`PaymentMethodStatus`, 5 states):**

| State | Label | Variant |
|---|---|---|
| `setup_pending` | Setup pending | warning |
| `consent_pending` | Consent pending | warning |
| `active` | Active | success |
| `removed` | Removed | neutral |
| `expired` | Expired | danger |

`PaymentMethodKind` (`card`, `virtual_account`, `mandate`) renders as a neutral `Tag`.

**Settlement (`SettlementStatus`, 5 states):**

| State | Label | Variant |
|---|---|---|
| `pending` | Pending | warning |
| `settled` | Settled | success |
| `reconciled` | Reconciled | success |
| `failed` | Failed | danger |
| `refunded` | Refunded | neutral |

**Refund (`RefundStatus`, 4 states). Honest interim states matter here.**

| State | Label | Variant | Note |
|---|---|---|---|
| `pending` | Pending | warning | |
| `ledger_only` | Ledger only | warning | Money not yet returned to the customer. Live-gated provider leg |
| `succeeded` | Refunded | success | |
| `failed` | Failed | danger | |

**Payout (`PayoutStatus`, 4 states). Honest interim states matter here.**

| State | Label | Variant | Note |
|---|---|---|---|
| `pending` | Pending | warning | |
| `ledger_posted` | Ledger posted | warning | Not bank-confirmed. Provider leg is flag-gated by `NOMBA_PAYOUT_ENABLED` |
| `succeeded` | Paid out | success | |
| `failed` | Failed | danger | |

**Webhook delivery (`WebhookDeliveryStatus`, 4 states):**

| State | Label | Variant | Note |
|---|---|---|---|
| `pending` | Pending | info | Live dot while in flight |
| `succeeded` | Delivered | success | |
| `failed` | Failed | warning | Still retrying within the backoff window |
| `dead` | Dead | danger | Exhausted after 6 attempts. Replayable |

**Catalog and secondary states (calm by rule, no accent splash):**

| Enum | State | Label | Variant |
|---|---|---|---|
| `PlanStatus` | `active` | Active | neutral |
| `PlanStatus` | `archived` | Archived | neutral-muted |
| `PriceResponseData.active` | `true` | Active | neutral |
| `PriceResponseData.active` | `false` | Inactive | neutral-muted |
| `DiscountStatus` | `active` | Active | neutral |
| `DiscountStatus` | `ended` | Ended | neutral-muted |
| `SubscriptionScheduleStatus` | `active` | Scheduled | info |
| `SubscriptionScheduleStatus` | `released` | Applied | neutral |
| `SubscriptionScheduleStatus` | `canceled` | Canceled | neutral-muted |
| `nombaAccount.status` | `pending` | Pending | warning |
| `nombaAccount.status` | `active` | Connected | success |
| `nombaAccount.status` | `suspended` | Suspended | danger |

`CouponDuration` (`once`, `repeating`, `forever`), `CollectionMethod` (`charge_automatically`, `send_invoice`), `CreditGrantSource` (`downgrade_proration`, `manual`, `goodwill`, `coupon`), `InvoiceBillingReason`, and `OrgUserRole` (`owner`, `admin`, `developer`, `viewer`) are classifications, not health states, and render as neutral `Tag`s.

Wireframe (Phase A reference):

```
Subscription    Invoice        Dunning              Delivery
[●Active   ]    [Paid    ]     [●Recovered]         [○Pending  ]
 accent          success        success live         info live
[Past due  ]    [Open    ]     [Card update needed]  [Delivered ]
 warning         info           warning               success
[Churned   ]    [Uncoll..]     [Exhausted ]          [Dead      ]
 danger          danger         danger                danger
```

**Phase A done:** one frame renders every state above with its real label and token, in dark and light. **Phase B done:** a single `<StatusBadge resource state reason?>` component maps every enum to the table above, the live-dot budget is enforced, and an unknown state renders neutral with the raw enum string rather than crashing.

---

## 7. Data table

The console has no data table today; the marketing system never needed one. This is the workhorse of the subscription, invoice, customer, settlement, delivery, and event lists. Worked example throughout: the subscriptions list.

### 7.1 Purpose and data

Render a cursor-paginated list of one resource, one row per object, with per-column status badges and row-scoped actions. Example data, the subscriptions list from `GET /v1/subscriptions`: each row shows `id` (the `nbo…sub` reference, mono), `customerId`, the `status` badge, `collectionMethod` tag, `currentPeriodEnd` (renders "Renews {date}"), and the amount from the latest invoice as `₦{amountDueInKobo / 100}` with `tabular-nums`. Money cells obey the money law in section 1.3: integer kobo divided by 100, never a float.

### 7.2 Anatomy

- **Container:** `--surface-1`, 0.5px `--border`, `--r-lg`, `overflow-x: auto` so wide tables scroll inside themselves and never push the body.
- **Header row:** `--app-micro` mono, `--muted-foreground`, sticky at `--z-sticky` inside the scroll region, 0.5px bottom border.
- **Sort control:** a header cell is a button when sortable; an up or down caret shows the active sort. Sort is keyed to a real query param (`?sort=createdAt&order=desc`, verify param name per module) and re-fetches from the cursor start.
- **Body rows:** `--app-body-sm`, zebra on `--surface-2` for even rows, hover raises to `--surface-2` (or `--surface-3` on an already-zebra row), pressed to `--surface-3`. A whole row is a link to the detail drawer; the row action menu stops propagation.
- **Cells:** left-aligned text, right-aligned money and numerics with `tabular-nums`, badges and tags inline. A cell truncates with an ellipsis and reveals full text in a tooltip (`--z-tooltip`).
- **Row selection:** an optional leading checkbox column (section 14 checkbox). Selecting rows raises a selection action bar docked above the table header showing the count and the allowed bulk actions.
- **Row actions:** a trailing `--btn-ghost` icon that opens a menu (`--z-popover`) of row-scoped actions, each gated by FSM (see 7.4).
- **Pagination:** a single "Load more" button below the last row, never page numbers and never a total. It reads `pagination.hasMore` and `pagination.nextCursor` from the envelope and appends the next page. When `hasMore` is false the button is replaced by an end marker, "End of results." An optional auto-load-on-scroll variant uses the same cursor. Totals do not exist in the API and the table never invents one.

### 7.3 States

- **Loading (first page):** skeleton rows (section 15), 8 by default, matching the column layout. No spinner-only blank.
- **Loading (next page):** the "Load more" button shows its `.spinner` while the current rows stay in place.
- **Empty:** the empty-state pattern (section 15) inside the table container, with the resource's next action, for example "No subscriptions yet. Create your first subscription." Never a blank grid.
- **Error:** an inline error panel replacing the body, rendering `error.hint`, the `docUrl` link, `meta.requestId`, and a retry button. A `RATE_LIMIT_EXCEEDED` error shows the reset hint and disables retry until it passes.
- **Stale during refetch:** existing rows dim to 60% opacity while a filter change refetches, so the table never flashes empty.

### 7.4 FSM-aware action gating (worked example)

Row actions on a subscription are enabled only for states the FSM permits, so the console never offers an action the API will reject:

- `active` or `trialing`: Pause (`POST /v1/subscriptions/{id}/pause`), Cancel (`POST /v1/subscriptions/{id}/cancel`), Change plan (`POST /v1/subscriptions/{id}/change`).
- `paused`: Resume (`POST /v1/subscriptions/{id}/resume`) only.
- `past_due`: Update card (`POST /v1/subscriptions/{id}/payment-method`), Cancel. Never a blind Retry.
- `canceled` or `incomplete_expired`: Resubscribe (`POST /v1/subscriptions/{id}/resubscribe`), which mints a new subscription because canceled is terminal. No in-place reactivation is offered.

Every money-moving row action carries an `Idempotency-Key` (see the money law and section 15's confirm dialog). If the API still rejects with `SUBSCRIPTION_ILLEGAL_TRANSITION`, the row disables that action and surfaces the hint. On `SUBSCRIPTION_VERSION_CONFLICT` the row silently re-fetches and retries once, because a scheduler pass may have advanced the subscription concurrently.

Wireframe:

```
┌ Subscriptions ──────────────────────────────────────────── [Compact ▢] ┐
│ ☐  REFERENCE        CUSTOMER          STATUS        METHOD      RENEWS   ⋮│
├─────────────────────────────────────────────────────────────────────────┤
│ ☐  nbo…4471sub      ada@shop.ng      [●Active ]    Automatic   Aug 12   ⋮│
│ ☐  nbo…9920sub      l6@studio.io     [Past due]    Automatic   Jul 30   ⋮│
│ ☐  nbo…1180sub      kemi@saas.ng     [Trialing]    Send invoice Aug 01  ⋮│
│ ☐  nbo…7745sub      obi@gym.ng       [Churned ]    Automatic   n/a      ⋮│
├─────────────────────────────────────────────────────────────────────────┤
│                        [ Load more ]                                     │
└─────────────────────────────────────────────────────────────────────────┘
   selection bar (when rows checked):  2 selected   [Cancel]  [Export]
```

**Phase A done:** the subscriptions frame shows real references, badges, the "Load more" control with no total, and a compact toggle. **Phase B done:** the table reads the paginated envelope, appends by cursor, gates row actions by FSM, scrolls inside its container at 390px, and renders skeleton, empty, and error states.

---

## 8. Filter bar and faceted filters

Sits directly above a data table and drives its query. Every facet maps to a real query parameter, so the URL is shareable and the back button restores state.

### 8.1 Anatomy and facets

- **Layout:** a horizontal row of facet controls above the table, left aligned, that wraps at 900px and collapses to a single "Filter" button opening a sheet at 390px.
- **Status facet:** a multi-select of the exact enum members for the resource, keyed to `?status=`. On subscriptions the options are the seven `SubscriptionStatus` members rendered with their section 6 badges. On webhook deliveries the options are the four `WebhookDeliveryStatus` members, keyed to the confirmed `GET /v1/webhooks/{id}/deliveries?status=` param.
- **Type facet:** on the events feed, an event-type select keyed to `?type=`, sourced from the 34-type catalog at `GET /v1/events/catalog`. On the deliveries inspector, `?eventType=`.
- **Environment:** not a filter. The test or live ring is chosen once in the shell environment switcher (section 17); the filter bar never mixes rings.
- **Date range:** a from and to control (section 14 date picker) keyed to the module's real range params (verify exact names per module, for example `?createdFrom=&createdTo=`).
- **Search:** a free-text reference or email search where the module supports it (verify per module).
- **Active-filter chips:** each applied facet renders a removable `.chip` below the bar; a "Clear all" ghost button resets to the default query.

### 8.2 States

- **Default:** no facets applied, the table shows the unfiltered first page.
- **Applied:** chips summarize the query; the table refetches from cursor start (a filter change invalidates the cursor).
- **Empty result:** the table's empty state distinguishes "no data yet" from "no matches for this filter" and offers "Clear filters" in the latter.
- **Invalid facet value:** the API returns `CLIENT_VALIDATION_FAILED` with `error.fields`; the offending facet shows the field hint inline and reverts.

Wireframe:

```
[ Status ▾ ]  [ Method ▾ ]  [ Created: last 30d ▾ ]  [ Search reference ]   [Clear all]
  active ✕   past_due ✕                                    ← active-filter chips
```

**Phase A done:** the bar frame shows status facets as badges, active-filter chips, and the 390px collapsed sheet. **Phase B done:** each facet writes its real query param to the URL, a change refetches from cursor start, and the back button restores prior state.

---

## 9. Detail drawer and slide-over sheet

The primary "inspect one object" surface. A right-anchored slide-over that keeps the list context behind it, rather than a full route change. Used for a subscription, an invoice, a customer, a settlement, a webhook delivery, and an event.

### 9.1 Anatomy

- **Panel:** anchored right, width `min(560px, 100vw)`, `--surface-1`, 0.5px left `--border`, at `--z-drawer` over the shared scrim. Below 640px it becomes a full-height bottom-or-full sheet.
- **Header:** the object's reference (mono), its primary status badge, a copy-reference button, and a close control. Optionally breadcrumb-linked to the full page.
- **Body sections:** stacked `SectionHeader` groups at `--space-10` rhythm. For a subscription drawer: Summary (status, `currentPeriodStart` to `currentPeriodEnd`, `collectionMethod`, `defaultPaymentMethodId`), Items (`items[]` with `priceId` and `quantity`), Latest invoice (`latestInvoiceId` with its derived status and `amountDueInKobo` as naira), Timeline (section 10 from `GET /v1/subscriptions/{id}/events`), Upcoming invoice (`GET /v1/subscriptions/{id}/upcoming-invoice`), and Reproduce (section 12).
- **Action footer:** sticky at the panel bottom, holding the FSM-gated primary and secondary actions for the object, mirroring the row-action gating in 7.4. Money-moving actions route through the confirm dialog and carry an `Idempotency-Key`.
- **Field row:** a two-column label and value grid; labels `--muted-foreground` `--app-caption`, values `--app-body`; money values right-aligned tabular; references mono with a copy affordance.

### 9.2 States

- **Loading:** the header renders from the list row immediately; the body shows skeleton field rows while `GET /v1/subscriptions/{id}` and its sub-resources resolve.
- **Empty sub-resource:** "No invoices yet" or "Not in recovery" per the relevant empty state, not a blank section.
- **Error:** a section-level error panel with `hint`, `docUrl`, and `requestId`; the rest of the drawer stays usable.
- **Dirty close:** if the drawer holds an unsaved edit, closing routes through the confirm dialog rather than discarding silently.

Wireframe:

```
                              ┌ nbo…4471sub  [●Active]      [⧉]  [✕] ┐
                              │ SUMMARY                             │
   (list dimmed behind        │  Customer      ada@shop.ng          │
    the scrim)                │  Period        Jul 12 → Aug 12      │
                              │  Method        Automatic            │
                              │  Default rail  Card •• 4242          │
                              │ LATEST INVOICE                      │
                              │  nbo…8830inv   [Paid]   ₦2,500.00   │
                              │ TIMELINE                            │
                              │  ● invoice.paid          Jul 12     │
                              │  ● subscription.activated Jul 12    │
                              │ REPRODUCE                 [Node ▾]  │
                              │  const s = await nomba.subscriptions│
                              ├─────────────────────────────────────┤
                              │           [Change plan]  [Cancel]   │
                              └─────────────────────────────────────┘
```

**Phase A done:** the subscription drawer frame shows all sections with real DTO fields and a gated action footer. **Phase B done:** the drawer opens over the scrim at `--z-drawer`, traps focus, lazy-loads sub-resources, and its footer actions gate by FSM and confirm before money moves.

---

## 10. Timeline and event stream

A vertical, status-dotted history. It renders a subscription's real lifecycle, an invoice's attempts, or a delivery's retries, and it is the console analog of the marketing simulator, on real data.

### 10.1 Purpose and data

For a subscription, `GET /v1/subscriptions/{id}/events` returns the append-only `domain_events` for that object. Each node is one event, rendered with its type in the exact catalog vocabulary, its `createdAt` (mono), and a dot colored by the event's meaning. The vocabulary is the 34-type catalog: `invoice.created`, then `invoice.payment_failed`, then `invoice.action_required`, then `invoice.payment_recovered`, or the involuntary branch to `subscription.churned`. Voluntary `subscription.canceled` and involuntary `subscription.churned` render as visibly different nodes, matching the badge split in 6.3.

### 10.2 Anatomy, variants, states

- **Rail:** a `LifecycleRail`-based vertical line at `--border`, dots at each node, `--space-5` node rhythm.
- **Node dot:** colored by event class using the section 6 tokens. `*.paid`, `*.payment_recovered`, `*.activated` use `--success` (the recovered node pulses once with `--ease-spring`, the one earned peak). `*.payment_failed`, `*.action_required`, `*.past_due` use `--warning`. `*.churned`, `*.voided`, `*.canceled`-involuntary use `--danger`. Creation and neutral lifecycle events use `--muted-foreground`.
- **Node body:** event type (mono, `--app-body-sm`), a one-line human gloss drawn from the catalog `when` text, the timestamp, and an expand affordance that reveals the event `payload` as raw JSON (section 13 raw view) with the `id` (the `evt` reference and dedupe key).
- **Variants:** compact (dot plus type plus time, for a drawer) and expanded (with gloss and payload, for a full audit page).
- **Loading:** skeleton nodes. **Empty:** "No events yet" (a new subscription has none until its first cycle). **Error:** inline panel with `hint`, `docUrl`, `requestId`.

Wireframe:

```
● invoice.created            an invoice is created for a period      Jul 12 09:00
│
● invoice.payment_failed     a collection attempt failed             Jul 12 09:01
│   reason: insufficient_funds                                  [expand payload ▾]
● invoice.action_required    card charge needs authentication (OTP)  Jul 12 09:02
│   checkoutLink attached
●(pulse) invoice.payment_recovered  a dunning retry recovered it     Jul 15 08:14
```

**Phase A done:** the timeline frame renders a real bill-fail-recover sequence with correct dot colors and the recovered pulse. **Phase B done:** nodes bind to `domain_events`, render the exact event vocabulary, expand to raw payload, and honor reduced motion.

---

## 11. Metric tiles and the stat row

Renders `BillingMetricsData` from `GET /v1/metrics/billing` at the top of the overview. Built on `StatBand`, retuned to the app numeral size.

### 11.1 Anatomy and data

- **Stat row:** a responsive grid of tiles, 4 across at `--app-max`, 2 at 900px, 1 at 390px, `--space-4` gap.
- **Tile:** a `Card` with a `--app-caption` `--muted-foreground` label, an `--app-metric` (32px) `tabular-nums` numeral, and an optional delta caption. The tiles map to real fields:
  - MRR: `mrrInKobo` rendered `₦{mrrInKobo / 100}`. Money law applies: integer kobo divided by 100, no float.
  - Active subscriptions: `activeCount` (plain integer).
  - Voluntary churn: `voluntaryChurn`. Involuntary churn: `involuntaryChurn`. These are two tiles, never summed into one "churn" number, because the platform treats `subscription.canceled` and `subscription.churned` as different outcomes.
  - Failed charge rate: `failedChargeRate` as a percentage (0 to 1 times 100).
  - Recovery rate: `dunningRecoveryRate` as a percentage. This tile may carry a subtle `--success` accent because recovery is the product's proof point.
- **Dunning funnel:** an optional wider tile rendering `dunningFunnel` (`scheduled`, `attempting`, `cardUpdateRequired`, `rescheduled`, `succeeded`, `exhausted`) as a horizontal segmented bar using the section 6 dunning tokens.
- **Window:** the tiles caption the `windowFrom` to `windowTo` range (mono).

### 11.2 States

- **Loading:** each tile shows a skeleton numeral bar.
- **Empty:** a new organization with no subscriptions shows honest zeros with a "Create your first subscription" link, never fabricated data.
- **Error:** the row collapses to a single error panel with `hint`, `docUrl`, `requestId`, and retry.

Wireframe:

```
┌ MRR ────────┐ ┌ Active ─────┐ ┌ Voluntary ──┐ ┌ Involuntary ┐
│ ₦2,480,000  │ │ 312         │ │ churn  4    │ │ churn  2    │
│ this month  │ │             │ │             │ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
┌ Recovery rate ─────────────┐ ┌ Dunning funnel ─────────────────────┐
│ 71%   ●                    │ │ ▮sched ▮att ▮card ▮resc ▮ok ▮exhaust │
└────────────────────────────┘ └─────────────────────────────────────┘
```

**Phase A done:** the stat row frame shows the real field names as tiles with voluntary and involuntary churn split. **Phase B done:** tiles bind to `BillingMetricsData`, render money by the money law, and never sum the two churn fields.

---

## 12. Reproduce-this-object code panel

Extends the inherited `CodeBlock` and `LangTabs` into a "reproduce this" panel embedded in every detail drawer. It is the developer-first proof that the console shows real API objects, not a private admin projection.

### 12.1 Anatomy and data

- **Tabs:** `LangTabs` with Node, Python, and cURL, matching the SDK surface (`@nombaone/node`).
- **Body:** the exact call that fetches or recreates the object in view, prefilled with the object's real `nbo…` reference. For a subscription drawer, the Node tab shows `await nomba.subscriptions.retrieve('nbo…4471sub')`; the cURL tab shows `curl https://api.nombaone.com/v1/subscriptions/nbo…4471sub -H "Authorization: Bearer $NOMBA_KEY"`. The panel switches on the object's leading `domain` discriminator (for example `subscription`, `invoice`), never on the id suffix.
- **Copy:** the inherited `.copy` control copies the active tab verbatim and toasts "Copied".
- **Idempotency:** any recreate snippet that moves money shows the `Idempotency-Key` header with a stable example key, matching the API's requirement on money-movers.
- **Money guard:** the panel never emits a naked amount to a charge or renewal endpoint. If a snippet carries an amount, it is written in integer kobo with an inline comment naming the unit, converted at the boundary, guarding the known 100x naira-vs-kobo risk from section 1.3. A snippet that would post a raw naira value to a charge path is not generated.

### 12.2 States

- **Default:** the retrieve snippet for the object.
- **Recreate variant:** an optional second mode showing the create call with the object's real inputs (for objects that are tenant-creatable).
- **Redacted:** secrets never appear. Keys render as `$NOMBA_KEY`; signing secrets never render here (they live only in the copy-once field, section 16).

Wireframe:

```
┌ Reproduce ───────────────── [Node] [Python] [cURL]  [Copy] ┐
│ const sub = await nomba.subscriptions.retrieve(            │
│   'nbo749201835566sub'                                     │
│ );                                                         │
│ // switch on sub.domain === 'subscription'                 │
└────────────────────────────────────────────────────────────┘
```

**Phase A done:** the panel frame shows all three tabs with a real reference prefilled. **Phase B done:** tabs reflect the SDK, copy works, no snippet emits a raw amount to a charge path, and no secret renders.

---

## 13. Live delivery and event stream

A live-tailing list that extends `WebhookTicker`, for the developer's webhook deliveries and the domain-event feed. It renders raw signed JSON, expands each row, and announces new rows to assistive technology.

### 13.1 Purpose and data

- **Deliveries stream:** `GET /v1/webhooks/{id}/deliveries` returns `WebhookDeliveryResponseData` rows: `eventType`, `status` (the section 6 delivery badge), `attempts`, `nextAttemptAt`, `lastAttemptAt`, `responseStatus`, `replayedAt`, `replayCount`. New deliveries prepend as they arrive.
- **Events feed:** `GET /v1/events` returns `DomainEventResponseData` rows: `id` (the `evt` reference and dedupe key), `type`, `payload`, `createdAt`. The catalog for the type facet is `GET /v1/events/catalog`.

### 13.2 Anatomy, variants, states

- **Row:** a compact line with the event type (mono), the status badge, the attempt count, the timestamp, and a chevron. A `pending` delivery shows the live dot.
- **Expand:** the row expands to the raw signed delivery body, `{ id, type, event: { id, type, createdAt }, data }`, and the `x-nombaone-*` headers (`x-nombaone-signature` hex, `x-nombaone-event-type`, `x-nombaone-delivery`, `x-nombaone-delivery-guarantee: at-least-once`), rendered in the raw-JSON view (a `CodeBlock` with copy). The panel states the dedupe rule inline: dedupe on `event.event.id`, the stable event id, not the top-level delivery id. One event fans out to one delivery row per subscribed endpoint, and a replay re-arms the same delivery row in place, so its delivery id does not change.
- **Replay:** a dead or failed delivery row carries a Replay action, `POST /v1/webhooks/{id}/deliveries/{deliveryId}/replay`, which increments `replayCount` and stamps `replayedAt`. The panel is honest that delivery is at-least-once and replayable, never exactly-once.
- **aria-live:** the stream container is an `aria-live="polite"` region so a newly arrived delivery is announced. A pause control freezes autoscroll while the developer reads.
- **Loading:** skeleton rows. **Empty:** "No deliveries yet. Deliveries appear here as events fire." **Error:** inline panel with `hint`, `docUrl`, `requestId`.

Wireframe:

```
┌ Deliveries · endpoint nbo…whk ──────────────────── [Pause ⏸] [Filter ▾] ┐
│ ○ invoice.payment_recovered  [Pending ]  try 1   09:14:02            ▸  │
│ ● subscription.created       [Delivered] try 1   09:13:55  200       ▾  │
│    { "id":"nbo…whd", "type":"subscription.created",                     │
│      "event":{ "id":"nbo…evt", "type":"subscription.created", ... },    │
│      "data":{ "reference":"nbo…sub" } }        dedupe on event.event.id │
│ ✕ price.deactivated          [Dead    ]  try 6   08:40:11  [Replay]  ▸  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Phase A done:** the stream frame shows the delivery badges, a raw expanded body with headers, and a Replay on a dead row. **Phase B done:** the stream tails deliveries, expands raw JSON, announces new rows via aria-live, and replays dead deliveries.

---

## 14. Form controls

The design system ships only text `Input`, `select`, `textarea`, and the theme toggle. The console needs the rest. Each control below binds to Tier-2 tokens and reuses the input focus ring.

### 14.1 Checkbox

- **Anatomy:** a 16px box, 0.5px `--border`, `--r-sm`, checked fill `--primary` with a `--primary-foreground` check. Indeterminate state for a table's select-all header.
- **States:** rest, hover (`--border-strong`), focus (ring), checked, indeterminate, disabled (45% opacity). Label to the right, `--app-body`.
- **Use:** table row selection, boolean billing settings such as `partialCollectionEnabled` and `paydayBiasEnabled` and `commsEnabled`.

### 14.2 Radio group

- **Anatomy:** a 16px circle, checked shows a `--primary` inner dot. Vertical or horizontal group, one selection.
- **Use:** `collectionMethod` (`charge_automatically` versus `send_invoice`), cancel mode (now versus at period end), `prorationCreditPolicy` (`credit_next_cycle` versus `none`).

### 14.3 Switch

- **Anatomy:** a 36 by 20 track, `--surface-3` off, `--accent` on, a `--surface-1` knob that slides `--dur-fast` `--ease-out`. Distinct from the checkbox: a switch takes effect immediately on a settings surface, a checkbox stages a value in a form.
- **Use:** immediate-apply toggles on the billing settings page.

### 14.4 Combobox and searchable select

- **Anatomy:** an `Input`-styled trigger that opens a portalled listbox at `--z-popover`. Type to filter, arrow keys to move, `Enter` to select, `Escape` to close. Options can carry a badge or tag.
- **Use:** pick a customer for a new subscription, pick a plan then a price, pick a coupon. Options load by cursor and the listbox has its own "Load more" when the source is paginated.
- **States:** empty query (recent or first page), filtering (spinner in the field), no matches ("No matches"), error (inline hint).

### 14.5 Multi-select (for `enabledEvents`)

- **Anatomy:** a combobox that accepts many values, each selected value rendered as a removable `.chip` inside the field, the listbox showing checked rows.
- **Use:** the webhook endpoint `enabledEvents[]`, sourced from the 34-type catalog at `GET /v1/events/catalog`, plus the `*` (all events) option which, when chosen, disables the individual rows and shows a "Listening to all events" chip. This binds to `POST /v1/webhooks` and `PATCH /v1/webhooks/{id}`.

### 14.6 Date and time picker

- **Anatomy:** an `Input` trigger opening a portalled calendar popover at `--z-popover`; a range mode for filter bars. Times render and submit in ISO-8601 UTC to match the API; the field labels the timezone.
- **Use:** the filter-bar date range, a coupon `redeemBy`, a schedule effective boundary.

### 14.7 The amount input (money law)

- **Anatomy:** an `Input` with a leading `₦` adornment and a fixed `NGN` suffix, accepting naira with exactly two decimals, storing and sending integer kobo. The control multiplies the entered naira by 100 with integer arithmetic, never storing a float. `2,500.00` becomes `250000`.
- **Guard:** the control never forwards a value to a charge or renewal path without pinning the unit to kobo at the boundary, guarding the 100x risk from section 1.3. It rejects more than two decimals and rejects non-numeric input inline via `.hint.err`.
- **Use:** `unitAmountInKobo` on a new price, a credit grant amount, a payout amount, a refund amount (capped at the settlement `netToTenantInKobo`).

### 14.8 Shared validation contract

Every control renders server-side field errors from `error.fields` (returned on `CLIENT_VALIDATION_FAILED`) inline beneath the field via `.hint.err`, keyed by field name, in addition to client-side checks.

Wireframe:

```
Collection method              Enabled events
( ) Automatic                  [ invoice.paid ✕ ] [ invoice.payment_failed ✕ ]
(•) Send invoice               [ + add event ▾ ]        ( ) Listen to all (*)

Unit amount                    Switch (immediate)
[ ₦ 2,500.00        NGN ]      Payday-biased retries   [ ▮━━ ]  on
  stores 250000 kobo
```

**Phase A done:** a form frame shows every control with real field names and the amount input showing its kobo conversion. **Phase B done:** controls bind to their DTO fields, portalled popovers layer correctly, the amount input stores integer kobo and pins the unit, and `error.fields` render inline.

---

## 15. Empty, loading, and confirm patterns

Three cross-cutting patterns the marketing system lacks. Only the button `.spinner` exists today.

### 15.1 Empty state

- **Anatomy:** a centered `Card`-less block inside its container: a one-line title, a one-line direction, and a single primary action. No illustration is required; restraint is the aesthetic.
- **Copy rule:** direction, not mood. "No subscriptions yet. Create your first subscription." "No subscriptions in recovery." (a good state, phrased as one). "No matches for this filter. Clear filters."
- **Distinguish two empties:** never-created versus no-matches. The first offers the create action; the second offers Clear filters.

### 15.2 Skeleton and loading

- **Skeleton:** shape-matched placeholder blocks at `--surface-2` with a slow shimmer (`--dur-slower`, honoring reduced motion by falling to a static tint). Table skeleton matches column widths; drawer skeleton matches field rows; tile skeleton matches the numeral bar.
- **Inline loading:** the button `.spinner` for actions, the field spinner for comboboxes, the "Load more" spinner for pagination. A surface never blanks to empty during a refetch; existing content dims to 60%.
- **Full-page loading:** only on first shell mount; thereafter regions load independently.

### 15.3 Confirm dialog

- **Anatomy:** a modal at `--z-modal` over the shared scrim: a title, a one-line consequence, and two actions, cancel (secondary) and confirm (primary, or `--btn-danger` for destructive acts).
- **Use:** every destructive or money-moving action. Cancel a subscription (`POST /v1/subscriptions/{id}/cancel`), void an invoice (`POST /v1/invoices/{id}/void`, offered only when draft or open, else the API returns `INVOICE_NOT_VOIDABLE`), refund (`POST /v1/settlements/{id}/refund`), payout (`POST /v1/settlements/payout`), void a credit grant, rotate a secret, revoke a key.
- **Money-moving confirms** state the exact amount as naira (money law), name the rail, and generate the `Idempotency-Key` for the request so a double click resolves to one movement.
- **Honest consequence copy:** a payout confirm states that `ledger_posted` is not yet bank-confirmed while the provider leg is flag-gated. A cancel confirm distinguishes voluntary cancel from the involuntary churn outcome. A resubscribe confirm states that a new subscription is created because canceled is terminal.
- **States:** idle, submitting (confirm shows `.spinner`, both actions disabled), error (the dialog stays open and renders `hint`, `docUrl`, `requestId`), success (dialog closes, a toast confirms, the list or drawer refetches).

Wireframe:

```
┌ Cancel subscription? ───────────────────────────────┐
│ nbo…4471sub for ada@shop.ng stops at period end,     │
│ Aug 12. This is a voluntary cancel, not churn.       │
│                                                      │
│                      [ Keep active ]  [ Cancel it ]  │
└──────────────────────────────────────────────────────┘
```

**Phase A done:** frames show a never-created empty, a no-matches empty, table and drawer skeletons, and a destructive confirm with amount and consequence. **Phase B done:** confirms gate money actions, carry an idempotency key, keep the dialog open on error with the hint, and skeletons match their content shapes.

---

## 16. Copy-once secret field

A specialized control for the two values the API returns exactly once and never again: an API key `secret` (`CreatedApiKeyResponseData.secret`) and a webhook signing secret (`RotatedWebhookSecretResponseData.signingSecret`, returned by create and by `POST /v1/webhooks/{id}/rotate-secret`).

### 16.1 Anatomy and behavior

- **Reveal-once:** on mint or rotate, the full secret renders once in a monospace field with a Copy control and a persistent `Callout` warning: "Copy this now. It cannot be retrieved again." The warning uses the accent-tinted callout, not danger, because it is guidance, not an error.
- **After acknowledge:** once the person copies or dismisses, the field collapses to the prefix only (`keyPrefix` for keys, `signingSecretPrefix` for webhooks) and the full value is gone from the DOM. Reads (`GET /v1/webhooks/{id}`, key lists) return only the prefix, so the console cannot re-reveal it.
- **Rotate path:** rotating shows the new secret once through the same field and reminds that the old secret stops working, so the developer updates their verifier.
- **Never elsewhere:** secrets never render in the reproduce panel (section 12), the delivery raw view (section 13), logs, or URLs.

### 16.2 States

- **Revealed (once):** full value, Copy, the cannot-retrieve warning.
- **Acknowledged:** prefix only, a "Rotate" action for webhooks or "Revoke" for keys.
- **Copy confirmation:** the toast confirms; the warning persists until the person leaves the surface.

Wireframe:

```
┌ Signing secret ─────────────────────────────────────────────┐
│ ◆ Copy this now. It cannot be retrieved again.               │
│ whsec_9f21c0a4b7e8…d3                              [ Copy ]   │
└──────────────────────────────────────────────────────────────┘
      after acknowledge  →   whsec_9f21…      [ Rotate secret ]
```

**Phase A done:** frames show the revealed-once state with the warning and the acknowledged prefix-only state. **Phase B done:** the full secret exists in the DOM only until copy or dismiss, reads return only the prefix, and no other component can surface it.

---

## 17. App shell

The frame every screen mounts inside. It composes inherited chrome (`Header`, `NavItem`, `MobileHeader`, `NavSheet`, `Footer`, `LogoWordmark`) with the net-new sidebar, breadcrumbs, environment switcher, and app-level tabs.

### 17.1 Anatomy

- **Left sidebar:** fixed `--app-sidebar` (248) at `--z-sidebar`, `--surface-1`, grouped `NavItem`s for the IA areas from doc 01 (Overview, Subscriptions, Customers, Plans and prices, Invoices, Payments and rails, Dunning and recovery, Settlements and payouts, Coupons and credits, Developers, Reconciliation, Settings). The active item carries a subtle left indicator; accent is not used to tint the whole item, keeping accent scarce. Below 900px the sidebar collapses to the `--app-rail` (64) icon rail or the `NavSheet`.
- **Top bar:** the inherited `Header` chrome at `--z-topbar` (50): the wordmark, the current page title (`--app-title`), breadcrumbs, the environment switcher, the theme toggle, and the account menu.
- **Breadcrumbs:** the path from area to object, for example Subscriptions then `nbo…4471sub`, each segment a link, the last segment plain. References render mono.
- **Environment switcher:** a two-state control, Test and Live, bound to the session ring. It is the single source of the active `environment` and is visually unmistakable: the Test ring carries a persistent muted banner tint so no one confuses rings. Switching rings re-scopes every list and drawer to that `environment` and clears filters. Test-mode developer instruments (the test clock, mint-test-method, simulate-webhook) appear only when the deployment is `INFRA_ENVIRONMENT=test`, and the whole test area hides on live.
- **App-level tabs:** within a page that has sub-views (for example a plan and its prices, or a webhook endpoint and its deliveries), a tab strip built on the inherited `LangTabs` pattern retuned for navigation, keyed to sub-routes. The marketing system had only code-sample tabs; these are navigational.
- **Footer:** the inherited `Footer` strip with the app version, the active environment, and a status link.

### 17.2 States

- **Loading:** the shell renders immediately; the content region shows its own skeletons.
- **RBAC-gated visibility:** items and actions hide or disable by `OrgUserRole`. A `viewer` sees read surfaces but not mint-key or money-moving actions; the Developers key-mint and Team surfaces gate on the console-auth API, which is a named dependency, not yet built.
- **Nomba not connected:** when `nombaAccount.status` is not `active`, a persistent banner invites connecting the Nomba account before settlement or payout, and money-moving actions on those surfaces disable with the reason.
- **Error:** a shell-level error boundary renders a recoverable panel with `requestId` rather than a white screen.

Wireframe:

```
┌ nomba one ──────────────  Subscriptions › nbo…4471sub   [Test ▾] [◑] [ada ▾] ┐
├───────────┬──────────────────────────────────────────────────────────────────┤
│ Overview  │  ⚠ You are in the Test ring. No real money moves.               │
│▸Subscript.│  ┌ Subscriptions ─────────────────────────────────────────────┐  │
│ Customers │  │ (data table, section 7)                                     │  │
│ Plans     │  └─────────────────────────────────────────────────────────────┘ │
│ Invoices  │                                                                   │
│ Payments  │                                                                   │
│ Dunning   │                                                                   │
│ Settlemt. │                                                                   │
│ Developers│                                                                   │
│ Settings  │                                                                   │
└───────────┴──────────────────────────────────────────────────────────────────┘
```

**Phase A done:** the shell frame shows the sidebar groups, breadcrumbs, the environment switcher with the Test banner, and a gated action for a viewer role. **Phase B done:** the switcher re-scopes every query to its `environment`, test instruments hide on live, RBAC hides or disables gated items, and the shell renders at 1440, 900, and 390.

---

## 18. Back-port plan and phase gates

Every component in sections 5 through 17 is authored to land in the shared `@nombaone/ui` package and be mirrored into `workbench/NOMBAONE.pen`, so the console, checkout, and any future surface inherit one library. The order of work follows the dependency chain.

1. **Tokens and scale first.** Add `--space-5` (20), `--space-10` (40), the `--app-*` type tokens, the `--app-max`/`--app-sidebar`/`--app-content-max` widths, and the `--z-*` layer tokens to the shared system. No component builds against a value that does not yet exist.
2. **Status-badge system.** Ship `<StatusBadge>` mapping every enum in section 6.3, since tables, drawers, and timelines all depend on it.
3. **Layout primitives.** Data table, filter bar, drawer, and the shell, which the screen docs (02 through 05) consume.
4. **Developer surfaces.** The reproduce panel, the live delivery and event stream, and the copy-once secret field.
5. **Form controls and patterns.** The missing controls, then the empty, skeleton, and confirm patterns.
6. **Back-port to `.pen`.** Once built and verified in the app, each component is authored as a `.pen` component so the design source stays 1:1 with the shipped library. From that point the `.pen` file is the hard gate: shipped UI matches it exactly.

**Cross-cutting checks every component passes before it is done:** Tier-2 tokens only; dark and light both correct as a pure remap; keyboard reachable and focus-visible; `prefers-reduced-motion` honored; money rendered by the money law with the 100x unit guard wherever an amount is shown or taken; status labels drawn verbatim from the API enums with voluntary cancel and involuntary churn kept distinct; and every failure path rendering `error.hint`, `error.docUrl`, and `meta.requestId`.

Proceed to doc 07.
