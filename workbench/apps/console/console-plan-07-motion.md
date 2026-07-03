# Nomba One · Console Plan · 07 · Motion and interaction

> **What this is.** The interaction and animation language for the console. It reuses the design system's four durations and three easing curves, then maps each motion to a specific console surface: the data table, the sort transition, the detail drawer, the subscription timeline, the live-tail stream, tab and route transitions, the toast, the skeleton shimmer, the focus ring, and the one reserved recovery-peak spring. The governing rule is the same one the website plan set: **every animation earns its place by teaching or guiding.** Motion that carries neither state nor direction gets cut. This document is the Phase A starting point for every animated surface; the built spec is Phase B.
>
> **Depends on:** doc 00 (north star, voice, inherited design language v2, quality floor, two-phase method), doc 01 (IA, app shell, the test/live switch, cursor-pagination model), doc 05 (hard-parts cockpits: the dunning/recovery cockpit and the bill/fail/recover timeline this doc animates), and doc 06 (the net-new component library and z-index layers this motion binds to). Money is integer kobo on the wire everywhere below; see §3.10 and §8.

---

## 1. Principles

- **Alive, not busy.** Console work is dense and repeated all day. Ambient motion is rare, slow, and low-amplitude; interactive motion is quick and precise. If two things move at once for no reason, remove one. A table that shimmers, slides, and bounces on every keystroke reads as noise, and noise is a cost the operator pays on every visit.
- **One physical language.** Every animation uses the design system's three easing curves and four durations. Nothing hand-rolls a bezier. `--ease-out` drives entrances and almost all UI, `--ease-in-out` drives the few ambient loops (the live dot, the attempting-state pulse), and `--ease-spring` is reserved for exactly one moment: a payment recovering.
- **Motion carries state, not mood.** A row hover confirms the row is interactive. A sort transition shows which column reordered the data. A drawer slide shows where the detail came from and where it returns. A timeline reveal encodes sequence. A status pill crossfade shows an FSM transition happened. The recovery spring marks the one earned emotional peak. None of these is decoration; each answers a question the operator would otherwise ask.
- **Errors and empty states do not perform.** When a charge fails or a list is empty, the motion is minimal and the words do the work (doc 08 owns the copy). A failure never gets a flourish. The recovery does, and it is the only one.
- **Orchestrate the peak, keep the rest quiet.** The dunning/recovery cockpit and the subscription timeline are where boldness is spent. Everything else stays calm so the peak lands.
- **Native scroll only.** No smooth-scroll library, no scroll-hijack, no scroll-linked parallax on long tables. Reveal-on-mount and reveal-on-enter, never scroll-jacking. Tables and timelines can run to thousands of rows; the browser's own scroll is the only one fast enough.
- **Animate only `transform` and `opacity`.** Never animate `width`, `height`, `top`, `left`, or `box-shadow` geometry inside a loop or a per-row reveal. A table repainting layout on every row mount drops frames; a table translating and fading does not.
- **Reduced motion is a first-class path, not a fallback.** Under `prefers-reduced-motion: reduce`, every reveal becomes an instant appearance, every loop stops, and the spring is removed, while every state change, every color, and all legibility stay. The console must be fully usable and honest with zero motion (§6).

---

## 2. Token reference

Pulled verbatim from `nomba-one-design-system.html`. This document adds no new duration or curve; it only assigns them.

**Durations**

- `--dur-fast` = 120ms. Hovers, active-press, focus-ring appearance, input border shift.
- `--dur-base` = 200ms. The workhorse: row hover, tab-indicator slide, toast, drawer content crossfade, live-tail line entrance, status-pill crossfade.
- `--dur-slow` = 320ms. Drawer and modal open, theme remap, the check-draw on a recovered receipt.
- `--dur-slower` = 520ms. Section and panel reveal, metric-tile count-up envelope, the timeline draw.

**Easings**

- `--ease-out` = `cubic-bezier(0.16, 1, 0.3, 1)`. Entrances and nearly all UI. Fast start, soft settle.
- `--ease-in-out` = `cubic-bezier(0.83, 0, 0.17, 1)`. Ambient loops only: the live dot, the `attempting`-state pulse.
- `--ease-spring` = `cubic-bezier(0.34, 1.56, 0.64, 1)`. The single overshoot curve, reserved for the recovery peak (§3.7). It appears nowhere else in the console.

**Keyframes already defined**

- `pulse` (0% and 100% `opacity:1; scale(1)`, 50% `opacity:.4; scale(.82)`) at `1.6s` to `1.8s` `--ease-in-out` for live dots and status dots.
- `spin` for the button and inline load spinner.
- `fadeUp` (`translateY(16px)` and `opacity:0` to rest) for reveals.
- `scaleIn` (`opacity:0; scale(.8)` to `opacity:1; scale(1)`) for the recovery pop and chip appearances.
- `floaty` (`translateY(0)` to `-10px` to `0`) for the rare ambient float; the console uses this almost never.

**Named patterns from the system**

- `fade-up entrance`: 320ms, `--ease-out`. `scale-in`: 200ms, `--ease-spring`. `pulse (live)`: 1.8s loop. `float (ambient)`: 3s loop.
- The `.reveal` utility (`opacity:0; translateY(14px)` to `.in`) transitions over `--dur-slower` `--ease-out`.
- `#toast` translates `translateY(20px)` to `0` and fades over `--dur-base` `--ease-out`.

