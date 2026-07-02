# Nomba One — Website Plan · 03 · Motion & "Alive"

> Depends on docs 00–02. The site must feel alive — subtle movement, smooth flow — without feeling busy or "AI-generated." Motion is tokenised in the design system; this doc says where and how to spend it. The governing rule: **every animation must earn its place by teaching or guiding.** Decoration that does neither gets cut.

---

## 1. Principles

- **Alive, not busy.** Ambient motion is slow and low-amplitude; interactive motion is quick and precise. If two things move at once for no reason, remove one.
- **One physical language.** Everything uses the design system's three easing curves and four durations — nothing hand-rolls a bezier. `--ease-out` for entrances and most UI, `--ease-in-out` for looping ambient, `--ease-spring` for the rare playful accent (the recovery pop).
- **Orchestrate the peaks, keep the rest quiet.** A few staged moments (hero load, the simulator recovery) land harder than motion sprinkled everywhere. Spend boldness in one place per screen.
- **Motion serves meaning.** A reveal directs attention to new content; a hover confirms interactivity; the lifecycle line encodes sequence; the recovery pop marks the emotional peak. None is there just to move.
- **Never hijack scroll.** Native scroll only. No smooth-scroll libraries that fight the browser — they cost accessibility and performance. Reveal-on-enter, not scroll-jacking.

## 2. Token reference (from the design system)

- Durations: `--dur-fast 120ms` · `--dur-base 200ms` · `--dur-slow 320ms` · `--dur-slower 520ms`
- Easing: `--ease-out` (entrances/UI) · `--ease-in-out` (ambient loops) · `--ease-spring` (accent pop)
- Named patterns already defined: `fade-up`, `scale-in`, `pulse` (live), `float` (ambient).

## 3. The motion catalog

### 3.1 Ambient (always-on, low-key)
- **Hero glow.** A slow, barely-moving emerald vignette/glow behind the hero headline — the Vercel-glow analog, dialed down. Very low opacity, long period, no harsh edges. This is the single largest "alive" signal; keep it tasteful.
- **Live dots.** The webhook ticker dot and any "operational" status dot use `pulse` (~1.6–1.8s).
- **Ticker.** The hero webhook ticker updates every few seconds (real or realistic), with a quick fade between lines.
- Ambient motion pauses when off-screen and respects reduced-motion.

### 3.2 Entrance / reveal (on load + on scroll)
- **Hero load sequence.** A short, orchestrated entrance: eyebrow → headline → subcopy → CTAs → code block, each `fade-up` staggered ~60–80ms, `--dur-slower`, `--ease-out`. One considered moment, not a cascade of everything on the page.
- **Section reveals.** Each major section fades up as it enters the viewport (IntersectionObserver, threshold ~0.1), once. Multi-item groups (the DIY columns, use-case cards, hard-parts cards) stagger their children.
- **The lifecycle progress line.** As the visitor scrolls through the five lifecycle stages, a vertical/horizontal accent line *draws* to track progress, and each stage reveals on enter — encoding the sequence through motion.

### 3.3 Hover / micro-interactions
- **Buttons:** `--dur-fast` background/border transition; `scale(0.975)` on active. Focus ring via the token.
- **Links:** the underline-grows-from-left (already in the design system).
- **Cards** (use-cases, hard-parts): a restrained lift — border brightens to `--border-strong`, a whisper of `--shadow-sm`, ~`--dur-base`. No big translate or rotate.
- **Code block copy:** button confirms with a quick label swap ("Copy" → "Copied") + toast.
- **Tabs** (language/framework switcher): the active underline slides between tabs (`--dur-base`, `--ease-out`).

### 3.4 The simulator (the peak)
Per doc 02 §7: timeline pills transition through states; the active pill pulses; webhook lines stream with a quick fade/slide; the **recovery moment** gets the one `--ease-spring` scale-in on the recovered pill and the emerald `payment_recovered` line. This is the deliberate emotional peak — the only place a little extra is justified.

### 3.5 Page transitions
- Keep them subtle: a quick cross-fade / short fade-up on route change (`--dur-base`). Nothing elaborate; infra sites feel fast, and heavy page transitions read as slow.

### 3.6 Theme toggle (if shipped)
- The token remap transitions smoothly (background/border/color over `--dur-slow`) — the same satisfying flip the design-system file demonstrates.

## 4. Per-section mapping (home)

| Section (doc 01) | Motion |
|---|---|
| 3.1 Hero | ambient glow + ticker; orchestrated load sequence |
| 3.2 DIY question | staggered column reveal on scroll |
| 3.3 Simulator | full simulator motion (doc 02 §7) |
| 3.4 Lifecycle | drawing progress line + per-stage reveal |
| 3.5 Rails/DX | tab underline slide; code fade on switch |
| 3.6 Hard parts | staggered card reveal; card hover-lift |
| 3.7 Platforms | single diagram reveal |
| 3.8 Trust band | items fade up in a quick stagger; status dot pulse |
| 3.9 Use cases | staggered card reveal; hover-lift |
| 3.10 Final CTA | gentle fade-up; install line has a copy micro-interaction |

## 5. Tech approach

- **Motion (framer-motion)** for orchestrated reveals, staggers, the lifecycle line, and the simulator. Use `whileInView` with `viewport={{ once: true }}` for reveals.
- **CSS** for ambient loops (glow, pulse, float), hovers, and simple transitions — cheaper and jank-free.
- **IntersectionObserver** (or Motion's in-view) drives reveals; ambient loops pause off-screen.
- Everything keys off the CSS custom-property durations/easings so motion stays consistent with the design system and adjustable in one place.

## 6. Reduced motion (mandatory)

- Under `prefers-reduced-motion: reduce`: disable ambient loops and the hero glow's movement (a static tint is fine), replace reveals with instant appearance (no translate), and strip the simulator flourishes while keeping all state changes and logic. The site must be fully usable and legible with zero motion. The design-system file already models the media-query approach — mirror it.

## 7. Performance budget for motion

- Animate only `transform` and `opacity` — never layout properties (width/height/top/left) in loops or reveals.
- Ambient effects must not run the CPU hot: low frequency, GPU-friendly, paused off-screen.
- The hero must reach LCP without waiting on animation JS — the glow and ticker enhance, they don't gate first paint. Simulator and Motion bundles lazy-load.
- Target: motion never pushes the site off its performance floor (doc 00 §11). If a nice effect costs the LCP target, the effect loses.

Proceed to doc 04 for the content library.
