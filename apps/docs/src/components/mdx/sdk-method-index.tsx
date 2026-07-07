import Link from "next/link";

import { getApiResources } from "@/lib/api-ref/model";
import { sdkCall } from "@/lib/api-ref/sdk-map";
import { getSdk, type SdkId } from "@/lib/sdks/registry";

/**
 * The generated, drift-proof method index for one SDK: every operation the API
 * serves, grouped by namespace, in that language's method casing, each linking
 * to the full `/reference/<resource>/<op>` page (which carries the copy-runnable
 * sample in all ten languages). Built from the same OpenAPI model as the
 * reference (`getApiResources()` + `sdkCall()`), so it can never miss a method
 * the API adds — `check:sdks` proves coverage. Pure server component.
 *
 * The method *names* come from the shared `sdkCall` map (correct by
 * construction); only the *casing* is applied per language here (a deterministic
 * transform), so nothing is invented.
 *
 * Usage in MDX: `<SdkMethodIndex lang="node" />`.
 */

const METHOD_COLOR: Record<string, string> = {
  get: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  post: "text-[--accent] border-[--accent]/30 bg-[--accent]/10",
  patch: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  put: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  delete: "text-red-400 border-red-400/30 bg-red-400/10",
};

/** camelCase → snake_case (Python, Ruby, Rust, Elixir). */
function toSnake(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/** camelCase → PascalCase (Go, .NET). */
function toPascal(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type CaseStyle = "camel" | "snake" | "pascal";

const LANG_CASE: Record<SdkId, CaseStyle> = {
  node: "camel",
  java: "camel",
  php: "camel",
  python: "snake",
  ruby: "snake",
  rust: "snake",
  elixir: "snake",
  go: "pascal",
  dotnet: "pascal",
};

function applyCase(name: string, style: CaseStyle): string {
  if (style === "snake") return toSnake(name);
  if (style === "pascal") return toPascal(name);
  return name;
}

/** `paymentMethods.setDefault` in the SDK's casing, e.g. `payment_methods.set_default`. */
function signature(namespace: string[], method: string, style: CaseStyle): string {
  return [...namespace.map((n) => applyCase(n, style)), applyCase(method, style)].join(".");
}

export function SdkMethodIndex({ lang }: { lang: SdkId }) {
  const sdk = getSdk(lang);
  const style = LANG_CASE[lang];
  const resources = getApiResources();

  return (
    <div className="not-prose my-8 space-y-6">
      {resources.map((resource) => (
        <section key={resource.slug}>
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">
            {resource.title}
          </h3>
          <ul className="mt-2 divide-y divide-border/60 rounded-lg border border-border">
            {resource.operations.map((op) => {
              const call = sdkCall(op);
              return (
                <li key={op.slug}>
                  <Link
                    href={`/reference/${resource.slug}/${op.slug}`}
                    className="flex flex-wrap items-center gap-2 px-4 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <span
                      className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${METHOD_COLOR[op.method] ?? ""}`}
                    >
                      {op.method}
                    </span>
                    <code className="font-mono text-[13px] text-foreground">
                      {signature(call.namespace, call.method, style)}
                    </code>
                    <span className="ml-auto text-[13px] text-muted-foreground">{op.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="text-[13px] text-muted-foreground">
        Every method in <code className="font-mono text-foreground/90">{sdk.package}</code>, grouped
        by namespace. Open any method for the full request, response, and a ready-to-run{" "}
        {sdk.label} sample.
      </p>
    </div>
  );
}
