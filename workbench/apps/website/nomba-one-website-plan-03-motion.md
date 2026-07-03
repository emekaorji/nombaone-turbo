# Nomba One · Website Plan · 03 · Motion & "Alive"

> Depends on docs 00–02. The site must feel alive with subtle movement and smooth flow, without feeling busy or "AI-generated." Motion is tokenised in the design system; this doc says where and how to spend it. The governing rule: **every animation must earn its place by teaching or guiding.** Decoration that does neither gets cut.

---

## 1. Principles

- **Alive, not busy.** Ambient motion is slow and low-amplitude; interactive motion is quick and precise. If two things move at once for no reason, remove one.
- **One physical language.** Everything uses the design system's three easing curves and four durations; nothing hand-rolls a bezier. `--ease-out` for entrances and most UI, `--ease-in-out` for looping ambient, `--ease-spring` for the rare playful accent (the recovery pop).
- **Orchestrate the peaks, keep the rest quiet.** A few staged moments (hero load, the simulator recovery) land harder than motion sprinkled everywhere. Spend boldness in one place per screen.
- **Motion serves meaning.** A reveal directs attention to new content; a hover confirms interactivity; the lifecycle line encodes sequence; the recovery pop marks the emotional peak. None is there just to move.
- **Never hijack scroll.** Native scroll only. No smooth-scroll libraries that fight the browser; they cost accessibility and performance. Reveal-on-enter, not scroll-jacking.

---

## Pencil-can't-show nuances (build these)

> Pencil renders these **statically**, but they are central to how the finished site *feels*: the pivotal gradients, animations, and movements a still frame cannot carry. Each entry below is build-ready, giving what it is, its trigger, rough timing/easing, the reduced-motion fallback, and the CSS-vs-Motion split. They expand the catalog in §3 and are the detailed spec behind every cell of the per-section map in §4; they inherit the principles in §1; simulator internals live in **doc 02**.
>
> **Governing approach (doc 00 §9).** Use **Motion (framer-motion)** for orchestrated, scroll-driven, and stateful sequences; use **CSS** for ambient loops and simple hovers. Animate **only `transform` and `opacity`**. Respect `prefers-reduced-motion` everywhere. Pause ambient loops off-screen. The hero must reach **LCP without waiting on animation JS**. The simulator and Motion bundles **lazy-load**. Native scroll only, no scroll-hijack.

### Hero

- **Rotating-audience word.** The gradient word cycles: `developer → founder → merchant → engineering & business decision-maker → program manager → (loop)`.
  - *Trigger:* auto-loop, starting once the hero load sequence has settled; paused while the hero is off-screen and under reduced-motion.
  - *Timing/easing:* hold ~2.2s per word, then a ~450ms `--ease-out` swap (between `--dur-slow` and `--dur-slower`; tokenise as the roll duration). A **masked vertical roll** reads best: the outgoing word slides and fades **up and out** while the incoming word slides and fades **up in**, behind an `overflow: hidden` mask. The line width eases to each new word's width so the sentence never jumps. The emerald clip-gradient (`#7deabd → #0bdfa3 → #00c38b`) stays applied throughout; an optional very-slow `background-position` shimmer adds life.
  - *Reduced motion:* no cycling. Rest on one audience ("developer"), no roll, no shimmer; the caption still names the rest.
  - *Approach:* **Motion** (`AnimatePresence` keyed on the audience index) for the roll, animating `transform`/`opacity` only. For width-follows-word, measure each word and animate a wrapper via `layout`/transform rather than tweening `width`; if a real width tween is used, cap it and budget it against CLS (doc 00 §11). The shimmer is **CSS** (`background-position` keyframes, GPU-cheap). Refines §3.1's rotating-word note.
- **Hero glow.** The radial-gradient hero background breathes.
  - *Trigger:* ambient, always-on while the hero is in view; a very low-amplitude scale/opacity oscillation and/or a slow drift.
  - *Timing/easing:* ~8s loop, `--ease-in-out`, amplitude of only a few percent so it reads as life, not motion.
  - *Reduced motion:* static tint. It is a **background fill, never an overlay**, so it already sits behind the type and CTAs (see §3.1); it simply stops breathing.
  - *Approach:* **CSS** keyframes on the background layer's `transform: scale()` / `opacity`, paused off-screen. Never animate the gradient's geometry (layout) and never paint it above content.
