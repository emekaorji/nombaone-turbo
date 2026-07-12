/**
 * The one tokenizer for lexical retrieval (Ask-AI grounding + the MCP
 * `search_docs` tool).
 *
 * It must be Unicode-aware. The obvious `split(/\W+/)` is not: JS `\W` is
 * `[^A-Za-z0-9_]`, so every diacritic reads as a separator and a Yorùbá or
 * Hausa query is shredded before it is ever scored —
 * `"báwo ni màá ṣe san".split(/\W+/)` → `["san"]`, three of four content words
 * annihilated. `"ɓaɗaƙƙe"` → `["a", "a", "e"]`, which a length floor then
 * discards entirely, so retrieval returns nothing and the caller falls through
 * to its "not in the docs" refusal without ever reaching the model.
 *
 * Both the index and the query are NFC-normalized (see `build-search-index.ts`
 * and `build-ask-index.ts`), or `ṣ` composed one way would miss `ṣ` composed
 * the other.
 */

/** Split on anything that is not a letter or a number, in any script. */
const SEPARATOR = /[^\p{L}\p{N}]+/u;

/**
 * Query → scoreable terms.
 *
 * `minLength` is the caller's call, because the two callers want different
 * things. Ask-AI passes 3 to drop function words ("is", "of", "ni", "ti") —
 * without a floor a lexical scorer matches every chunk in the corpus. MCP
 * keeps the floor at 1, because an agent legitimately searches for `v1` or
 * `id`. Neither floor is an ASCII artifact; the tokenizer is.
 */
export function terms(query: string, minLength = 1): string[] {
  return query
    .normalize("NFC")
    .toLowerCase()
    .split(SEPARATOR)
    .filter((t) => t.length >= minLength);
}

/** Normalize a stored field the same way, so index and query can compare. */
export function normalizeForMatch(text: string): string {
  return text.normalize("NFC").toLowerCase();
}
