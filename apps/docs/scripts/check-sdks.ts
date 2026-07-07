/**
 * SDK-docs honesty gate. The `/sdks/*` section documents the nine shipped SDKs
 * whose identity facts live in one place (`src/lib/sdks/registry.ts`) and whose
 * method index is generated from the OpenAPI model. This proves the docs can't
 * drift:
 *
 *   1. Coverage — every SDK in the registry has a guide + a reference page, and
 *      the `/sdks` overview exists and renders the parity matrix.
 *   2. Component integrity — every guide renders `<SdkHeader id="<id>" />`, every
 *      reference renders `<SdkMethodIndex lang="<id>" />`, and every referenced
 *      SDK id is a real registry id (so package names and versions stay single-
 *      sourced through the components and are never retyped into prose).
 *   3. Env-var honesty — every SDK guide reads `NOMBAONE_API_KEY`, and no page in
 *      the section mentions `NOMBAONE_SECRET_KEY`.
 *
 * Run via `pnpm -F @nombaone/docs check:sdks`; wired into the build gate.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { SDKS } from "../src/lib/sdks/registry";

const CONTENT = path.join(process.cwd(), "content");
const SDK_DIR = path.join(CONTENT, "sdks");
const VALID_IDS = new Set<string>(SDKS.map((s) => s.id));

async function read(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function listMdx(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listMdx(full)));
    else if (entry.name.endsWith(".mdx")) out.push(full);
  }
  return out;
}

async function main() {
  const problems: string[] = [];

  // 1. Overview + parity matrix.
  const overview = await read(path.join(CONTENT, "sdks.mdx"));
  if (overview === null) {
    problems.push("coverage: content/sdks.mdx (the /sdks overview) is missing");
  } else if (!overview.includes("<SdkParityMatrix")) {
    problems.push("content/sdks.mdx: missing <SdkParityMatrix />");
  }

  // 1 + 2. Per-SDK coverage, component integrity, and the env-var positive check.
  for (const sdk of SDKS) {
    const guide = await read(path.join(SDK_DIR, `${sdk.id}.mdx`));
    const ref = await read(path.join(SDK_DIR, sdk.id, "reference.mdx"));

    if (guide === null) {
      problems.push(`coverage: content/sdks/${sdk.id}.mdx is missing`);
    } else {
      if (!guide.includes(`<SdkHeader id="${sdk.id}"`)) {
        problems.push(`content/sdks/${sdk.id}.mdx: missing <SdkHeader id="${sdk.id}" />`);
      }
      if (!guide.includes("NOMBAONE_API_KEY")) {
        problems.push(`content/sdks/${sdk.id}.mdx: never reads NOMBAONE_API_KEY`);
      }
    }

    if (ref === null) {
      problems.push(`coverage: content/sdks/${sdk.id}/reference.mdx is missing`);
    } else if (!ref.includes(`<SdkMethodIndex lang="${sdk.id}"`)) {
      problems.push(`content/sdks/${sdk.id}/reference.mdx: missing <SdkMethodIndex lang="${sdk.id}" />`);
    }
  }

  // 3. Env-var honesty + component-id validity across the whole section.
  const files = await listMdx(SDK_DIR);
  if (overview !== null) files.push(path.join(CONTENT, "sdks.mdx"));
  for (const file of files) {
    const body = await read(file);
    if (body === null) continue;
    const rel = path.relative(CONTENT, file);
    if (body.includes("NOMBAONE_SECRET_KEY")) {
      problems.push(`${rel}: uses NOMBAONE_SECRET_KEY (every SDK reads NOMBAONE_API_KEY)`);
    }
    for (const m of body.matchAll(/<Sdk(?:Header id|MethodIndex lang)="([^"]+)"/g)) {
      if (!VALID_IDS.has(m[1]!)) problems.push(`${rel}: unknown SDK id "${m[1]}"`);
    }
  }

  if (problems.length > 0) {
    console.error(`\n[check-sdks] ${problems.length} problem(s):`);
    for (const p of problems) console.error("  ✗ " + p);
    console.error("");
    process.exit(1);
  }

  console.log(
    `[check-sdks] OK — ${SDKS.length} SDKs, each with a guide + generated reference; ` +
      `identity facts single-sourced from registry.ts`,
  );
}

main().catch((err) => {
  console.error("[check-sdks] failed:", err);
  process.exit(1);
});
