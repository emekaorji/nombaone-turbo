import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/primitives/PageHeader";

export const metadata = { title: "Changelog" };

const ENTRIES: { date: string; version: string; title: string; body: string }[] = [
  {
    date: "Jul 2, 2026",
    version: "v0.14",
    title: "Card OTP → checkout-link dunning fallback",
    body: "When a bank forces 3-D Secure on a recurring card charge, dunning now emits invoice.action_required with a one-tap checkout link, and the customer's completion settles the same invoice.",
  },
  {
    date: "Jul 1, 2026",
    version: "v0.13",
    title: "Settlement, refunds, and payouts",
    body: "Sub-account split settlement at collection, out-of-window refunds, and tenant payouts, all behind the rail adapter.",
  },
  {
    date: "Jul 1, 2026",
    version: "v0.12",
    title: "Mandate activation sweep",
    body: "NIBSS direct-debit mandates now promote to active automatically through a background sweep, since activation has no webhook.",
  },
  {
    date: "Jun 30, 2026",
    version: "v0.11",
    title: "Byte-confirmed Nomba webhooks",
    body: "Inbound webhooks are verified over the exact header-timestamp signature and re-queried by transaction id before any money moves.",
  },
  {
    date: "Jun 30, 2026",
    version: "v0.10",
    title: "Kobo and naira at the boundary",
    body: "Amounts convert to naira at the Nomba edge and stay integer kobo everywhere inside, so nothing is ever off by a factor of a hundred.",
  },
];

export default function ChangelogPage() {
  return (
    <>
      <PageHeader
        title="Shipping, in the open."
        deck="Every meaningful change, dated and plainly written. Proof the thing is alive and moving."
      />

      <Container className="pb-[88px] pt-6">
        <div className="flex flex-col">
          {ENTRIES.map((e) => (
            <article
              key={e.version}
              className="flex flex-col gap-4 border-t border-border py-6 sm:flex-row sm:gap-8"
            >
              <div className="flex w-[140px] shrink-0 flex-col gap-2">
                <span className="font-mono text-[12px] text-subtle-foreground">{e.date}</span>
                <span className="w-fit rounded-full border border-accent-border bg-accent-muted px-[9px] py-[3px] font-mono text-[11px] text-accent">
                  {e.version}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <h2 className="text-[16px] font-semibold text-foreground">{e.title}</h2>
                <p className="text-[13.5px] leading-[1.55] text-muted-foreground">{e.body}</p>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </>
  );
}
