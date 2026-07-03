// Pure code-token helpers (no client boundary) so server components can build
// tokenized code arrays and pass them to the client <CodeBlock/>.
// keywords = emerald, strings = gray, comments = subtle, everything else = white.
export type Seg = { t: string; c?: "kw" | "str" | "com" };
export type Line = Seg[] | null; // null = blank spacer line
export type CodeTab = { label: string; lines: Line[] };

export const kw = (t: string): Seg => ({ t, c: "kw" });
export const str = (t: string): Seg => ({ t, c: "str" });
export const com = (t: string): Seg => ({ t, c: "com" });
export const w = (t: string): Seg => ({ t });

export function segColor(c?: Seg["c"]) {
  if (c === "kw") return "text-accent";
  if (c === "str") return "text-muted-foreground";
  if (c === "com") return "text-subtle-foreground";
  return "text-foreground";
}
