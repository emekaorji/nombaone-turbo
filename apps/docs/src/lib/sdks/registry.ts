/**
 * The single source of truth for the nine official Nomba One SDKs' identity
 * facts — package name, registry, version, language floor, install command,
 * client class, and the shape of each library's async/error/webhook surface.
 *
 * Every SDK page header (`<SdkHeader>`), the `/sdks` parity matrix
 * (`<SdkParityMatrix>`), and the `check:sdks` honesty gate read from here, so a
 * package name or version is written down exactly once and can never drift
 * across the ~20 SDK pages. When an SDK releases, bump the `version` here and
 * nowhere else.
 *
 * Facts are lifted from the shipped SDK repos (the SSOT, `../nombaone-<id>/`)
 * and their briefs (`workbench/sdks/<id>.md`). Naming is always `nombaone`,
 * never `nomba`; every SDK reads its key from `NOMBAONE_API_KEY` and derives the
 * host from the key prefix (`nbo_sandbox_…` → sandbox, `nbo_live_…` → live).
 */

export type SdkId =
  | "node"
  | "python"
  | "go"
  | "php"
  | "ruby"
  | "java"
  | "dotnet"
  | "rust"
  | "elixir";

export interface SdkMeta {
  /** URL segment + registry key, e.g. `node` → `/sdks/node`. */
  id: SdkId;
  /** Nav + card title, e.g. "Node.js & TypeScript". */
  label: string;
  /** The language(s) this SDK serves, for the matrix, e.g. "TypeScript · JavaScript". */
  language: string;
  /** The published package name. */
  package: string;
  /** Registry display name, e.g. "npm", "PyPI". */
  registry: string;
  /** Canonical package page. */
  registryUrl: string;
  /** Published semver. Bump here and nowhere else. */
  version: string;
  /** Minimum language/runtime, e.g. "Node.js 22+". */
  languageFloor: string;
  /** Copy-paste install command (or dependency line for Maven/Elixir). */
  install: string;
  /** The client type a developer instantiates. */
  clientClass: string;
  /** How the SDK runs: sync, async, both, or a language wrinkle. */
  async: string;
  /** How errors surface in that language. */
  errorModel: string;
  /** The webhook-verification helper's entry point. */
  webhookHelper: string;
}

/**
 * Ordered for the parity matrix and the "pick your language" grid. The Node SDK
 * leads (it is the reference implementation every other SDK mirrors).
 */
