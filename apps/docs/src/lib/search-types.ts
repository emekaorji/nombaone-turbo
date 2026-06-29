/**
 * Shared shape of a single search record. Produced by
 * `scripts/build-search-index.ts` (→ `public/search-index.json`) and consumed
 * by the ⌘K palette's MiniSearch instance. Keeping it here makes the index and
 * the client agree on the contract.
 */
export interface SearchDoc {
  /** Stable id: the page url plus optional `#heading` fragment. */
  id: string;
  /** Page or section title. */
  title: string;
  /** Sidebar section label, for grouping results. */
  section: string;
  /** The heading text when the record is a sub-section, else "". */
  heading: string;
  /** Plain-text excerpt of the page/section body, for full-text matching. */
  text: string;
  /** Destination url (with `#fragment` for headings). */
  url: string;
}
