import Link from "next/link";

import { getSdk, type SdkId } from "@/lib/sdks/registry";

/**
 * The identity card at the top of every `/sdks/<id>` page: package, version,
 * language floor, client class, and the shape of the library — all from
 * `registry.ts`, so a fact is written once. Pure server component.
 *
 * Usage in MDX: `<SdkHeader id="node" />`. Put the copy-runnable install command
 * in a fenced ```bash block right after (the code block carries the copy button).
 */
export function SdkHeader({ id }: { id: SdkId }) {
  const sdk = getSdk(id);
  const facts: [string, string][] = [
    ["Requires", sdk.languageFloor],
    ["Client", sdk.clientClass],
    ["Runtime", sdk.async],
    ["Errors", sdk.errorModel],
  ];

  return (
    <div className="not-prose my-8 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <a
          href={sdk.registryUrl}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[15px] font-medium text-foreground underline-offset-4 hover:text-accent hover:underline"
        >
          {sdk.package}
        </a>
        <span className="rounded-full bg-accent-muted px-2 py-0.5 font-mono text-xs font-semibold text-accent">
          v{sdk.version}
        </span>
        <span className="text-xs text-muted-foreground">{sdk.registry}</span>
        <Link
          href={`/sdks/${sdk.id}/reference`}
          className="ml-auto text-[13px] font-medium text-accent underline-offset-4 hover:underline"
        >
          Method reference →
        </Link>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-0.5 font-mono text-[13px] text-foreground/85">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
