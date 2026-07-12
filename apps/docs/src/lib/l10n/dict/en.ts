/**
 * The UI chrome dictionary. English is the SCHEMA — `Dict` is derived from it,
 * so a key missing from `yo.ts` or `ha.ts` is a TypeScript error, not a runtime
 * fallback nobody notices.
 *
 * DO-NOT-TRANSLATE (see `l10n/dnt.json`): the API's nouns are the names of
 * things a reader types, not English words. `webhook`, `subscription`, `plan`,
 * `API key`, `idempotency key`, `kobo`, `sandbox` stay English in every locale.
 * There is no attested Yorùbá or Hausa word for any of them, and inventing one
 * would break copy-paste for the exact reader we are writing for.
 *
 * Chrome is different from prose: these are labels on controls. Where a control
 * names a product surface ("Console", "API Reference", "SDKs") it stays English
 * too — that is what the surface is called.
 */
export const en = {
  // --- document shell ---
  "chrome.skipToContent": "Skip to content",
  "chrome.loading": "Loading page…",

  // --- top nav ---
  "nav.primary": "Primary",
  "nav.docs": "Docs",
  "nav.apiReference": "API Reference",
  "nav.sdks": "SDKs",
  "nav.ai": "AI",
  "nav.resources": "Resources",
  "nav.console": "Console",
  "nav.apiStatus": "API status",
  "nav.external": "External",
  "nav.openNavigation": "Open navigation",
  "nav.documentation": "Documentation",
  "nav.documentationNav": "Documentation navigation",
  "nav.browseDocs": "Browse the Nombaone documentation.",
  "nav.breadcrumb": "Breadcrumb",
  "nav.overview": "Overview",
  "nav.glossary": "Glossary",

  // --- table of contents ---
  "toc.onThisPage": "On this page",

  // --- pager ---
  "pager.previous": "Previous",
  "pager.next": "Next",

  // --- feedback ---
  "feedback.question": "Was this page helpful?",
  "feedback.yes": "Yes",
  "feedback.no": "No",
  "feedback.thanks": "Thanks for the feedback!",

  // --- search ---
  "search.trigger": "Search…",
  "search.ariaTrigger": "Search the docs",
  "search.title": "Search the docs",
  "search.description": "Search Nombaone documentation by page or section.",
  "search.placeholder": "Search the docs…",
  "search.hintEsc": "Esc to close",
  "search.hintNavigate": "↑↓ navigate",
  "search.hintOpen": "⏎ open",
  "search.empty": "Search guides, concepts, and the API reference.",
  /**
   * `{terms}` is filled with the example search terms, set in mono/accent by the
   * caller. It is a hole rather than three inline words because word order moves
   * across languages: what trails an English sentence can lead a Yorùbá one.
   * The terms themselves are do-not-translate — they are what you actually type.
   */
  "search.emptyHint": "Try {terms}.",
  "search.noMatches": "No matches for “{query}”.",
  "search.noMatchesHint": "Check the spelling, or browse the sidebar.",

  // --- copy page ---
  "copy.page": "Copy page",
  "copy.copied": "Copied",
  "copy.failed": "Copy failed",
  "copy.moreActions": "More page actions",
  "copy.viewMarkdown": "View as Markdown",
  "copy.openLlmsFull": "Open llms-full.txt",
  "copy.openInChatGpt": "Open in ChatGPT",
  "copy.openInClaude": "Open in Claude",
  "copy.openInPerplexity": "Open in Perplexity",
  "copy.copyMcp": "Copy MCP Server",
  "copy.connectCursor": "Connect to Cursor",
  "copy.connectVscode": "Connect to VS Code",

  // --- ask ai ---
  "ask.open": "Ask AI about the docs",
  "ask.label": "Ask AI",
  "ask.title": "Ask the docs",
  "ask.newChat": "New chat",
  "ask.close": "Close",
  "ask.placeholder": "Ask a question…",
  "ask.send": "Ask",
  "ask.searching": "Searching the docs…",
  "ask.grounded": "Grounded in the docs · cites sources",
  "ask.empty": "The assistant returned an empty answer. Try rephrasing.",
  "ask.error": "Something went wrong. Try again, or use search (⌘K).",
  "ask.noStream": "No response stream.",
  /**
   * Ask-AI answers in English even on a translated page, and says so. The
   * retrieval corpus is the English one (English is authoritative), and the
   * model behind it is not competent in Yorùbá or Hausa — an assistant
   * confidently emitting wrong tone marks into a copy-pasteable surface is the
   * worst output this project could produce. Better to be plainly English.
   */
  "ask.englishOnly": "The assistant answers in English.",

  // --- theme ---
  "theme.change": "Change theme",

  // --- 404 ---
  "notFound.code": "404",
  "notFound.title": "You found the edge of the map.",
  "notFound.body": "This page does not exist (yet). It may have moved, or you may have followed a stale link.",
  "notFound.back": "Back to the docs",
  "notFound.quickstart": "Start with the quickstart",
  "notFound.searchPrefix": "or press",
  "notFound.searchSuffix": "to search these docs",

  // --- locale switcher + the authoritative-English notice ---
  "locale.switch": "Language",
  "locale.english": "English",
  /**
   * Shown on every translated page. English is authoritative: if the
   * translation and the English page disagree, the English page is right. Say
   * that plainly, and put the English page one click away.
   */
  "locale.notice": "This page is a translation. English is authoritative — if anything conflicts, follow the English page.",
  "locale.readInEnglish": "Read in English",
} as const;

export type DictKey = keyof typeof en;
export type Dict = Record<DictKey, string>;
