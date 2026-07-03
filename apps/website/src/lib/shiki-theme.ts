import type { ThemeRegistrationRaw } from "shiki";

/**
 * Bespoke Shiki themes on the design-language-v2 palette (emerald brand, neutral
 * ramp). rehype-pretty-code emits both and gates each with [data-theme]; the CSS
 * shows the one matching the active theme. Every colour is a v2 token value.
 */
const darkColors = {
  bg: "transparent",
  fg: "#cacaca", // gray-300
  comment: "#696969", // subtle-foreground
  keyword: "#4ee6af", // emerald-300
  string: "#7deabd", // emerald-200
  number: "#f6b84d", // amber-400
  func: "#1899ec", // blue-400
  punctuation: "#8f8f8f", // gray-500
  variable: "#cacaca", // gray-300
  property: "#0bdfa3", // emerald-400 (brand)
  invalid: "#f14949", // red-400
} as const;

const lightColors = {
  bg: "transparent",
  fg: "#383838", // gray-800
  comment: "#7a7a7a",
  keyword: "#007e57", // emerald-700
  string: "#00a473", // emerald-600
  number: "#df9134", // amber-500
  func: "#0076d3", // blue-500
  punctuation: "#717171", // gray-600
  variable: "#383838",
  property: "#00c38b", // emerald-500
  invalid: "#cc3336",
} as const;

type Palette = Record<keyof typeof darkColors, string>;

function buildTheme(name: string, type: "light" | "dark", c: Palette): ThemeRegistrationRaw {
  return {
    name,
    type,
    colors: { "editor.background": c.bg, "editor.foreground": c.fg },
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