- **Load sequence.** One considered entrance, not a cascade.
  - *Trigger:* on hero mount (first paint), independent of the simulator and Motion heavy bundles.
  - *Timing/easing:* headline → sub → CTAs → caption, each `fade-up` staggered ~60–80ms, ~520ms (`--dur-slower`), `--ease-out`. No eyebrow.
  - *Reduced motion:* instant appearance, no translate; content is present at LCP regardless.
  - *Approach:* **Motion** for the stagger, but the hero must reach **LCP without waiting on animation JS** (doc 00 §9, §11): render the headline server-side so the entrance enhances rather than gates first paint. Refines §3.2's hero-load note.

### Global section reveals

- **Section arrival.** Each major section reveals as it enters.
  - *Trigger:* IntersectionObserver at threshold ~0.1, fired **once**.
  - *Timing/easing:* `translateY ~16px → 0`, `opacity 0 → 1`, ~520ms (`--dur-slower`), `--ease-out`. Multi-item groups (rail cards, perks, use-case cards, hard-parts cards, DIY columns, trust items) stagger their children ~60ms.
  - *Reduced motion:* instant appearance, no translate; the stagger collapses to zero.
  - *Approach:* **Motion** `whileInView` with `viewport={{ once: true }}`, a container `staggerChildren` for groups. Separation between sections is whitespace plus this arrival timing, **never a divider**. Extends §3.2.

### Rails showcase

- **Fan-out connectors.** The "subscription" node connects to the three rail cards with connector lines, implying one object fanning out to every rail.
  - *Trigger:* connectors **draw** on section enter; then a periodic **pulse** travels down each connector into the cards. Cards stagger-reveal and each has a hover-lift.
  - *Timing/easing:* draw ~520ms `--ease-out` on enter; the travelling pulse is an ambient loop (~2s, `--ease-in-out`); card stagger ~60ms.
  - *Reduced motion:* lines appear fully drawn instantly; no travelling pulse; cards appear without translate. Hover-lift (a state, not a loop) stays.
  - *Approach:* **Motion** for the SVG stroke draw (`pathLength` 0 → 1, the one sanctioned on-enter dashoffset use). For the pulse, prefer a small dot translated along the path (`transform`); a low-frequency `stroke-dashoffset` sweep is an acceptable alternative. Both pause off-screen. Hover-lift is **CSS**.

### The live simulator (the emotional peak)

Full interactive spec in **doc 02** (mechanics in §5, sandbox contract in §6, motion in §7, a11y in §9); this expands §3.4 with the specific movements.

- **Timeline pills.** States move `pending → active → done/failed → recovered`; the active pill pulses.
  - *Trigger:* driven by **real sandbox events** (doc 02 §6); each event advances a pill.
  - *Timing/easing:* state transitions on `--dur-base` / `--ease-out`; active-pill pulse ~1.6–1.8s `--ease-in-out`.
  - *Reduced motion:* pills change state instantly (color + label), no pulse. **Every state change and all logic remain** (doc 02 §9).
  - *Approach:* **Motion** for state transitions; **CSS** for the pulse loop.
- **Webhook console.** Lines stream in, newest at bottom, auto-scroll, a blinking cursor implies "listening."
  - *Trigger:* each streamed SSE/websocket event (doc 02 §6) appends a raw-JSON line.
  - *Timing/easing:* quick fade/slide-in (~`--dur-base`, `--ease-out`); auto-scroll to bottom; cursor blink ~1s loop.
  - *Reduced motion:* lines appear instantly (no slide); the cursor may hold steady; the `aria-live` announcements are unchanged (doc 02 §9).
  - *Approach:* **Motion** for line entrance; **CSS** for the cursor. Ships inside the lazy-loaded simulator bundle.
