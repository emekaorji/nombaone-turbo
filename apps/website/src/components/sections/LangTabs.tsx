"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

// Hand-tokenized code so the syntax colours match the .pen exactly (hMB5C):
// keywords = emerald, strings = gray, everything else = white.
type Seg = { t: string; c?: "kw" | "str" };
type Line = Seg[] | null; // null = blank spacer line (.pen "Blank" height 8)

const kw = (t: string): Seg => ({ t, c: "kw" });
const str = (t: string): Seg => ({ t, c: "str" });
const w = (t: string): Seg => ({ t });

const TABS: { label: string; lines: Line[] }[] = [
  {
    label: "Next.js",
    lines: [
      [kw("import "), w("{ Nomba } "), kw("from "), str("'nomba-one';")],
      [kw("const "), w("nomba = "), kw("new "), w("Nomba(process.env.NOMBA_KEY);")],
      null,
      [kw("export async function "), w("subscribe(customer) {")],
      [kw("  return "), w("nomba.subscriptions.create({")],
      [w("    customer,")],
      [w("    plan: "), str("'plan_pro',")],
      [w("    rail: "), str("'auto',")],
      [w("  });")],
      [w("}")],
    ],
  },
  {
    label: "Laravel",
    lines: [
      [kw("use "), w("NombaOne\\Nomba;")],
      [w("$nomba = "), kw("new "), w("Nomba(env("), str("'NOMBA_KEY'"), w("));")],
      null,
      [w("$nomba->subscriptions->create([")],
      [str("    'customer' "), w("=> $customer,")],
      [str("    'plan' "), w("=> "), str("'plan_pro',")],
      [str("    'rail' "), w("=> "), str("'auto',")],
      [w("]);")],
    ],
  },
  {
    label: "Django",
    lines: [
      [kw("from "), w("nomba_one "), kw("import "), w("Nomba")],
      [w("nomba = Nomba(os.environ["), str("'NOMBA_KEY'"), w("])")],
      null,
      [kw("def "), w("subscribe(customer):")],
      [kw("    return "), w("nomba.subscriptions.create(")],
      [w("        customer=customer,")],
      [w("        plan="), str("'plan_pro',")],
      [w("        rail="), str("'auto',")],
      [w("    )")],
    ],
  },
  {
    label: "Express",
    lines: [
      [kw("const "), w("{ Nomba } = "), kw("require("), str("'nomba-one'"), w(");")],
      [kw("const "), w("nomba = "), kw("new "), w("Nomba(process.env.NOMBA_KEY);")],
      null,
      [w("app.post("), str("'/subscribe'"), w(", "), kw("async "), w("(req, res) => {")],
      [kw("  await "), w("nomba.subscriptions.create({")],
      [w("    customer: req.body.customer,")],
      [w("    plan: "), str("'plan_pro',")],
      [w("    rail: "), str("'auto',")],
      [w("  });")],
      [w("});")],
    ],
  },
];

function segColor(c?: "kw" | "str") {
  if (c === "kw") return "text-accent";
  if (c === "str") return "text-muted-foreground";
  return "text-foreground";
}

/** Framework switcher over a syntax-coloured sample (.pen hMB5C). */
export function LangTabs({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  const tab = TABS[active]!;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[14px] border border-border bg-surface-1",
        className
      )}
    >
      {/* Tab bar: padding [8,8,0,8], bottom border */}
      <div className="flex gap-0.5 border-b border-border px-2 pt-2">
        {TABS.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "px-3 py-2 font-mono text-[12.5px] transition-colors",
              i === active
                ? "border-b-2 border-accent text-foreground"
                : "text-subtle-foreground hover:text-muted-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Code body: padding [18,20], line gap 6; scrolls on narrow screens */}
      <div className="flex flex-col gap-1.5 overflow-x-auto px-5 py-[18px] font-mono text-[13px] leading-[1.35]">
        {tab.lines.map((line, i) =>
          line === null ? (
            <div key={i} className="h-2" aria-hidden />
          ) : (
            <div key={i} className="whitespace-pre">
              {line.map((seg, j) => (
                <span key={j} className={segColor(seg.c)}>
                  {seg.t}
                </span>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