**The reduced-motion media query (inherited, non-negotiable)**

```css
@media (prefers-reduced-motion: reduce){
  *{ animation-duration:.001ms !important; animation-iteration-count:1 !important;
     transition-duration:.001ms !important }
  html{ scroll-behavior:auto }
}
```

**Overlay layers (doc 06 owns the token; this doc consumes it).** The system ships only two z-index anchors today: `header` at 50 and `#toast` at 99. The console needs an overlay stack for the drawer and modal. Establish it in doc 06 and reference it here: `--z-drawer` (1000, scrim 1000 / panel 1001) for the detail drawer, `--z-modal` (1100, scrim 1100 / panel 1101) for the modal and confirm dialog so it can sit above a drawer, `--z-popover` (1200) for menus and comboboxes, `--z-tooltip` (1300) for tooltips, and `--z-toast` (9999) stays topmost so a confirmation of an action always paints above the surface that triggered it.

---

## 3. Per-surface motion (build these)

> Pencil renders each of these as a still frame. The entries below are the build spec behind the frame: what moves, its trigger, the exact duration and easing, the reduced-motion fallback, and the CSS-versus-JS split. Every surface names the real endpoint, DTO field, or status enum it animates, so the motion stays bound to real data. **Phase A** places the static frames and the state variants in Pencil (rest, hover, loading, empty, error, and the animated end-state as a separate frame). **Phase B** builds to the timing below. Approach convention, mirroring the website set: use **Motion (framer-motion)** for orchestrated, stateful, and list enter/exit sequences; use **CSS** for hovers, ambient loops, and single-property transitions. Animate `transform` and `opacity` only.

### 3.1 App shell, navigation, and the test/live switch

The shell is the frame every screen loads into: a left nav grouped by area (doc 01), a sticky header, and the mandatory test/live environment switch.

- **Route transition.** On navigating between areas (Overview, Subscriptions, Customers, Invoices, Settlements, Developers, Settings), the outgoing view fades out and the incoming view does a short `fade-up`.
  - *Trigger:* client route change.
  - *Timing/easing:* crossfade over `--dur-base` `--ease-out`, incoming content `translateY(8px)` to `0`. Keep it short; infra tools must feel fast, and a heavy page transition reads as a slow app.
  - *Reduced motion:* instant swap, no translate.
  - *Approach:* Motion `AnimatePresence` on the route outlet, `transform` and `opacity` only. The nav shell does not animate; only the content region does, so the operator's eyes stay anchored on the nav.
- **Nav active indicator.** The active area's indicator slides between items rather than cutting.
  - *Trigger:* route change or click.
  - *Timing/easing:* the indicator translates over `--dur-base` `--ease-out`. Label color shifts to `--foreground` over `--dur-fast`.
  - *Reduced motion:* the indicator jumps to the active item; color still changes.
  - *Approach:* Motion shared-layout (`layoutId` on the indicator), the same pattern the website tabs use.
- **Test/live environment switch.** Flipping the switch reloads the scoped data set for the other `environment`. This is a data boundary, not a cosmetic toggle, so the motion states the change firmly.
  - *Trigger:* toggling the switch in the header.
  - *Timing/easing:* the switch thumb translates and the track color shifts over `--dur-base` `--ease-out`; the content region shows a brief skeleton (§3.9) while the new environment's list loads. A single toast confirms "Now viewing test data" or "Now viewing live data" (§3.8).
  - *Reduced motion:* the thumb and track change state instantly; the skeleton and toast still appear.
  - *Approach:* CSS transition on the thumb `transform` and track color; Motion for the skeleton-to-content crossfade. The switch state is the source of truth; motion only confirms it. When `INFRA_ENVIRONMENT=live`, the test-mode instruments and their entry points are absent from the shell entirely (doc 01, doc 04), so no motion is defined for a control that does not render.
- **Sticky header elevation.** The header gains a hairline and a whisper of backdrop blur once the content scrolls under it.
  - *Trigger:* native scroll position past 0.
  - *Timing/easing:* toggle over `--dur-base`; the header already carries `backdrop-filter: saturate(160%) blur(14px)` and a `0.5px` bottom border in the system.
  - *Reduced motion:* apply the elevated state at the threshold with no transition.
  - *Approach:* CSS, keyed off a native-scroll position flag. Never animate the blur radius in a loop.

```
┌───────────────────────────────────────────────────────────────────┐
│ ◆ Nomba One   Subscriptions                     [ Test ●━ Live ]   │  header (z 50)
├──────────────┬────────────────────────────────────────────────────┤
│ ▸ Overview   │                                                     │
│ ▸ Subscript. │   ┌─ content region ─────────────────────────────┐ │
│   ▏active     │   │  crossfade + fade-up on route change          │ │  ← only this
│ ▸ Customers  │   │  (nav shell stays fixed)                      │ │    region moves
│ ▸ Invoices   │   └───────────────────────────────────────────────┘ │
│ ▸ Settlements│                                                     │
│ ▸ Developers │   nav active indicator ▏ slides between items       │
└──────────────┴────────────────────────────────────────────────────┘
```

