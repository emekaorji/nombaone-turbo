import type { ThemeRegistrationRaw } from "shiki";

/**
 * Two bespoke Shiki themes keyed off the Nombaone palette (purple keywords, the
 * neutral ramp), one for light and one for dark. `rehype-pretty-code` is
 * configured (in `mdx-pipeline.ts`) to emit BOTH and gate them with
 * `[data-theme]` so the active theme follows `next-themes`' `.dark` class.
 *
 * Palette traceability: every colour here is a value already in
 * `packages/ui/src/globals.css` (the canonical token file), never invented:
 *   purple-{700,500,400,300,200}, magenta-700/400, yellow-700/400,
 *   success-600/400, neutral ramp, error-600/400.
 *
 * Token mapping (kept deliberately small + legible):
 *   keyword / storage      → purple   (the brand "verb" colour)
 *   string                 → success  (green reads as "literal/value")
 *   number / constant      → yellow   (numeric accent)
 *   function / class        → magenta  (callables stand out)
 *   comment                → muted neutral, italic
 *   variable / plain text   → foreground neutral
 *   punctuation / operator → mid neutral
 */

const lightColors = {
  bg: "transparent",
  fg: "#34363c", // neutral-700
  comment: "#a1a3a8", // neutral-400
  keyword: "#4f4381", // purple-700
  string: "#15803d", // success-700
  number: "#a17e1c", // yellow-700
  func: "#9f727d", // magenta-700
  punctuation: "#696c74", // neutral-500
  variable: "#34363c", // neutral-700
  property: "#5b4e98", // purple-600
  invalid: "#b91c1c", // error-700
} as const;

const darkColors = {
  bg: "transparent",
  fg: "#cbccd0", // neutral-300
  comment: "#696c74", // neutral-500
  keyword: "#9685d5", // purple-300
  string: "#4ade80", // success-400
  number: "#fbc416", // yellow-400
  func: "#f9b0c3", // magenta-400
  punctuation: "#a1a3a8", // neutral-400
  variable: "#cbccd0", // neutral-300
  property: "#7665c8", // purple-400
  invalid: "#f87171", // error-400
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