export const SDKS: SdkMeta[] = [
  {
    id: "node",
    label: "Node.js & TypeScript",
    language: "TypeScript · JavaScript",
    package: "@nombaone/node",
    registry: "npm",
    registryUrl: "https://www.npmjs.com/package/@nombaone/node",
    version: "0.1.3",
    languageFloor: "Node.js 22+",
    install: "npm install @nombaone/node",
    clientClass: "Nombaone",
    async: "Promises / async–await",
    errorModel: "Typed exception hierarchy",
    webhookHelper: "webhooks.constructEvent",
  },
  {
    id: "python",
    label: "Python",
    language: "Python",
    package: "nombaone",
    registry: "PyPI",
    registryUrl: "https://pypi.org/project/nombaone/",
    version: "0.1.0",
    languageFloor: "Python 3.9+",
    install: "pip install nombaone",
    clientClass: "Nombaone · AsyncNombaone",
    async: "Sync + async",
    errorModel: "Exceptions",
    webhookHelper: "webhooks.construct_event",
  },
  {
    id: "go",
    label: "Go",
    language: "Go",
    package: "github.com/nombaone/nombaone-go",
    registry: "Go modules",
    registryUrl: "https://pkg.go.dev/github.com/nombaone/nombaone-go",
    version: "0.1.0",
    languageFloor: "Go 1.23+",
    install: "go get github.com/nombaone/nombaone-go",
    clientClass: "nombaone.Client",
    async: "Sync · context.Context",
    errorModel: "Typed error returns (errors.As)",
    webhookHelper: "webhook.ConstructEvent",
  },
  {
    id: "php",
    label: "PHP",
    language: "PHP",
    package: "nombaone/nombaone-php",
    registry: "Packagist",
    registryUrl: "https://packagist.org/packages/nombaone/nombaone-php",
    version: "0.1.2",
    languageFloor: "PHP 8.2+",
    install: "composer require nombaone/nombaone-php",
    clientClass: "NombaOne\\Nombaone",
    async: "Synchronous",
    errorModel: "Typed exceptions (code = $errorCode)",
    webhookHelper: "Webhooks::constructEvent",
  },
  {
    id: "ruby",
    label: "Ruby",
    language: "Ruby",
    package: "nombaone",
    registry: "RubyGems",
    registryUrl: "https://rubygems.org/gems/nombaone",
    version: "0.1.0",
    languageFloor: "Ruby 3.1+",
    install: "gem install nombaone",
    clientClass: "Nombaone::Client",
    async: "Synchronous",
    errorModel: "Raised, typed (Nombaone::Error)",
    webhookHelper: "Nombaone.webhooks",
  },
  {
    id: "java",
    label: "Java",
    language: "Java · Kotlin",
    package: "xyz.nombaone:nombaone",
    registry: "Maven Central",
    registryUrl: "https://central.sonatype.com/artifact/xyz.nombaone/nombaone",
    version: "0.1.0",
    languageFloor: "Java 17+",
    install: 'implementation("xyz.nombaone:nombaone:0.1.0")',
    clientClass: "xyz.nombaone.Nombaone",
    async: "Synchronous",
    errorModel: "Unchecked exceptions",
    webhookHelper: "webhooks()",
  },
  {
    id: "dotnet",
    label: ".NET",
    language: "C# · .NET",
    package: "NombaOne",
    registry: "NuGet",
    registryUrl: "https://www.nuget.org/packages/NombaOne",
    version: "0.1.0",
    languageFloor: ".NET 8 · netstandard2.0",
    install: "dotnet add package NombaOne",
    clientClass: "Nombaone",
    async: "Async (Task)",
    errorModel: "Exceptions (NombaoneException)",
    webhookHelper: "WebhookVerifier",
  },
  {
    id: "rust",
    label: "Rust",
    language: "Rust",
    package: "nombaone",
    registry: "crates.io",
    registryUrl: "https://crates.io/crates/nombaone",
    version: "0.1.1",
    languageFloor: "Rust 1.85+",
    install: "cargo add nombaone",
    clientClass: "Nombaone",
    async: "Async (tokio) + blocking",
    errorModel: "Result<T, nombaone::Error>",
    webhookHelper: "nombaone::webhooks",
  },
  {
    id: "elixir",
    label: "Elixir",
    language: "Elixir",
    package: "nombaone",
    registry: "Hex",
    registryUrl: "https://hex.pm/packages/nombaone",
    version: "0.1.0",
    languageFloor: "Elixir 1.15+ · OTP 25+",
    install: '{:nombaone, "~> 0.1.0"}',
    clientClass: "Nombaone.Client",
    async: "Sync · functional",
    errorModel: "{:ok, _} / {:error, _} + ! raisers",
    webhookHelper: "Nombaone.Webhooks",
  },
];

/** Look up one SDK's metadata by id (throws on an unknown id — misuse is a build error). */
export function getSdk(id: SdkId): SdkMeta {
  const sdk = SDKS.find((s) => s.id === id);
  if (!sdk) throw new Error(`Unknown SDK id: ${id}`);
  return sdk;
}

/** The `SNIPPET_LANGS` key used by the generated reference for each SDK. */
export const SDK_SNIPPET_LANG: Record<SdkId, string> = {
  node: "node",
  python: "python",
  go: "go",
  php: "php",
  ruby: "ruby",
  java: "java",
  dotnet: "dotnet",
  rust: "rust",
  elixir: "elixir",
};