### 3.2 Data table: row mount, hover, sort, selection, load-more

The data table is the console's core surface (every list in doc 01 through doc 03: subscriptions, customers, invoices, settlements, webhook deliveries, events). It does not exist in the design system yet; doc 06 specifies it and this section specifies its motion. Every list is cursor-paginated (`pagination.nextCursor`, `pagination.hasMore`, no totals, no page numbers).

- **Row mount on first load.** Rows appear together, not in a cascade.
  - *Trigger:* the list resolves (for example `GET /v1/subscriptions?status=`).
  - *Timing/easing:* the whole table body does one `fade-up` (`opacity:0; translateY(8px)` to rest) over `--dur-base` `--ease-out`. Do **not** stagger per row on a data table; a 20-row stagger is 20 things moving and reads as busy, and on a re-sort it fights the operator. The website reserves staggers for marketing card groups; the console table does not use them.
  - *Reduced motion:* rows appear instantly.
  - *Approach:* one Motion fade on the `<tbody>`, not per row.
- **Row hover.** Hover confirms the row is a target and previews the click.
  - *Trigger:* pointer over a row.
  - *Timing/easing:* background shifts to `--surface-2` over `--dur-fast` `--ease-out`; no translate, no scale, no shadow. Density means the row must not move under the pointer.
  - *Reduced motion:* the hover background still applies; the transition may be instant.
  - *Approach:* CSS. Keyboard focus on a row gets the same background plus the focus ring (§3.10).
- **Sort transition.** Clicking a sortable column header reorders the rows. This is the one place a table earns a little motion, because the operator needs to see that the order changed and roughly how.
  - *Trigger:* click a sortable header (client reorder within the loaded page, or a refetch with a new order param).
  - *Timing/easing:* rows ease to their new positions over `--dur-base` `--ease-out` using `transform: translateY` (FLIP), not layout reflow. The sort caret in the header rotates over `--dur-fast`. Cap the animated set to what is on screen; do not animate rows scrolled out of view.
  - *Reduced motion:* rows jump to sorted order instantly; the caret still flips.
  - *Approach:* Motion `layout` on rows (FLIP under the hood, transform only), guarded so a page of hundreds does not animate every node. If the sort triggers a server refetch and the row set changes, treat it as a fresh mount (§3.2 row mount) rather than a reorder.
- **Row selection.** Selecting rows (for a bulk action where one exists) shows a checkbox and a selection count.
  - *Trigger:* toggling a row checkbox or a header select-all.
  - *Timing/easing:* the checkbox check draws or fades over `--dur-fast`; a selection action bar slides up from the table footer over `--dur-base` `--ease-out` (`translateY(8px)` to `0`).
  - *Reduced motion:* the check and the action bar appear instantly.
  - *Approach:* CSS for the check, Motion for the action-bar enter/exit.
- **Load-more (cursor pagination).** The list grows by appending the next page; it never swaps to a numbered page.
  - *Trigger:* the operator clicks "Load more" or the sentinel row enters the viewport, and the next `GET …?cursor=` resolves.
  - *Timing/easing:* the appended block does one `fade-up` over `--dur-base` `--ease-out`; existing rows do not move. The "Load more" control shows the inline `spin` while fetching. When `pagination.hasMore` is false, the control is replaced by a quiet end marker with no motion.
  - *Reduced motion:* appended rows appear instantly; the spinner is a static "Loading" label.
  - *Approach:* Motion fade on the appended range only. Never re-animate rows already on screen; that punishes the operator for scrolling.

