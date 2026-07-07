import Link from "next/link";

import { SDKS } from "@/lib/sdks/registry";

/**
 * The `/sdks` parity matrix: every official SDK side by side — package, version,
 * language floor, and install — rendered from `registry.ts` so the facts here
 * can never drift from the per-SDK pages. Pure server component.
 *
 * Usage in MDX: `<SdkParityMatrix />`.
 */
export function SdkParityMatrix() {
  return (
    <div className="not-prose my-8 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/60">
          <tr>
            {["SDK", "Package", "Version", "Requires", "Install"].map((h) => (
              <th
                key={h}
                className="border-b border-border px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SDKS.map((sdk) => (
            <tr key={sdk.id} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-3 align-top">
                <Link
                  href={`/sdks/${sdk.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:text-accent hover:underline"
                >
                  {sdk.label}
                </Link>
                <div className="mt-0.5 text-xs text-muted-foreground">{sdk.language}</div>
              </td>
              <td className="px-4 py-3 align-top">
                <a
                  href={sdk.registryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[13px] text-foreground underline-offset-4 hover:text-accent hover:underline"
                >
                  {sdk.package}
                </a>
                <div className="mt-0.5 text-xs text-muted-foreground">{sdk.registry}</div>
              </td>
              <td className="px-4 py-3 align-top">
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                  {sdk.version}
                </code>
              </td>
              <td className="px-4 py-3 align-top text-[13px] text-muted-foreground">
                {sdk.languageFloor}
              </td>
              <td className="px-4 py-3 align-top">
                <code className="font-mono text-[12.5px] text-foreground/85">{sdk.install}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