- **Recovery flourish (the one earned moment).** The recovered pill does a **spring scale-in**, `invoice.payment_recovered` lands in emerald, and the card-failure branch visibly shows the **OTP → checkout-link** step.
  - *Trigger:* the recovery event on the failure→dunning branch; time-compressed (1 cycle ≈ 2s).
  - *Timing/easing:* `scale-in` on `--ease-spring` (the doc's only spring); the recovered line and optional wash render in emerald.
  - *Reduced motion:* the recovered state appears with no spring/scale and no wash; the emerald color and the OTP → checkout-link step **stay** (they carry meaning, not decoration).
  - *Approach:* **Motion** spring on `transform: scale`; the emerald wash, if used, is a restrained **CSS** gradient. This is the single sanctioned flourish (§1, §3.4).

### Lifecycle pipeline

- **Drawing progress line + node activation.** A horizontal line encodes the 5-stage sequence through motion.
  - *Trigger:* the line **draws left-to-right** as the visitor scrolls the five stages; each numbered node badge **activates** (fills emerald / brightens) as its stage enters.
  - *Timing/easing:* the draw tracks scroll position (native scroll, no hijack); node activation ~`--dur-base`, `--ease-out`, on enter.
  - *Reduced motion:* the line is shown fully drawn; nodes appear in their active state as they enter, with no draw animation.
  - *Approach:* **Motion** `useScroll` / `scrollYProgress` mapped to the line's `scaleX` (transform, not width) and to per-node state; **native scroll only**. Extends §3.2's lifecycle line.

### DIY "what you'd rebuild" stack

- **Burden stack + stat count-up.** The stack visibly piles up the work; the thin Nomba base settles beneath it.
  - *Trigger:* on section enter.
  - *Timing/easing:* blocks cascade in **top-down**, one by one, stagger ~80ms, each `fade-up` / `--ease-out`, to make the burden pile up; the thin Nomba base slides in **last** and settles under the stack. The "< 2%" stat counts up `0 → 2%`.
  - *Reduced motion:* all blocks and the base appear at once, no translate; the stat shows its final value ("< 2%") with no tween.
  - *Approach:* **Motion** for the cascade and the base settle; the count-up is a **Motion** value tween (or a tiny JS counter) rendered with `tabular-nums`. Extends §3.2.

### Trust ledger

- **Rows fill, then the two sides "lock."** Debit and credit rows fill in, then the "balanced, and reconciled to the kobo" footer and PAID pill resolve.
  - *Trigger:* rows on section enter; the lock resolves once both columns are in.
  - *Timing/easing:* rows fade up in a quick stagger (~60ms); on lock, a **check-draw** plus a subtle emerald glow (~`--dur-slow`); amounts may count up.
  - *Reduced motion:* rows and totals appear instantly; the check and PAID pill show in their resolved state with no draw/glow; amounts show final values.
  - *Approach:* **Motion** for the row stagger and the check-draw (`pathLength` 0 → 1); the emerald glow is a restrained **CSS** opacity fade. Count-ups use `tabular-nums`.

### Metrics / stats

- **Number count-ups.** Any figure animates from zero to its value on enter (MRR, churn %, recovery %, the "< 2%").
  - *Trigger:* on enter, once.
  - *Timing/easing:* a short count-up (~`--dur-slower` up to ~1s), `--ease-out`; render with **`tabular-nums`** so digits do not jitter.
  - *Reduced motion:* the final value is shown immediately, no tween.
  - *Approach:* **Motion** value tween (or a small hook) writing into a `tabular-nums` element; any accompanying reveal stays `opacity`/`transform` only.

### Micro-interactions

| Element | What & trigger | Timing / easing | Reduced motion | Approach |
|---|---|---|---|---|
| Buttons | bg/border shift on hover; `scale(0.975)` on active; token focus ring | ~120ms (`--dur-fast`) | keep focus ring + active/hover state; transition may be instant | CSS |
| Links | underline grows from left on hover/focus | ~`--dur-base`, `--ease-out` | underline appears instantly | CSS |
| Cards (rail, use-case, hard-parts, perk) | hover-lift: border → `--border-strong`, a whisper of `--shadow-sm`; no big translate/rotate | ~200ms (`--dur-base`) | show the lifted state instantly, no transition | CSS |
| Tabs (LangTabs, simulator rail selector) | active underline/indicator **slides** between tabs; code cross-fades on switch | ~200ms (`--dur-base`), `--ease-out` | indicator jumps; code swaps with no fade | Motion (`layoutId` indicator) + cross-fade |
| Code / npm line | Copy → Copied label swap + toast | swap instant; toast ~`--dur-base` | swap + toast stay (state); toast slide may drop | CSS / Motion |
| Webhook ticker | cycles lines every few seconds with a quick fade; pauses off-screen | fade ~`--dur-base` | no cycling; show one line | Motion / CSS (ties §3.1) |
| Sticky header | gains backdrop-blur + a hairline/elevation once the page scrolls past the hero | ~`--dur-base` toggle | apply blur/elevation at the threshold; transition may be instant | CSS + scroll-position state (native scroll) |
| Mobile nav | full-height sheet slides in; body scroll locks | slide ~`--dur-slow`, `--ease-out` | sheet appears without slide; scroll-lock unchanged | Motion/CSS transform + scroll-lock |
| Theme toggle (if shipped) | token remap on toggle | ~320ms (`--dur-slow`) | instant remap, no transition | CSS transition on token vars (ties §3.6) |

### Gradients (used with restraint)

- **Hero background radial glow.** Dark-emerald center `→` near-black edge. A static **CSS** background fill (its ambient breathe is the Hero glow above). Never an overlay.
- **Accent-word linear emerald gradient.** `#7deabd → #0bdfa3 → #00c38b` clipped to the rotating word (`background-clip: text`), **CSS**; a static ramp, only the word beneath it changes.
- **Recovered-moment emerald wash (optional).** A restrained emerald fill at the recovery flourish only, **CSS**, opacity-faded in.
- **Rainbow Integrations nav gradient.** An animated multi-color rainbow ramp clipped to the "Integrations" nav text, the one deliberately playful flourish in the chrome; **CSS** hue-cycle or `background-position` drift, spec'd under **Chrome / nav** below. Static rainbow under reduced-motion.
- **Pricing-FAQ arrow emerald gradient.** The up-right arrow beside "Questions, answered." reuses the accent emerald ramp via `background-clip`, **CSS**; the ramp is static, only its hover transform moves. Spec'd under **Pricing FAQ to Hall** below.
- **No other decorative gradients.** The home budget stays the three above; the rainbow nav flourish and the Hall arrow are the only sanctioned additions, both in chrome/Hall context.

### Chrome / nav, Ask modal, and the Hall (new since docs 00 to 02)

> These cover surfaces added after the home map: the animated rainbow **Integrations** nav item, the /pricing FAQ arrow into the Hall, the shared **Ask the Hall** modal, and the **Hall** (/hall) itself. Each entry keeps the same shape as the rest of this section: what, trigger, timing/easing, reduced-motion fallback, and the CSS-vs-Motion split. They inherit the principles in §1 and the governing approach above. Every "Add your question" affordance opens the same lazy-loaded Ask modal.

#### Chrome / nav

- **Rainbow Integrations nav item.** The "Integrations" primary-nav item carries a permanent, richly colorful animated rainbow gradient on its text fill, the one deliberately playful flourish in the otherwise-restrained chrome, drawing the eye to the DX breadth.
  - *Trigger:* ambient, always-on while the header is mounted. A slow hue cycle or `background-position` drift under the clipped text; the header is always on-screen, so no off-screen pause is needed.
  - *Timing/easing:* ~6 to 8s loop, `--ease-in-out` (or `linear` for a seamless hue cycle), subtle and GPU-friendly. Use `background-clip: text` with an oversized `background-size` so `background-position` can drift without the ramp ever looking cut.
  - *Reduced motion:* a **static rainbow gradient**. The color stays, only the animation stops. The active-nav rule is untouched: each page highlights its own primary-nav item (Product, Integrations, Use cases, Pricing), while /trust, /guides, /changelog, /hall and the home highlight nothing.
  - *Approach:* **CSS** keyframes on `background-position` (or a `hue-rotate` filter on the clipped text), no JS, GPU-cheap paint only. Ambient, but chrome-persistent so it never gates LCP.

#### Pricing FAQ to Hall

- **Emerald-gradient up-right arrow.** Beside the "Questions, answered." heading in the /pricing FAQ sits a bare up-right arrow painted with the accent emerald gradient, underlined like a link (no circle or button chrome); it links to /hall. The FAQ also gains an "Add your question" button at the bottom that opens the Ask modal, under the line "Not here? Ask us. We answer in the open, in the Hall."
  - *Trigger:* hover/focus on the arrow (or its heading link).
  - *Timing/easing:* on hover the arrow **lifts and rotates slightly**, a few px up-right plus ~4 to 6 degrees, ~`--dur-base`, `--ease-out`. The emerald fill is static.
  - *Reduced motion:* no lift or rotate; the arrow rests and still links to /hall. Focus ring stays.
  - *Approach:* **CSS** `transform` (translate + rotate) on hover/focus, transform/opacity only; the gradient is a static `background-clip` ramp reusing the accent tokens.

#### Ask modal ("Ask the Hall")

- **Open: scale-and-fade over backdrop blur.** The shared modal, opened by any "Add your question" affordance.
  - *Trigger:* click/tap on any "Add your question" button (pricing FAQ bottom, Hall hero).
  - *Timing/easing:* the backdrop `backdrop-filter` blur fades in while the dialog scale-and-fades (`scale 0.96 → 1`, `opacity 0 → 1`), ~`--dur-slow`, `--ease-out`; close reverses over ~`--dur-base`. Focus moves into the dialog on open.
  - *Reduced motion:* no scale and no blur transition; dialog and backdrop appear instantly. Focus-trap, scroll-lock, and Escape-to-close are unchanged.
  - *Approach:* **Motion** (`AnimatePresence`) on the dialog `transform`/`opacity`; the backdrop blur is **CSS** (`backdrop-filter`), applied instantly under reduced motion. Ships in the lazy-loaded modal bundle, so it never gates first paint.
- **Funky handle generation.** The Name field is prefilled with a client-side gen-z handle (e.g. @midnight_debugger, ships_at_3am, kudi_gremlin), editable ("tap to rename"), to lower the bar to ask.
  - *Trigger:* generated **once on modal open** (a fresh handle each open), client-side, no network.
  - *Timing/easing:* the handle is simply present at open with the dialog entrance; an optional quick fade (~`--dur-fast`) if the user regenerates. No loop.
  - *Reduced motion:* the handle appears in the field with no fade; editing is unchanged.
  - *Approach:* client-side JS picks from adjective/noun lists at open and writes the field; no animation beyond the modal entrance. Purely client-side.
- **"Might help, before you even ask" suggestions.** As the user types in the problem textarea ("What are you stuck on?"), a panel surfaces matched guides, docs, and a simulator deep-link; each row is an icon + title + a small type tag (GUIDE / DOCS / LIVE). It deflects and helps in one move.
  - *Trigger:* debounced input on the textarea, a debounced search over guides + docs + the event catalog; rows fade/slide in as they resolve.
  - *Timing/easing:* debounce ~250 to 300ms after the last keystroke; each row fades and slides in (`translateY ~8px → 0`, `opacity 0 → 1`), quick stagger ~50ms, ~`--dur-base`, `--ease-out`; rows that fall out of the result set fade out.
  - *Reduced motion:* rows appear and disappear instantly, no slide; the debounce, matching, and result content are unchanged.
  - *Approach:* **Motion** `AnimatePresence` for row enter/exit on `transform`/`opacity`; the debounced search is plain client logic. Put `aria-live="polite"` on the panel so results are announced.
- **Feature toggle: switch animation + ON/OFF label cross-fade.** A switch controls whether the approved question may appear publicly. ON shows "Feature my question in the Hall" (the word Hall links to /hall) at full opacity; OFF shows "Do not feature my question in the Hall" with the label slightly greyed and the switch off. The footer note follows: ON = "Nothing goes live without review."; OFF = "Private. Only our team will see this."
  - *Trigger:* toggling the switch.
  - *Timing/easing:* the switch thumb slides and the track color shifts (~`--dur-base`, `--ease-out`); the label and footer note **cross-fade** between the ON and OFF copy (opacity swap ~`--dur-base`), with the OFF label easing to the greyed tone.
  - *Reduced motion:* the thumb, track, and greyed tone change state instantly; the copy swaps with no cross-fade. The greyed OFF state stays (it is state, not decoration).
  - *Approach:* **CSS** transition on the thumb `transform` and the track/label color; a simple opacity cross-fade (**CSS** or **Motion**) for the label and footer copy. Toggle state is the source of truth; motion only enhances it.
- **Attachment animate-in.** "Add code" (a mono-formatted snippet dump) and "Add image" (a screenshot) produce an attached-state chip ("1 snippet added").
  - *Trigger:* on attaching a snippet or image; reverse on remove.
  - *Timing/easing:* the chip animates in (`scale 0.96 → 1` + `opacity 0 → 1`, or a short fade-up), ~`--dur-base`, `--ease-out`; removal fades out.
  - *Reduced motion:* the chip appears and removes instantly, no scale or fade; attach/remove logic unchanged.
  - *Approach:* **Motion** `AnimatePresence` on the chip `transform`/`opacity`, or **CSS** for a single fade. In the modal bundle.

#### The Hall (/hall)

- **Masonry exhibit reveal (stagger).** The masonry wall of variable-height "exhibits" reveals as the visitor scrolls.
  - *Trigger:* IntersectionObserver per exhibit (or per row), fired **once** as each enters.
  - *Timing/easing:* exhibits fade up (`translateY ~16px → 0`, `opacity 0 → 1`), ~`--dur-slower`, `--ease-out`, with a masonry stagger ~60 to 80ms so the wall assembles column-aware rather than all at once.
  - *Reduced motion:* exhibits appear instantly, no translate; the stagger collapses to zero.
  - *Approach:* **Motion** `whileInView` with `viewport={{ once: true }}` and `staggerChildren` across the grid, transform/opacity only; **native scroll**, no hijack. Mirrors the Global section reveals spec above.
- **Filter-chip grid transition.** The chips (All, Rails, Dunning, Reconciliation, Multi-tenant, Migration) re-lay-out the wall on selection.
  - *Trigger:* selecting a filter chip.
  - *Timing/easing:* the active chip's indicator/fill shifts (~`--dur-base`, `--ease-out`); the grid animates as exhibits enter and exit, filtered-out items fade/scale out and the remaining items ease to their new positions (~`--dur-slow`).
  - *Reduced motion:* the grid updates instantly (items appear and disappear with no position tween or fade); the active-chip state still changes. The result set is identical either way.
  - *Approach:* **Motion** layout animations (`layout` on grid items, `AnimatePresence` for enter/exit) on transform/opacity; the chip indicator can reuse the `layoutId` pattern from the Tabs micro-interaction. Under reduced motion these collapse to instant swaps.
- **Live-count tick.** The hero live count ("1,204 answered, in public") animates on view.
  - *Trigger:* on the hero entering view, once; an optional quick tick if the real count updates while the page is open.
  - *Timing/easing:* a short count-up to the value (~`--dur-slower` up to ~1s), `--ease-out`, rendered with **`tabular-nums`** so digits do not jitter; a live increment rolls quickly.
  - *Reduced motion:* the final count shows immediately, no count-up or tick.
  - *Approach:* **Motion** value tween (or a small counter hook) into a `tabular-nums` element; mirrors the Metrics / stats spec above.
- **"Answered" seal emphasis.** Each exhibit's team answer is led by a green "Nomba One team" check-seal; the seal can land with a small emphasis.
  - *Trigger:* tied to the exhibit's reveal (as it scrolls in), once.
  - *Timing/easing:* a restrained `scale-in` and/or **check-draw** (`pathLength` 0 → 1) on the seal, ~`--dur-slow`, `--ease-out`; keep it subtle. The spring stays reserved for the simulator recovery (§1, §3.4), so the seal does not use `--ease-spring`.
  - *Reduced motion:* the seal shows in its resolved state, no scale or draw; the green check and the "Nomba One team" label stay (they carry the trust meaning).
  - *Approach:* **Motion** `scale`/`pathLength` inside the exhibit reveal, or **CSS** for a single fade; restrained, in keeping with the one-earned-moment principle.

### Reduced motion (mandatory)

Under `prefers-reduced-motion: reduce`: disable cycling, glow drift, every ambient loop, and the simulator flourishes; replace reveals with instant appearance (no translate); **keep every state change, all logic, and full legibility**. Count-ups show final values, sliding indicators jump, the recovery still lands in emerald, and the OTP → checkout-link step still shows. The rainbow Integrations nav rests as a static rainbow, the pricing arrow stops lifting/rotating, the Hall live count shows its final value, the masonry and filter grid update instantly, the Ask modal opens with no scale or blur transition (its focus-trap, scroll-lock, and logic intact), and the "answered" seal shows resolved. The site must be fully usable and honest with **zero motion**. This restates and itemises §6, which stays the canonical toggle.

---

## 2. Token reference (from the design system)

- Durations: `--dur-fast 120ms` · `--dur-base 200ms` · `--dur-slow 320ms` · `--dur-slower 520ms`
- Easing: `--ease-out` (entrances/UI) · `--ease-in-out` (ambient loops) · `--ease-spring` (accent pop)
- Named patterns already defined: `fade-up`, `scale-in`, `pulse` (live), `float` (ambient).

## 3. The motion catalog

### 3.1 Ambient (always-on, low-key)
- **Hero glow (background fill, not an overlay).** The emerald glow is an ambient **background** radial-gradient fill on the hero frame: a dark-emerald center fading to a near-black edge. It is *not* a moving or absolute-positioned ellipse. **Build note:** absolute/overlay elements paint *above* content (true in Pencil and in CSS stacking), so a glow that sits over the headline is wrong; it must be a background so the type and CTAs read on top of it. It does not translate or animate; any "alive" feeling in the hero comes from the rotating word, not the glow. This is the single largest static "alive" signal; keep it tasteful. Under reduced-motion it is unchanged (it never moved): a static tint.
- **Rotating-audience hero word.** The dynamic `{audience}` in the headline "Subscriptions for every {audience}." cycles through a set (developer → founder → merchant → engineering/business decision-maker → program manager, and similar) on a slow, ambient loop. Each word holds ~1.8–2.2s, then swaps via a quick `fade-up` (out on the old word, in on the new) over `--dur-slow`, `--ease-in-out`. The container reserves the widest word's width so surrounding layout never reflows as words swap (animate `opacity` and `transform` only). A caption beneath the headline names the audiences, so the meaning survives even if a visitor never sees a swap. **Reduced-motion:** the cycle stops and the word rests on one audience (e.g. "developer"), with no fade and no swap.
- **Accent-gradient word.** That dynamic word is painted with the accent gradient: a linear emerald ramp `#7deabd → #0bdfa3 → #00c38b` clipped to the text (`background-clip: text`). The gradient itself is static; only the word underneath it changes. This is the hero's one gradient flourish; the rest of the headline stays in the neutral foreground color.
- **Live dots.** The webhook ticker dot and any "operational" status dot use `pulse` (~1.6–1.8s).
- **Ticker.** The hero webhook ticker updates every few seconds (real or realistic), with a quick fade between lines.
- Ambient motion pauses when off-screen and respects reduced-motion.

### 3.2 Entrance / reveal (on load + on scroll)
- **Hero load sequence.** A short, orchestrated entrance: headline → audience caption → subcopy → CTAs, each `fade-up` staggered ~60–80ms, `--dur-slower`, `--ease-out`. No eyebrow (sections no longer use one) and no code block in the hero (the code snippet lives in the DX section). The rotating word begins its cycle once the headline has settled. One considered moment, not a cascade of everything on the page.
- **Section reveals.** Each major section fades up as it enters the viewport (IntersectionObserver, threshold ~0.1), once. Multi-item groups (the DIY columns, use-case cards, hard-parts cards) stagger their children.
- **The lifecycle progress line.** As the visitor scrolls through the five lifecycle stages, a horizontal accent line *draws* to track progress along the numbered pipeline, and each stage reveals on enter, encoding the sequence through motion.

### 3.3 Hover / micro-interactions
- **Buttons:** `--dur-fast` background/border transition; `scale(0.975)` on active. Focus ring via the token.
- **Links:** the underline-grows-from-left (already in the design system).
- **Cards** (use-cases, hard-parts): a restrained lift where the border brightens to `--border-strong`, a whisper of `--shadow-sm`, ~`--dur-base`. No big translate or rotate.
- **Code block copy:** button confirms with a quick label swap ("Copy" → "Copied") + toast.
- **Tabs** (language/framework switcher): the active underline slides between tabs (`--dur-base`, `--ease-out`).

### 3.4 The simulator (the peak)
Per doc 02 §7: timeline pills transition through states; the active pill pulses; webhook lines stream with a quick fade/slide; the **recovery moment** gets the one `--ease-spring` scale-in on the recovered pill and the emerald `payment_recovered` line. This is the deliberate emotional peak, the only place a little extra is justified.

### 3.5 Page transitions
- Keep them subtle: a quick cross-fade / short fade-up on route change (`--dur-base`). Nothing elaborate; infra sites feel fast, and heavy page transitions read as slow.

### 3.6 Theme toggle (if shipped)
- The token remap transitions smoothly (background/border/color over `--dur-slow`), the same satisfying flip the design-system file demonstrates.

## 4. Per-section mapping (home)

| Section (doc 01) | Motion |
|---|---|
| 3.1 Hero | background emerald glow (static fill) + rotating accent-gradient audience word + ticker; orchestrated load sequence |
| 3.2 DIY question | staggered column reveal on scroll |
| 3.3 Simulator | full simulator motion (doc 02 §7) |
| 3.4 Lifecycle | drawing progress line + per-stage reveal |
| 3.5 Rails/DX | tab underline slide; code fade on switch |
| 3.6 Hard parts | staggered card reveal; card hover-lift |
| 3.7 Platforms | single diagram reveal |
| 3.8 Trust band | items fade up in a quick stagger; status dot pulse |
| 3.9 Use cases | staggered card reveal; hover-lift |
| 3.10 Final CTA | gentle fade-up; install line has a copy micro-interaction |

> Every cell above is specified in build detail under **Pencil-can't-show nuances (build these)**: the exact trigger, timing/easing, reduced-motion fallback, and CSS-vs-Motion split for each movement Pencil could only show as a still.

## 5. Tech approach

- **Motion (framer-motion)** for orchestrated reveals, staggers, the lifecycle line, the rotating-audience hero word (an `AnimatePresence` swap), and the simulator. Use `whileInView` with `viewport={{ once: true }}` for reveals.
- **CSS** for the hero background glow (a static radial-gradient fill, no animation), ambient loops (pulse, float), hovers, and simple transitions; cheaper and jank-free.
- **IntersectionObserver** (or Motion's in-view) drives reveals; ambient loops pause off-screen.
- Everything keys off the CSS custom-property durations/easings so motion stays consistent with the design system and adjustable in one place.

## 6. Reduced motion (mandatory)

- Under `prefers-reduced-motion: reduce`: disable ambient loops, stop the rotating-audience word on a single audience (the caption still names the rest), keep the hero glow as the static background tint it already is (it never moved), replace reveals with instant appearance (no translate), and strip the simulator flourishes while keeping all state changes and logic. The site must be fully usable and legible with zero motion. The design-system file already models the media-query approach; mirror it.

## 7. Performance budget for motion

- Animate only `transform` and `opacity`, never layout properties (width/height/top/left) in loops or reveals.
- Ambient effects must not run the CPU hot: low frequency, GPU-friendly, paused off-screen.
- The hero must reach LCP without waiting on animation JS. The glow and ticker enhance, they don't gate first paint. Simulator and Motion bundles lazy-load.
- Target: motion never pushes the site off its performance floor (doc 00 §11). If a nice effect costs the LCP target, the effect loses.

## 8. As designed (Pencil)

Designed as the standalone **"Motion · doc 03" board** in `workbench/NOMBAONE.pen` (frame `Qa13H`), the
build-ready keyframe reference Phase B animates against. Motion is shown statically via proxies (fill alpha =
opacity, position offset = translateY, a partially-filled bar = draw/pathLength, a size delta = scale, offset
copies = stagger); the easing curves are drawn as real `type:"path"` beziers (the spring visibly overshoots).
The design-system board keeps its compact motion deck as the token reference, and the one `--ease-spring` (the
simulator recovery pop) lives on the doc-02 board (`vpYGM`), cross-referenced here rather than repeated.
Verified in dark and light, zero em dashes.

Twelve sections, each in the canonical dark language:

- **§1 Foundations**: the three easing curves plotted (out / in-out / spring), the four durations shown to
  scale (1px = 1ms), and the four named patterns (fade-up, scale-in, pulse, float) as keyframe strips.
- **§2 Hero**: the masked rotating-word roll (emerald clip-gradient), the background glow breathe, and the
  staggered load sequence.
- **§3 Reveals**: section arrival fade-up + group stagger (separation is whitespace and timing, never a
  divider).
- **§4 Rails**: the fan-out connectors that draw on enter, then a pulse travels each into the rail cards.
- **§5 Lifecycle**: the progress line that draws left-to-right with scroll + per-node activation.
- **§6 DIY**: the burden stack cascading top-down + the thin base settling last + the "< 2%" count-up.
- **§7 Trust ledger**: rows fill, then the two sides lock (check-draw + emerald glow + PAID pill).
- **§8 Micro-interactions**: a compact reference table (button, link, card, tabs, copy line, ticker, sticky
  header, mobile nav, theme toggle) with timing token, reduced-motion, and CSS-vs-Motion per row.
- **§9 Gradients**: the sanctioned budget as swatch rows (accent word ramp, rainbow Integrations nav, pricing
  arrow, recovered wash).
- **§10 Ask modal**: open (scale-and-fade over backdrop blur), the debounced suggestions panel, the feature
  toggle cross-fade, and the attachment chip animate-in.
- **§11 Hall**: masonry stagger reveal, filter-chip re-layout, live-count tick, and the answered seal (which
  does not use the spring).
- **§12 Reduced motion + performance**: the two non-negotiable cards, plus the "one spring, one place per
  screen" cross-reference to the simulator board.

Each signature strip carries a four-line annotation block: trigger · timing and easing token · reduced-motion
fallback · CSS-vs-Motion. Build straight off it.

Proceed to doc 04 for the content library.