```
┌──────────────────────────────────────────────────────────────────┐
│ Reference        Status        Method            Next billing  ⌄  │  ← sort caret
├──────────────────────────────────────────────────────────────────┤   rotates (dur-fast)
│ nbo…835566sub    ● active      charge_automatic  Jul 26          │
│ nbo…774120sub    ● past_due    charge_automatic  retrying        │ ← hover: bg→surface-2
│ nbo…661093sub    ● trialing    send_invoice      Jul 30          │   (dur-fast, no move)
│ ⋯ rows ease to new Y on sort (FLIP, transform only, dur-base) ⋯   │
├──────────────────────────────────────────────────────────────────┤
│                    [ Load more  ↻ ]   ← appended page: fade-up     │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 Filter bar and faceted filters

The filter bar sits above every list and maps to real query params (`?status=`, `?type=`, `?eventType=`, date ranges, environment).

- **Filter apply.** Applying or clearing a filter refetches and re-renders the list.
  - *Trigger:* selecting a status chip, an event-type facet, or a date range.
  - *Timing/easing:* the active chip's fill and border shift over `--dur-base` `--ease-out`; the list crossfades to the filtered result over `--dur-base` (old set fades out, new set does the row-mount fade of §3.2). Show a skeleton (§3.9) only if the refetch takes longer than roughly 200ms, so a fast filter does not flash a skeleton.
  - *Reduced motion:* the chip state changes instantly; the list swaps with no fade. The result set is identical either way.
  - *Approach:* CSS for the chip state, Motion for the list crossfade. The URL query is the source of truth; motion follows the data.

### 3.4 Detail drawer and slide-over

The drawer is the primary "inspect one object" surface (a subscription, an invoice, a webhook delivery, a settlement). It slides in from the right over a scrim, keeping the list in place behind it so the operator keeps their position.

- **Open.** The scrim fades in while the panel slides in from the right edge.
  - *Trigger:* click a row or an "inspect" action.
  - *Timing/easing:* scrim `opacity:0` to a low-alpha wash over `--dur-base`; panel `translateX(100%)` to `0` over `--dur-slow` `--ease-out`. Focus moves into the panel on open. Body scroll locks behind it; the panel scrolls natively.
  - *Reduced motion:* the panel and scrim appear in place with no slide; focus move, scroll-lock, and Escape-to-close are unchanged.
  - *Approach:* Motion `AnimatePresence` on the panel `transform` and the scrim `opacity`; scroll-lock is plain logic. Panel at 1001, scrim at 1000 (`--z-drawer`).
- **Close.** The reverse, faster, so dismissal feels responsive.
  - *Trigger:* Escape, scrim click, close button, or a completed action.
  - *Timing/easing:* panel `translateX(0)` to `100%` and scrim fade over `--dur-base` `--ease-out`. Focus returns to the row that opened the drawer.
  - *Reduced motion:* instant removal; focus still returns.
  - *Approach:* Motion exit variant.
- **Content within the drawer.** When an action inside the drawer changes the object (for example a subscription `pause` or `cancel`), the changed field or status pill crossfades in place (§3.12); the drawer does not re-slide. Tabs inside the drawer (Overview, Events, Invoices, Dunning on a subscription) use the tab-indicator slide from the micro-interactions table (§3.15).

```
list stays behind scrim ░░░░░░░░░░┌──────────────────────────────┐
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ Subscription  nbo…835566sub  ×│  ← panel slides
░ nbo…835566sub  ● active        ░│ ● active   period 4  Jul 26   │    in from right
░ nbo…774120sub  ● past_due      ░│ ┌ Overview │ Events │ Dunning ┐│    (translateX,
░ nbo…661093sub  ● trialing      ░│ │ indicator ▏ slides           ││     dur-slow)
░░░░░░░░░ scrim fades in ░░░░░░░░░│ └──────────────────────────────┘│
  (opacity, dur-base, z 1000)     │  actions: Pause · Change · Cancel│  panel z 1001
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░└──────────────────────────────┘
```

### 3.5 Confirm dialog and modal

Money-moving and destructive actions confirm in a centered modal: cancel a subscription, void an invoice (`POST /v1/invoices/{id}/void`, draft or open only), grant or void a credit, request a payout (`POST /v1/settlements/payout`), refund (`POST /v1/settlements/{id}/refund`), rotate or revoke a secret.

- **Open.** Scale-and-fade over a blurred scrim.
  - *Trigger:* a confirmable action.
  - *Timing/easing:* scrim blur and wash fade in over `--dur-base`; dialog `scale(0.96)` to `1` and `opacity:0` to `1` over `--dur-slow` `--ease-out`. Focus moves to the dialog and traps.
  - *Reduced motion:* no scale, no blur transition; dialog and scrim appear instantly. Focus-trap, scroll-lock, and Escape-to-close are unchanged.
  - *Approach:* Motion `AnimatePresence` on the dialog `transform` and `opacity`; the scrim blur is CSS `backdrop-filter`, applied instantly under reduced motion.
- **Submitting a money action.** The confirm button shows the inline `spin` and disables while the request is in flight. Because these carry an `Idempotency-Key`, a double click is safe on the server; the disabled state prevents the operator from thinking nothing happened. On success the dialog closes (§3.5 close) and a toast confirms; on a typed error (for example `ESCROW_LOCKED`, `PAYOUT_EXCEEDS_AVAILABLE`, `INVOICE_NOT_VOIDABLE`, `REFUND_AMOUNT_EXCEEDS_NET`) the dialog stays open and renders `error.hint` and `error.docUrl` inline with no shake, no flash (doc 08 owns the copy contract).
  - *Reduced motion:* the spinner is a static "Working" label; everything else holds.
  - *Approach:* CSS spinner, Motion close on success.

### 3.6 Timeline and event stream reveal

The subscription timeline is the console analog of the website simulator, on real data. It renders the object's real history from `GET /v1/subscriptions/{id}/events` (append-only `domain_events`), interleaved with invoices and `GET /v1/subscriptions/{id}/dunning/attempts`, as a vertical, status-dotted line. The event vocabulary is the frozen catalog: `invoice.created`, `invoice.finalized`, `invoice.payment_failed`, `invoice.action_required`, `invoice.payment_recovered`, and the terminal fork `subscription.canceled` (voluntary) versus `subscription.churned` (involuntary). The two outcomes render with distinct dots and labels and are never merged.

- **Timeline draw on open.** The line draws top to bottom and each node fades in as the line reaches it.
  - *Trigger:* the timeline mounts (drawer tab or a full timeline view).
  - *Timing/easing:* the connector draws via `transform: scaleY(0)` to `1` on a top origin over `--dur-slower` `--ease-out`; nodes `fade-up` in sequence keyed to their position, capped so a long history does not animate for seconds (draw the first screenful, then reveal the rest instantly on scroll-in). The current active node, if the subscription is mid-cycle or mid-dunning, carries the `pulse` live dot.
  - *Reduced motion:* the line shows fully drawn; every node appears in its resolved state with no draw. All logic, all events, and the voluntary-versus-involuntary distinction stay.
  - *Approach:* Motion for the `scaleY` draw and node reveals; CSS for the live-dot pulse. Never animate the line's height; animate `scaleY`.
- **Dunning attempts on the line.** Each attempt renders its real `status` (`scheduled`, `attempting`, `succeeded`, `rescheduled`, `card_update_required`, `exhausted`), `branch` (`reschedule`, `card_update_required`, `short_path`), `failureReason`, and `nextAttemptAt`. An `attempting` attempt pulses; a `rescheduled` attempt shows the payday-biased `nextAttemptAt` as a quiet future node. Blind retry motion does not exist here: for `card_update_required` the surface routes to a card update or forwards `invoice.action_required.checkoutLink`, so there is no "retry" affordance to animate (doc 05).

```
┌─ Subscription timeline · nbo…835566sub ──────────────────────────┐
│                                                                   │
│  ● invoice.created            period 4        line draws          │
│  │                                             top→bottom          │
│  ● invoice.finalized          ₦12,000         (scaleY, dur-slower)│
│  │                                                                 │
│  ● invoice.payment_failed     insufficient_funds                  │
│  │                             attempt 1 · reschedule              │
│  ◐ attempting                 pulse (ease-in-out)  ← live node     │
│  │                                                                 │
│  ★ invoice.payment_recovered  ← THE spring peak (§3.7), emerald    │
│                                                                   │
│  … terminal fork renders as either                                │
│  ● subscription.canceled (voluntary)  OR  ● subscription.churned  │
│     distinct dots + labels, never merged                          │
└───────────────────────────────────────────────────────────────────┘
```

### 3.7 The recovery peak (the one reserved spring)

This is the single sanctioned flourish in the entire console: the moment an invoice moves to `invoice.payment_recovered` after a failure and dunning. It is the emerald payoff the whole recovery machine exists for, and it is the only place `--ease-spring` appears.

- **What lands.** The recovered node on the timeline (and the recovered status pill in the dunning/recovery cockpit, doc 05) does a `scale-in` on `--ease-spring` and resolves in `--success` emerald with a live dot. An optional restrained emerald wash fades in behind the node over `--dur-slow`, then settles. The recovered amount, if shown, renders in kobo-derived naira (`value / 100`, integer, `tabular-nums`), never with a float.
  - *Trigger:* the arrival of `invoice.payment_recovered` for this object, whether live over the event stream (§3.9) or on load of an already-recovered history.
  - *Timing/easing:* `scaleIn` (`opacity:0; scale(.8)` to `1`) on `--ease-spring` over roughly `--dur-base` to `--dur-slow`; the wash is CSS opacity only.
  - *Reduced motion:* the recovered state appears with no spring, no scale, and no wash. The emerald color and the recovered label stay, because they carry the meaning, not the motion. If the failure branch went through a card OTP step, the `invoice.action_required` to `checkoutLink` step stays visible in both paths; it is a truth about how the recovery happened, not an ornament.
  - *Approach:* Motion spring on `transform: scale`; the wash is a restrained CSS gradient fade. Use the spring nowhere else. A `subscription.churned` outcome gets no flourish of any kind; involuntary churn is a plain danger-toned terminal node, and conflating its treatment with recovery would be dishonest.

### 3.8 Live-tail stream (webhook deliveries and events)

The developer area (doc 04) carries a persistent, streaming panel of outbound `webhook_deliveries` and the `domain_events` feed, rendered as raw signed JSON with the real headers (`x-nombaone-signature`, `x-nombaone-event-type`, `x-nombaone-delivery`, `x-nombaone-delivery-guarantee: at-least-once`). Dedupe is on `event.event.id`, the stable event id, because one event fans out to one delivery row per subscribed endpoint, and a replay re-arms the same delivery row in place without changing its id.

- **New line append.** A newly delivered event slides in at the bottom and the list auto-scrolls to it while the operator is at the tail.
  - *Trigger:* each streamed delivery or event (a new row from the deliveries feed, `GET /v1/webhooks/{id}/deliveries?status=&eventType=`, or the events feed `GET /v1/events?type=`).
  - *Timing/easing:* the new line does a quick `fade-up` (`translateY(6px)` to `0`, `opacity:0` to `1`) over `--dur-base` `--ease-out`; the panel auto-scrolls to the bottom only when the operator is already pinned to the tail. If they have scrolled up to read, do not yank them down; show an unobtrusive "N new" pill at the bottom edge that scrolls to the tail on click. A listening cursor blinks at the tail on a roughly 1s loop.
  - *Reduced motion:* lines appear instantly with no slide; the cursor may hold steady. The `aria-live="polite"` announcement of new events is unchanged, so a screen reader still hears them.
  - *Approach:* Motion for the line entrance, CSS for the cursor blink. Virtualize the list so a long tail stays at native-scroll speed, and only animate the entering line, never the whole list.
- **Delivery status transition.** A delivery moves through `pending`, `succeeded`, `failed`, and `dead`. When a status changes (for example a retry that succeeds, or a sixth attempt that goes `dead`), the row's status pill crossfades (§3.12). Replaying a dead delivery (`POST /v1/webhooks/{id}/deliveries/{deliveryId}/replay`) re-arms the same delivery row in place, resetting its status to `pending` without changing its id, so the at-least-once, replayable model stays visible and honest.

```
┌─ Live tail · deliveries ───────────────── ●listening ─┐
│ 12:04:02  ● succeeded  subscription.activated  whd_…   │
│ 12:04:11  ● succeeded  invoice.finalized       whd_…   │
│ 12:04:18  ● failed     invoice.payment_failed  whd_…   │  ← new line
│ 12:04:18  ◐ pending    invoice.action_required whd_… ▏ │    fade-up (dur-base)
│                                          blinking ▏cursor│
└─────────────────────────────────────────────────────────┘
  scrolled up? → [ 3 new ↓ ] pill instead of auto-yank
