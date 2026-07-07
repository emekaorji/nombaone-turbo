import type { ApiOperation } from "./model";
import { sampleValue } from "./samples";
import { sdkCall, type SdkCall } from "./sdk-map";

/**
 * The SDK snippet engine for the reference. For one operation it emits an
 * idiomatic, copy-runnable call in cURL and all nine SDK languages, generated
 * from the canonical SDK map (`sdk-map.ts`) + the operation's schema-derived
 * sample body. One source, so 75 operations × 10 languages can never drift and
 * every language shows the *same* call. (Manifesto: a buffet, not a menu.)
 */

export const SNIPPET_LANGS = [
  "curl",
  "node",
  "python",
  "go",
  "ruby",
  "php",
  "java",
  "rust",
  "dotnet",
  "elixir",
] as const;
export type SnippetLang = (typeof SNIPPET_LANGS)[number];

export const LANG_LABEL: Record<SnippetLang, string> = {
  curl: "cURL",
  node: "Node.js",
  python: "Python",
  go: "Go",
  ruby: "Ruby",
  php: "PHP",
  java: "Java",
  rust: "Rust",
  dotnet: ".NET",
  elixir: "Elixir",
};

export const LANG_GRAMMAR: Record<SnippetLang, string> = {
  curl: "bash",
  node: "typescript",
  python: "python",
  go: "go",
  ruby: "ruby",
  php: "php",
  java: "java",
  rust: "rust",
  dotnet: "csharp",
  elixir: "elixir",
};

const HOST = "https://sandbox.api.nombaone.xyz";

// --- helpers ----------------------------------------------------------------

