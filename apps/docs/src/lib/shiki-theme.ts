import type { ThemeRegistrationRaw } from "shiki";

/**
 * Two bespoke Shiki themes keyed off the emerald NOMBAONE.pen palette, one for
 * light and one for dark. `rehype-pretty-code` (in `mdx-pipeline.ts`) emits BOTH
 * and gates them with `[data-theme]` so the active theme follows `next-themes`'
 * `data-theme` attribute.
 *
 * Palette traceability: every colour here is a NOMBAONE.pen token (see
 * `apps/docs/src/app/globals.css` / the website), never invented — the emerald,
 * gray, grn (success), amber, blue (info) and red ramps.
 *
 * Token mapping (deliberately small + legible; a11y-tuned to ~7:1 on --code-bg):
 *   keyword / storage      → emerald  (the brand "verb" colour)
 *   string                 → success green (literal/value)
 *   number / constant      → amber    (numeric accent)
 *   function / class / type → info blue (callables stand out; distinct + accessible)
 *   comment                → muted gray, italic
 *   variable / plain text   → foreground neutral
 *   punctuation / operator → mid gray
 */

const lightColors = {
  bg: "transparent",
  fg: "#383838", // gray-800
  comment: "#717171", // gray-600
  keyword: "#007e57", // emerald-700 (brand verb)
  string: "#0e8c41", // grn-500 (success)
  number: "#df9134", // amber-500
  func: "#0076d3", // blue-500 (info · callables)
  punctuation: "#717171", // gray-600
  variable: "#383838", // gray-800
  property: "#525252", // gray-700
  invalid: "#cc3336", // red-500
} as const;

const darkColors = {
  bg: "transparent",
  fg: "#dedede", // gray-200
  comment: "#8f8f8f", // gray-500
  keyword: "#4ee6af", // emerald-300 (brand verb · ~high contrast on --code-bg)
  string: "#58cd78", // grn-400 (success)
  number: "#f6b84d", // amber-400
  func: "#1899ec", // blue-400 (info · callables)
  punctuation: "#8f8f8f", // gray-500
  variable: "#dedede", // gray-200
  property: "#cacaca", // gray-300
  invalid: "#f14949", // red-400
} as const;

type Palette = Record<keyof typeof lightColors, string>;

function buildTheme(name: string, type: "light" | "dark", c: Palette): ThemeRegistrationRaw {
  return {
    name,
    type,
    colors: {
      "editor.background": c.bg,
      "editor.foreground": c.fg,
    },
    settings: [
      { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: c.comment, fontStyle: "italic" } },
      { scope: ["keyword", "storage", "storage.type", "keyword.control", "keyword.operator.new"], settings: { foreground: c.keyword } },
      { scope: ["string", "string.quoted", "string.template", "constant.character.escape"], settings: { foreground: c.string } },
      { scope: ["constant.numeric", "constant.language", "constant.language.boolean", "support.constant"], settings: { foreground: c.number } },
      { scope: ["entity.name.function", "support.function", "meta.function-call", "entity.name.class", "entity.name.type", "support.class", "support.type"], settings: { foreground: c.func } },
      { scope: ["variable", "variable.other", "variable.parameter", "meta.definition.variable"], settings: { foreground: c.variable } },
      { scope: ["variable.other.property", "support.type.property-name", "meta.object-literal.key", "entity.name.tag"], settings: { foreground: c.property } },
      { scope: ["punctuation", "meta.brace", "keyword.operator"], settings: { foreground: c.punctuation } },
      { scope: ["invalid", "invalid.illegal"], settings: { foreground: c.invalid } },
    ],
  };
}

export const nombaoneLight: ThemeRegistrationRaw = buildTheme("nombaone-light", "light", lightColors);
export const nombaoneDark: ThemeRegistrationRaw = buildTheme("nombaone-dark", "dark", darkColors);