```

### 3.9 Skeleton and loading states

Every list and detail surface shows a skeleton on first load rather than a spinner-on-blank, so the layout is stable when data arrives (no reflow, no jump).

- **Skeleton shimmer.** Placeholder rows and blocks carry a slow shimmer.
  - *Trigger:* a fetch in flight past roughly 200ms; below that, show nothing rather than a flash.
  - *Timing/easing:* a low-contrast highlight sweeps across the placeholder via `transform: translateX` on a masked gradient, roughly a 1.2s to 1.5s loop, `--ease-in-out`, GPU-cheap. The skeleton's shape matches the real content's shape exactly, so the swap to real data does not move anything.
  - *Reduced motion:* the placeholder holds as a static muted block with no sweep. It still communicates "loading" by its presence.
  - *Approach:* CSS keyframe on `transform` only; never animate a background-position on a huge element, and never animate width or height. Pause the shimmer when the tab or panel is off-screen.
- **Skeleton to content.** When data resolves, the skeleton crossfades to content over `--dur-base` `--ease-out`; because shapes match, only opacity changes.
- **Inline spinner.** Buttons and the "Load more" control use the system `spin` for in-flight actions; under reduced motion the spinner is replaced by a static label ("Working", "Loading").

### 3.10 Focus rings and keyboard motion

The console is operated by keyboard as much as by pointer, and the focus ring is the most important "animation" in the product because it is always correct and never removed.

- **Focus ring.** On `:focus-visible`, the control shows the emerald ring: `box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 45%, transparent)` for buttons, `30%` for inputs, matching the system.
  - *Trigger:* keyboard focus (and programmatic focus, for example when a drawer opens and moves focus inward).
  - *Timing/easing:* the ring appears over `--dur-fast`; keep it near-instant so focus never lags the key press.
  - *Reduced motion:* the ring is present with no transition. It is never suppressed by reduced motion; suppressing it would break keyboard operation.
  - *Approach:* CSS. The ring uses `box-shadow`, which is the one sanctioned non-`transform`/`opacity` property because it does not trigger layout and it is essential to accessibility. Focus order follows the visual order; when the drawer or modal opens, focus moves in and traps, and on close it returns to the trigger (§3.4, §3.5).
- **Roving focus in tables.** Arrow-key movement between rows moves the same hover background plus the ring; no row translates under focus.

### 3.11 Metric tiles and count-ups (Overview)

The Overview reads `GET /v1/metrics/billing` into a stat row: `mrrInKobo`, `activeCount`, `voluntaryChurn` and `involuntaryChurn` (rendered as distinct figures, never a single "churn"), `failedChargeRate`, `dunningRecoveryRate`, and the `dunningFunnel`.

- **Count-up on load.** Each figure animates from zero to its value once, on the tile entering view.
  - *Trigger:* the tile mounts and enters the viewport, once.
  - *Timing/easing:* a short count-up over `--dur-slower` up to roughly 1s, `--ease-out`, rendered with `tabular-nums` so digits do not jitter. `mrrInKobo` renders as naira by integer division (`mrrInKobo / 100`), formatted with the naira symbol; the count-up tweens the displayed naira value, and the underlying kobo integer is never shown to a float and never rounded through a float. Rates render as percentages, not currency.
  - *Reduced motion:* the final value shows immediately with no tween.
  - *Approach:* Motion value tween (or a small counter hook) writing into a `tabular-nums` element; any accompanying tile reveal stays `opacity` and `transform` only.
- **Live refresh.** If a metric updates while the page is open, the figure rolls quickly to the new value over `--dur-base` rather than re-running the full count-up, so a refresh does not replay the intro.

```
┌─ MRR ──────────┐ ┌─ Active ───────┐ ┌─ Recovery rate ┐
│  ₦ 1,240,000   │ │      842       │ │     73.4%      │  ← count-up 0→value
│  tabular-nums  │ │  tabular-nums  │ │  tabular-nums  │    (dur-slower, once)
│  kobo/100, int │ │ activeCount    │ │ dunningRecov…  │
└────────────────┘ └────────────────┘ └────────────────┘
  churn split renders TWO figures: voluntary · involuntary (never merged)