function snake(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}
function pascal(s: string): string {
  return s.replace(/(^|[_-])([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
}
/** Singular PascalCase resource for typed param structs, e.g. `customers` → `Customer`. */
function singularPascal(resource: string): string {
  const base = resource.replace(/-/g, "_");
  const singular = base.endsWith("s") ? base.slice(0, -1) : base;
  return pascal(singular);
}

type Body = Record<string, unknown>;

/** The concrete path with sample ids substituted (`/v1/customers/nbo…cus`). */
function samplePath(op: ApiOperation, args: string[]): string {
  let path = op.path;
  op.pathParams.forEach((p, i) => {
    path = path.replace(`{${p.name}}`, args[i] ?? p.name);
  });
  return path;
}

/** Sample id values for the path params, in order. */
function pathArgSamples(op: ApiOperation): string[] {
  return op.pathParams.map((p) => {
    const n = p.name.toLowerCase();
    if (n === "id") return `nbo000000000001${idSuffix(op.resource)}`;
    if (n === "grantid") return "nbo000000000001grn";
    if (n === "deliveryid") return "nbo000000000001dlv";
    return "nbo000000000001";
  });
}
function idSuffix(resource: string): string {
  const map: Record<string, string> = {
    customers: "cus", plans: "pln", prices: "prc", subscriptions: "sub",
    invoices: "inv", coupons: "cpn", mandates: "mnd", settlements: "stl",
    "payment-methods": "pm", webhooks: "whe",
  };
  return map[resource] ?? "";
}

interface Ctx {
  op: ApiOperation;
  call: SdkCall;
  args: string[];
  body?: Body;
}

// --- value rendering (per language) ----------------------------------------

function lit(v: unknown, lang: SnippetLang, indent: string): string {
  if (v === null) return nullLit(lang);
  if (typeof v === "string") return str(v, lang);
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return boolLit(v, lang);
  if (Array.isArray(v)) return `[${v.map((x) => lit(x, lang, indent)).join(", ")}]`;
  if (typeof v === "object") return objLit(v as Body, lang, indent);
  return "null";
}
function str(v: string, lang: SnippetLang): string {
  return lang === "python" || lang === "ruby" || lang === "elixir" ? `"${v}"` : `"${v}"`;
}
function boolLit(v: boolean, lang: SnippetLang): string {
  if (lang === "python") return v ? "True" : "False";
  return v ? "true" : "false";
}
function nullLit(lang: SnippetLang): string {
  if (lang === "python") return "None";
  if (lang === "ruby") return "nil";
  if (lang === "elixir") return "nil";
  if (lang === "php") return "null";
  return "null";
}
/** A nested object literal (e.g. metadata) rendered in each language's map syntax. */
function objLit(obj: Body, lang: SnippetLang, indent: string): string {
  const entries = Object.entries(obj);
  if (entries.length === 0) return emptyObj(lang);
  const inner = indent + "  ";
  const pair = (k: string, v: unknown) => {
    switch (lang) {
      case "python": return `${inner}"${k}": ${lit(v, lang, inner)}`;
      case "ruby": return `${inner}${snake(k)}: ${lit(v, lang, inner)}`;
      case "elixir": return `${inner}${snake(k)}: ${lit(v, lang, inner)}`;
      case "php": return `${inner}"${k}" => ${lit(v, lang, inner)}`;
      default: return `${inner}${k}: ${lit(v, lang, inner)}`;
    }
  };
  const open = lang === "php" ? "[" : lang === "elixir" ? "%{" : "{";
  const close = lang === "php" ? "]" : "}";
  return `${open}\n${entries.map(([k, v]) => pair(k, v)).join(",\n")}\n${indent}${close}`;
}
function emptyObj(lang: SnippetLang): string {
  if (lang === "php") return "[]";
  if (lang === "elixir") return "%{}";
  return "{}";
}

// --- body as keyword/param args --------------------------------------------

/** Render the body as this language's argument form (kwargs, object, array…). */
function bodyArg(body: Body, lang: SnippetLang, indent = "  "): string {
  const entries = Object.entries(body);
  const line = (k: string, v: unknown): string => {
    switch (lang) {
      case "node": return `${indent}${k}: ${lit(v, lang, indent)},`;
      case "python": return `${indent}${snake(k)}=${lit(v, lang, indent)},`;
      case "ruby": return `${indent}${snake(k)}: ${lit(v, lang, indent)},`;
      case "php": return `${indent}"${k}" => ${lit(v, lang, indent)},`;
      case "elixir": return `${indent}${snake(k)}: ${lit(v, lang, indent)},`;
      default: return `${indent}${k}: ${lit(v, lang, indent)},`;
    }
  };
  return entries.map(([k, v]) => line(k, v)).join("\n");
}

// --- per-language renderers -------------------------------------------------

function curl(ctx: Ctx): string {
  const { op } = ctx;
  const m = op.method.toUpperCase();
  const url = `${HOST}${samplePath(op, ctx.args)}`;
  const lines = [`curl -X ${m} ${url} \\`, `  -H "Authorization: Bearer $NOMBAONE_API_KEY"`];
  if (ctx.body) {
    lines[lines.length - 1] += " \\";
    lines.push(`  -H "Content-Type: application/json"`);
    if (op.method === "post") {
      lines[lines.length - 1] += " \\";
      lines.push(`  -H "Idempotency-Key: $(uuidgen)"`);
    }
    lines[lines.length - 1] += " \\";
    lines.push(`  -d '${JSON.stringify(ctx.body)}'`);
  }
  return lines.join("\n");
}

function node(ctx: Ctx): string {
  const { call, args, body } = ctx;
  const chain = `nombaone.${call.namespace.join(".")}.${call.method}`;
  const posArgs = args.map((a) => `"${a}"`);
  const call2 = body
    ? `${chain}(${[...posArgs, `{\n${bodyArg(body, "node")}\n}`].join(", ")})`
    : `${chain}(${posArgs.join(", ")})`;
  return [
    `import Nombaone from "@nombaone/node";`,
    ``,
    `const nombaone = new Nombaone(); // reads NOMBAONE_API_KEY`,
    ``,
    `const ${resultVar(ctx)} = await ${call2};`,
  ].join("\n");
}

function python(ctx: Ctx): string {
  const { call, args, body } = ctx;
  const chain = `nombaone.${call.namespace.map(snake).join(".")}.${snake(call.method)}`;
  const pos = args.map((a) => `"${a}"`);
  const invocation = body
    ? `${chain}(\n${[...pos.map((p) => `    ${p},`), bodyArg(body, "python", "    ")].join("\n")}\n)`
    : `${chain}(${pos.join(", ")})`;
  return [
    `from nombaone import Nombaone`,
    ``,
    `nombaone = Nombaone()  # reads NOMBAONE_API_KEY`,
    ``,
    `${snake(resultVar(ctx))} = ${invocation}`,
  ].join("\n");
}

function ruby(ctx: Ctx): string {
  const { call, args, body } = ctx;
  const chain = `nombaone.${call.namespace.map(snake).join(".")}.${snake(call.method)}`;
  const pos = args.map((a) => `"${a}"`);
  const invocation = body
    ? `${chain}(\n${[...pos.map((p) => `  ${p},`), bodyArg(body, "ruby")].join("\n")}\n)`
    : `${chain}(${pos.join(", ")})`;
  return [
    `require "nombaone"`,
    ``,
    `nombaone = Nombaone::Client.new  # reads NOMBAONE_API_KEY`,
    ``,
    `${snake(resultVar(ctx))} = ${invocation}`,
  ].join("\n");
}

function php(ctx: Ctx): string {
  const { call, args, body } = ctx;
  const chain = `$nombaone->${call.namespace.join("->")}->${call.method}`;
  const pos = args.map((a) => `"${a}"`);
  const invocation = body
    ? `${chain}(${[...pos, `[\n${bodyArg(body, "php")}\n]`].join(", ")})`
    : `${chain}(${pos.join(", ")})`;
  return [
    `<?php`,
    `use NombaOne\\Nombaone;`,
    ``,
    `$nombaone = new Nombaone(); // reads NOMBAONE_API_KEY`,
    ``,
    `$${snake(resultVar(ctx))} = ${invocation};`,
  ].join("\n");
}

function elixir(ctx: Ctx): string {
  const { call, args, body } = ctx;
  const chain = `Nombaone.${call.namespace.map((n) => pascal(n)).join(".")}.${snake(call.method)}`;
  const pos = args.map((a) => `"${a}"`);
  const params = body ? [`%{\n${bodyArg(body, "elixir", "  ")}\n}`] : [];
  const invocation = `${chain}(${["client", ...pos, ...params].join(", ")})`;
  return [
    `client = Nombaone.new()  # reads NOMBAONE_API_KEY`,
    ``,
    `{:ok, ${snake(resultVar(ctx))}} = ${invocation}`,
  ].join("\n");
}

function go(ctx: Ctx): string {
  const { op, call, args, body } = ctx;
  const chain = `client.${call.namespace.map(pascal).join(".")}.${pascal(call.method)}`;
  const pos = args.map((a) => `"${a}"`);
  const paramsType = `nombaone.${singularPascal(op.resource)}${pascal(call.method)}Params`;
  const params = body ? [`${paramsType}{\n${goFields(body)}\t}`] : [];
  const invocation = `${chain}(${["ctx", ...pos, ...params].join(", ")})`;
  return [
    `client, _ := nombaone.New() // reads NOMBAONE_API_KEY`,
    ``,
    `${goVar(ctx)}, err := ${invocation}`,
  ].join("\n");
}
function goFields(body: Body): string {
  return Object.entries(body)
    .map(([k, v]) => `\t\t${pascal(k)}: ${lit(v, "go", "\t\t")},`)
    .join("\n") + "\n";
}

function dotnet(ctx: Ctx): string {
  const { op, call, args, body } = ctx;
  const chain = `nombaone.${call.namespace.map(pascal).join(".")}.${pascal(call.method)}Async`;
  const pos = args.map((a) => `"${a}"`);
  const paramsType = `${singularPascal(op.resource)}${pascal(call.method)}Params`;
  const params = body
    ? [`new ${paramsType}\n{\n${csFields(body)}}`]
    : [];
  const invocation = `${chain}(${[...pos, ...params].join(", ")})`;
  return [
    `using NombaOne;`,
    ``,
    `using var nombaone = new Nombaone(); // reads NOMBAONE_API_KEY`,
    ``,
    `var ${resultVar(ctx)} = await ${invocation};`,
  ].join("\n");
}
function csFields(body: Body): string {
  return Object.entries(body)
    .map(([k, v]) => `    ${pascal(k)} = ${lit(v, "dotnet", "    ")},`)
    .join("\n") + "\n";
}

function java(ctx: Ctx): string {
  const { op, call, args, body } = ctx;
  const chain = `nombaone.${call.namespace.map((n) => `${n}()`).join(".")}.${call.method}`;
  const paramsType = `${singularPascal(op.resource)}${pascal(call.method)}Params`;
  const pos = args.map((a) => `"${a}"`);
  const builder = body
    ? `${paramsType}.builder()\n${Object.entries(body)
        .map(([k, v]) => `    .${k}(${lit(v, "java", "    ")})`)
        .join("\n")}\n    .build()`
    : "";
  const params = body ? [builder] : [];
  const invocation = `${chain}(${[...pos, ...params].join(", ")})`;
  return [
    `import xyz.nombaone.Nombaone;`,
    ``,
    `Nombaone nombaone = new Nombaone(); // reads NOMBAONE_API_KEY`,
    ``,
    `var ${resultVar(ctx)} = ${invocation};`,
  ].join("\n");
}

function rust(ctx: Ctx): string {
  const { op, call, args, body } = ctx;
  const chain = `nombaone.${call.namespace.map(snake).join(".")}().${snake(call.method)}`;
  const paramsType = `${singularPascal(op.resource)}${pascal(call.method)}Params`;
  const pos = args.map((a) => `"${a}"`);
  const params = body
    ? [`${paramsType} {\n${Object.entries(body)
        .map(([k, v]) => `        ${snake(k)}: ${typeof v === "string" ? `"${v}".into()` : lit(v, "rust", "        ")},`)
        .join("\n")}\n        ..Default::default()\n    }`]
    : [];
  const invocation = `${chain}(${[...pos, ...params].join(", ")}).await?`;
  return [
    `use nombaone::*;`,
    ``,
    `let nombaone = Nombaone::new()?; // reads NOMBAONE_API_KEY`,
    ``,
    `let ${snake(resultVar(ctx))} = ${invocation};`,
  ].join("\n");
}

// --- result variable naming -------------------------------------------------

function resultVar(ctx: Ctx): string {
  const noun = singularPascal(ctx.op.resource);
  const lc = noun.charAt(0).toLowerCase() + noun.slice(1);
  if (ctx.op.slug === "list") return `${lc}s`;
  return lc || "result";
}
function goVar(ctx: Ctx): string {
  return resultVar(ctx);
}

const RENDERERS: Record<SnippetLang, (ctx: Ctx) => string> = {
  curl, node, python, go, ruby, php, java, rust, dotnet, elixir,
};

/**
 * The body shown in snippets: required scalar fields (string/number/boolean/
 * enum), so every language stays clean and correct. Nested objects (metadata)
 * and arrays are documented in the field table, not the snippet. If nothing is
 * required, show the first couple of scalar fields so the call isn't empty.
 */
function snippetBody(op: ApiOperation): Body | undefined {
  const scalars = op.bodyFields.filter((f) => f.type !== "object" && !f.type.endsWith("[]"));
  let chosen = scalars.filter((f) => f.required);
  if (chosen.length === 0) chosen = scalars.slice(0, 2);
  if (chosen.length === 0) return undefined;
  const body: Body = {};
  for (const f of chosen) body[f.name] = fieldSample(op, f.name, f.schema);
  return body;
}

/** Sample a body field, with a resource-aware `name` (a plan isn't a person). */
function fieldSample(op: ApiOperation, name: string, schema: ApiOperation["bodyFields"][number]["schema"]) {
  if (name === "name") {
    const byResource: Record<string, string> = {
      plans: "Pro",
      coupons: "Launch offer",
      prices: "Pro monthly",
    };
    if (byResource[op.resource]) return byResource[op.resource];
  }
  return sampleValue(schema, name, 1);
}

/** Build every language's snippet for one operation. */
export function buildOperationSnippets(op: ApiOperation): Record<SnippetLang, string> {
  const call = sdkCall(op);
  const ctx: Ctx = { op, call, args: pathArgSamples(op), body: snippetBody(op) };
  const out = {} as Record<SnippetLang, string>;
  for (const lang of SNIPPET_LANGS) out[lang] = RENDERERS[lang](ctx);
  return out;
}
