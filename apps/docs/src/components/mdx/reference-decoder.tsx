"use client";

import { useId, useMemo, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * `<ReferenceDecoder>`: the interactive "aha" for the `nbo{12}{domain}`
 * reference format. Type or paste a reference and it splits it into its three
 * parts (the `nbo` prefix, the 12-digit body, and the domain suffix),
 * highlights each, and names the resource the suffix points at.
 *
 * Accuracy: the format is `nbo` + **12 random digits** + a lowercase domain
 * suffix (`@nombaone/sara/reference` → `mintReference`, `randomDigits(12)`). The
 * suffix→resource map mirrors `ReferenceDomain`.
 *
 * a11y: a single labelled text input drives a `role="status"` live region that
 * announces what was decoded. The coloured segment chips are decorative
 * (`aria-hidden`); the live region carries the meaning for screen readers.
 * No JS animation; the only motion is a Tailwind colour transition, already
 * gated by the global `prefers-reduced-motion` rule in `globals.css`.
 */

const PREFIX = "nbo";

/** The real `ReferenceDomain` map (lowercased suffix → human resource). */
const SUFFIX_MAP: Record<string, string> = {
  org: "Organization",
  usr: "Organization user",
  key: "API key",
  evt: "Domain event",
  whk: "Webhook endpoint",
  whd: "Webhook delivery",
  ltx: "Ledger transaction",
  lac: "Ledger account",
  exa: "Example",
};

const SAMPLES = [
  "nbo749201835566exa",
  "nbo938174026551org",
  "nbo015723869402evt",
  "nbo660318492075ltx",
];

interface Decoded {
  prefix: string;
  body: string;
  suffix: string;
  resource: string | null;
  /** Why the input is not a valid reference (null when it is). */
  problem: string | null;
}

function decode(raw: string): Decoded {
  const value = raw.trim().toLowerCase();
  const prefix = value.slice(0, PREFIX.length);
  const rest = value.slice(PREFIX.length);
  const body = rest.slice(0, 12);
  const suffix = rest.slice(12);
  const resource = SUFFIX_MAP[suffix] ?? null;

  let problem: string | null = null;
  if (value === "") problem = null;
  else if (prefix !== PREFIX) problem = `Every reference starts with "${PREFIX}".`;
  else if (!/^\d{12}$/.test(body)) problem = "The body is exactly 12 digits.";
  else if (suffix === "") problem = "Missing the domain suffix (e.g. exa, org, evt).";
  else if (!resource) problem = `"${suffix}" is not a known domain suffix.`;

  return { prefix, body, suffix, resource, problem };
}

export function ReferenceDecoder({
  defaultValue = SAMPLES[0],
}: {
  defaultValue?: string;
}) {
  const inputId = useId();
  const [value, setValue] = useState(defaultValue);
  const decoded = useMemo(() => decode(value), [value]);

  const valid = value.trim() !== "" && decoded.problem === null && decoded.resource !== null;

  const announcement = (() => {
    if (value.trim() === "") return "Type a reference to decode it.";
    if (decoded.problem) return `Not a valid reference: ${decoded.problem}`;
    return `Decoded: a ${decoded.resource}. Prefix ${decoded.prefix}, body ${decoded.body
      .split("")
      .join(" ")}, suffix ${decoded.suffix}.`;
  })();

  return (
    <div className="not-prose my-6 rounded-xl border border-border bg-card p-5 shadow-sm">
      <label
        htmlFor={inputId}
        className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Decode a reference
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          type="text"
          value={value}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          onChange={(event) => setValue(event.target.value)}
          placeholder="nbo749201835566exa"
          aria-describedby={`${inputId}-out`}
          className={cn(
            "min-w-0 flex-1 rounded-lg border bg-background px-3 py-2.5 font-mono text-sm text-foreground transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value.trim() === ""
              ? "border-border"
              : valid
                ? "border-success-300 dark:border-success-800"
                : "border-error-300 dark:border-error-800",
          )}
        />
      </div>

      {/* The split-out, colour-coded reference, decorative; the live region
          below carries the same information for assistive tech. */}
      <div aria-hidden className="mt-4 overflow-x-auto">
        <div className="inline-flex items-stretch rounded-lg border border-border font-mono text-sm">
          <Segment
            label="prefix"
            text={decoded.prefix || PREFIX}
            tone="prefix"
            faded={value.trim() === ""}
          />
          <Segment
            label="12-digit body"
            text={decoded.body || "············"}
            tone="body"
            faded={value.trim() === "" || decoded.body === ""}
          />
          <Segment
            label="domain"
            text={decoded.suffix || "···"}
            tone="suffix"
            faded={value.trim() === "" || decoded.suffix === ""}
            last
          />
        </div>
      </div>

      <div
        id={`${inputId}-out`}
        role="status"
        aria-live="polite"
        className="mt-4 flex min-h-[2.25rem] items-center gap-2 text-sm"
      >
        {value.trim() === "" ? (
          <span className="text-muted-foreground">Type a reference above.</span>
        ) : valid ? (
          <>
            <span className="inline-flex size-2 rounded-full bg-success-500" />
            <span className="text-foreground">
              This is a{" "}
              <strong className="font-semibold text-success-700 dark:text-success-400">
                {decoded.resource}
              </strong>{" "}
              <span className="text-muted-foreground">
                (suffix <code className="font-mono">{decoded.suffix}</code>).
              </span>
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex size-2 rounded-full bg-error-500" />
            <span className="text-muted-foreground">{decoded.problem}</span>
          </>
        )}
        <span className="sr-only">{announcement}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">Try:</span>
        {SAMPLES.map((sample) => (
          <button
            key={sample}
            type="button"
            onClick={() => setValue(sample)}
            className="rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-purple-300 hover:text-foreground dark:hover:border-purple-700"
          >
            …{sample.slice(-3)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Segment({
  label,
  text,
  tone,
  faded,
  last,
}: {
  label: string;
  text: string;
  tone: "prefix" | "body" | "suffix";
  faded: boolean;
  last?: boolean;
}) {
  const tones: Record<typeof tone, string> = {
    prefix: "bg-muted text-muted-foreground",
    body: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    suffix: "bg-magenta-100 text-magenta-700 dark:bg-magenta-900 dark:text-magenta-100",
  };
  return (
    <div
      className={cn(
        "flex flex-col px-3 py-2 transition-opacity",
        !last && "border-r border-border",
        faded ? "opacity-40" : "opacity-100",
      )}
    >
      <span className="whitespace-pre font-semibold tracking-tight">{text}</span>
      <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      <span className={cn("mt-1 h-0.5 rounded-full", tones[tone])} />
    </div>
  );
}