```

### 3.12 Status badges and FSM pill transitions

Status is everywhere: subscription (`incomplete`, `incomplete_expired`, `trialing`, `active`, `past_due`, `paused`, `canceled`), invoice derived status, dunning attempt status, settlement, refund, payout, and webhook delivery. The badge set (doc 06) maps each enum to a semantic token: draft to neutral, active to accent, recovered to success with a live dot, past due to warning, canceled to danger, trialing to info.

- **Status change crossfade.** When an object's status changes in place (an action in a drawer, or a live event on the timeline or tail), the pill crossfades from the old token to the new one.
  - *Trigger:* an FSM transition on the visible object.
  - *Timing/easing:* label and color crossfade over `--dur-base` `--ease-out`; the pill does not resize abruptly (reserve width for the widest label so surrounding layout does not shift). A pill moving **to** `active` or to recovered may light its dot with the live `pulse`; a pill moving to `past_due`, `canceled`, or a delivery `dead` state does so plainly, with no flourish.
  - *Reduced motion:* the pill swaps token and label instantly; the live dot on active or recovered still pulses under the base rule unless reduced motion also stops the loop, in which case the dot rests filled. Color and label are always correct.
  - *Approach:* Motion crossfade or a CSS opacity swap on the label layer. The single exception to "a status change is quiet" is recovered, which additionally earns the §3.7 spring; every other transition is a calm crossfade.

### 3.13 Forms, inputs, and inline validation

Create and edit forms (customer, plan, price, coupon, webhook endpoint, billing settings) and the money inputs (credit grant, payout amount) all use the system input with its focus ring.

- **Input focus.** The border shifts to `--accent` and the ring appears over `--dur-fast` (system default). Under reduced motion the focus state is present with no transition.
- **Inline validation.** On a 422, the API returns `error.fields`; the console renders each field error next to its input. The invalid input's border shifts to `--danger` over `--dur-fast`; the message fades in below over `--dur-base`. No shake, no bounce; an error informs, it does not perform (doc 08).
  - *Reduced motion:* the danger border and message appear instantly.
  - *Approach:* CSS for the border, a short Motion or CSS fade for the message.
- **Money inputs.** A naira input stores integer kobo under the hood; the field shows naira and the console multiplies by 100 on submit with no float arithmetic. There is no motion special to money entry, but the confirm step for any amount that reaches a charge, payout, or refund endpoint restates the exact figure before submit, because the naira-versus-kobo unit is a known 100x risk and must be pinned, not animated over (§8).

### 3.14 Copy-once secrets and copy micro-interactions

- **Reveal-once secret.** An API key `secret` (`CreatedApiKeyResponseData.secret`) and a webhook `signingSecret` are shown exactly once on create or rotate. The field reveals with a short `fade-up` and carries a "you cannot retrieve this again" warning; there is no re-reveal animation because there is no re-reveal.
  - *Reduced motion:* the field appears instantly.
- **Copy.** The copy control swaps its label to "Copied" instantly and fires a toast (§3.8). Under reduced motion both the swap and the toast state stay; the toast slide may drop to an instant appearance.
  - *Approach:* CSS for the label swap, Motion or CSS for the toast.

### 3.15 Micro-interactions (inherited primitives)

These match the website table so the two surfaces share one physical language.

| Element | What and trigger | Timing / easing | Reduced motion | Approach |
|---|---|---|---|---|
| Buttons | background and border shift on hover; `scale(0.975)` on active press; focus ring | ~120ms (`--dur-fast`) | keep hover, active, and focus states; transition may be instant | CSS |
| Links | underline grows from left on hover and focus | `--dur-base`, `--ease-out` | underline appears instantly | CSS |
| Cards (metric tile, content card) | hover-lift: border to `--border-strong`, a whisper of `--shadow-sm`; no translate or rotate | `--dur-base` | show the lifted state instantly | CSS |
| Tabs (drawer tabs, code-sample tabs) | active indicator slides between tabs; content crossfades on switch | `--dur-base`, `--ease-out` | indicator jumps; content swaps with no fade | Motion (`layoutId`) + crossfade |
| Switch and toggle (billing settings, test/live) | thumb slides, track color shifts | `--dur-base`, `--ease-out` | thumb and track change state instantly | CSS |
| Theme toggle | token remap (dark to light) | `--dur-slow` on the token vars | instant remap, no transition | CSS transition on token vars |
| Toast | slides up and fades in, `translateY(20px)` to `0` | `--dur-base`, `--ease-out` | appears in place; slide may drop | CSS |
| Live dot / status dot | `pulse` loop on active and recovered | 1.6s to 1.8s, `--ease-in-out` | rests filled, no loop | CSS |

---

## 4. Per-surface mapping

Every console surface from doc 01 to doc 05, with its assigned motion. Each cell is fully specified in §3.

| Surface (doc) | Motion |
|---|---|
| App shell + nav (doc 01) | route crossfade + `fade-up`; nav active indicator slide; sticky-header elevation on scroll (§3.1) |
| Test/live switch (doc 01) | thumb slide + track shift; skeleton on reload; single confirming toast (§3.1) |
| List tables: subscriptions, customers, invoices, settlements (docs 02, 03) | `tbody` `fade-up` on load; row hover bg (no move); FLIP sort; selection action bar; load-more append (§3.2) |
| Filter bar (doc 01) | chip state shift; list crossfade to filtered result; skeleton only past ~200ms (§3.3) |
| Detail drawer: subscription, invoice, delivery, settlement (docs 02, 03, 04) | scrim fade + panel `translateX` in over `--dur-slow`; faster close; in-panel status crossfade (§3.4) |
| Confirm dialog: cancel, void, payout, refund, revoke (docs 02, 03, 04) | scale-and-fade over blurred scrim; in-flight spinner; typed error stays open, no shake (§3.5) |
| Subscription timeline (doc 05) | `scaleY` line draw + node reveals; live-dot on active node; voluntary vs involuntary distinct (§3.6) |
| Recovery peak (doc 05) | the one `--ease-spring` `scale-in`, emerald `invoice.payment_recovered`, optional wash (§3.7) |
| Live tail: deliveries + events (doc 04) | line `fade-up` append; tail auto-scroll or "N new" pill; blinking cursor; delivery status crossfade (§3.8) |
| Loading everywhere | shape-matched skeleton shimmer (transform sweep); skeleton-to-content crossfade; inline `spin` (§3.9) |
| Focus + keyboard (all) | emerald ring over `--dur-fast`, never suppressed; drawer/modal focus move and return (§3.10) |
| Overview metric tiles (doc 02) | count-up `0` to value, `tabular-nums`, kobo/100 integer; quick roll on live refresh (§3.11) |
| Status badges (all) | FSM pill crossfade; live dot on active/recovered only; recovered additionally earns the spring (§3.12) |
| Forms + money inputs (docs 02, 03) | input focus ring; inline `error.fields` (border + fade, no shake); amount restate before charge/payout/refund (§3.13) |
| Secrets + copy (doc 04) | reveal-once `fade-up`, no re-reveal; copy label swap + toast (§3.14) |

---

## 5. Tech approach

- **Motion (framer-motion)** for stateful and list enter/exit sequences: route transitions, the drawer and modal, the sort FLIP, the timeline draw and node reveals, the recovery spring, live-tail line entrances, count-ups, and the nav and tab indicators (`layoutId`). Use `whileInView` with `viewport={{ once: true }}` for one-time reveals like the metric count-ups.
- **CSS** for hovers, active-press, focus rings, the skeleton shimmer sweep, ambient loops (`pulse`, cursor blink), toast, switches, and the theme remap. Cheaper, jank-free, and correct with no JS.
- **IntersectionObserver** (or Motion's in-view) drives the count-ups and the deferred reveal of long timelines; ambient loops pause off-screen.
- **List virtualization** on the data table and the live tail so long lists scroll at native speed; animate only the entering range, never the whole list.
- Everything keys off the CSS custom-property durations and easings, so motion stays consistent with the design system and adjustable in one place. No component defines its own bezier or duration.

---

## 6. Reduced motion (mandatory)

Under `prefers-reduced-motion: reduce`, the inherited media query collapses every animation and transition to `.001ms` and sets `scroll-behavior: auto`. On top of that global rule the console guarantees, surface by surface:

- Route changes, table mounts, filter swaps, drawer and modal opens, timeline draws, and live-tail appends all become **instant appearances** with no translate. Every row, node, and line is present and legible.
- The skeleton holds as a static muted block (no sweep) and still communicates loading by its presence; inline spinners become static "Working" or "Loading" labels.
- Count-ups show their **final values** immediately. `mrrInKobo` still renders as integer-derived naira with `tabular-nums`.
- Sliding indicators (nav, tabs, sort caret) **jump** to their target; the switch thumb and track change state instantly.
- The **focus ring is never suppressed**; keyboard operation is identical with zero motion.
- The **recovery still lands in emerald**: `invoice.payment_recovered` shows in `--success` with its label and, if the failure went through a card OTP step, the `invoice.action_required` to `checkoutLink` step still shows. Only the spring, scale, and wash drop. The meaning stays; the flourish goes.
- Voluntary `subscription.canceled` and involuntary `subscription.churned` stay visually distinct.
- Live dots rest filled rather than pulsing.

The console must be fully usable, fully honest, and fully legible with zero motion.

---

## 7. Performance budget for motion

- Animate only `transform` and `opacity`, never layout properties (`width`, `height`, `top`, `left`) in loops, reveals, or per-row work. The one sanctioned exception is the focus ring's `box-shadow`, which does not trigger layout and is essential to accessibility.
- Per-row and per-line work is capped: the table animates the visible range only, the timeline draws the first screenful and reveals the rest on scroll-in, and the live tail animates only the entering line. A list of thousands never animates thousands of nodes.
- Ambient loops (live dot, attempting pulse, skeleton shimmer, cursor blink) run at low frequency, stay GPU-friendly, and pause when off-screen.
- The first meaningful list must render its skeleton without waiting on animation JS; the shell and table paint, then Motion enhances. Motion bundles for the timeline and simulator-style surfaces can lazy-load.
- Target: motion never pushes the console off its performance floor (doc 00). If an effect costs the interaction-latency target, the effect loses. A dashboard an operator opens fifty times a day must feel fast every single time.

Proceed to doc 08.
