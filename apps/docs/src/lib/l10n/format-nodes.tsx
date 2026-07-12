import { Fragment, type ReactNode } from "react";

/**
 * `format()` for React nodes rather than strings.
 *
 * Some UI copy styles a fragment of itself — the search palette sets its example
 * terms in mono/accent, and highlights the user's query inside "No matches for
 * …". A flat translated string cannot carry that markup, and hard-coding the
 * sentence around the styled bit in JSX cannot survive translation, because word
 * order moves: what sits at the end of an English sentence may sit at the front
 * of a Yorùbá one.
 *
 * So the dictionary keeps a template with named holes (`"Try {terms}."`), the
 * caller supplies the holes as rendered nodes, and this stitches them together
 * in whatever order the translation puts them.
 */
export function formatNodes(
  template: string,
  vars: Record<string, ReactNode>,
): ReactNode[] {
  const parts = template.split(/(\{\w+\})/g);
  return parts.map((part, index) => {
    const match = /^\{(\w+)\}$/.exec(part);
    const value = match ? vars[match[1]] : undefined;
    return (
      <Fragment key={index}>{match && value !== undefined ? value : part}</Fragment>
    );
  });
}
