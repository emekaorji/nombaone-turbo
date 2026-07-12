import type { Dict } from "./en";

/**
 * Hausa (ha-NG, Kano standard, Boko orthography) chrome.
 *
 * Orthography: hooked letters ɓ ɗ ƙ; the glottal `ʼy` uses U+02BC MODIFIER
 * LETTER APOSTROPHE, never `'` (U+0027) or `’` (U+2019); `ƴ` (U+01B4) is Niger
 * orthography and is rejected. Standard Hausa is written WITHOUT tone marks.
 * All checked mechanically by `scripts/check-l10n.ts`.
 *
 * Product surfaces and API nouns stay English by policy — `Console`, `SDKs`,
 * `API Reference`, `idempotency`, `webhook`. See `dict/en.ts` for why.
 */
export const ha: Dict = {
  "chrome.skipToContent": "Tsallake zuwa abun ciki",
  "chrome.loading": "Ana buɗe shafi…",

  "nav.primary": "Na farko",
  "nav.docs": "Takardu",
  "nav.apiReference": "API Reference",
  "nav.sdks": "SDKs",
  "nav.ai": "AI",
  "nav.resources": "Kayan aiki",
  "nav.console": "Console",
  "nav.apiStatus": "Matsayin API",
  "nav.external": "Na waje",
  "nav.openNavigation": "Buɗe jerin shafuka",
  "nav.documentation": "Takardu",
  "nav.documentationNav": "Jerin takardu",
  "nav.browseDocs": "Duba takardun Nombaone.",
  "nav.breadcrumb": "Hanyar shafi",
  "nav.overview": "Bayani gabaɗaya",
  "nav.glossary": "Maʼanar kalmomi",

  "toc.onThisPage": "A wannan shafi",

  "pager.previous": "Baya",
  "pager.next": "Gaba",

  "feedback.question": "Wannan shafi ya taimaka?",
  "feedback.yes": "Eh",
  "feedback.no": "Aʼa",
  "feedback.thanks": "Mun gode da raʼayinka!",

  "search.trigger": "Nema…",
  "search.ariaTrigger": "Nema a cikin takardu",
  "search.title": "Nema a cikin takardu",
  "search.description": "Nemi takardun Nombaone ta shafi ko sashe.",
  "search.placeholder": "Nema a cikin takardu…",
  "search.hintEsc": "Esc don rufewa",
  "search.hintNavigate": "↑↓ motsi",
  "search.hintOpen": "⏎ buɗe",
  "search.empty": "Nemi jagorori, raʼayoyi, da API reference.",
  "search.emptyHint": "Gwada {terms}.",
  "search.noMatches": "Babu sakamako don “{query}”.",
  "search.noMatchesHint": "Duba rubutun, ko duba jerin gefe.",

  "copy.page": "Kwafi shafi",
  "copy.copied": "An kwafa",
  "copy.failed": "Kwafi ya kasa",
  "copy.moreActions": "Ƙarin ayyuka",
  "copy.viewMarkdown": "Duba a matsayin Markdown",
  "copy.openLlmsFull": "Buɗe llms-full.txt",
  "copy.openInChatGpt": "Buɗe a ChatGPT",
  "copy.openInClaude": "Buɗe a Claude",
  "copy.openInPerplexity": "Buɗe a Perplexity",
  "copy.copyMcp": "Kwafi MCP Server",
  "copy.connectCursor": "Haɗa da Cursor",
  "copy.connectVscode": "Haɗa da VS Code",

  "ask.open": "Tambayi AI game da takardun",
  "ask.label": "Tambayi AI",
  "ask.title": "Tambayi takardun",
  "ask.newChat": "Sabuwar tattaunawa",
  "ask.close": "Rufe",
  "ask.placeholder": "Yi tambaya…",
  "ask.send": "Tambaya",
  "ask.searching": "Ana nema a cikin takardu…",
  "ask.grounded": "An dogara ga takardun · yana ambaton tushe",
  "ask.empty": "Mataimakin bai bayar da amsa ba. Sake gwada tambayar.",
  "ask.error": "Wani abu ya faskara. Sake gwadawa, ko yi amfani da nema (⌘K).",
  "ask.noStream": "Babu amsa.",
  "ask.englishOnly": "Mataimakin yana amsa da Turanci.",

  "theme.change": "Canza launin shafi",

  "notFound.code": "404",
  "notFound.title": "Ka isa gefen taswira.",
  "notFound.body": "Wannan shafi babu shi (tukuna). Wataƙila an matsar da shi, ko ka bi hanyar da ta tsufa.",
  "notFound.back": "Koma ga takardun",
  "notFound.quickstart": "Fara da quickstart",
  "notFound.searchPrefix": "ko danna",
  "notFound.searchSuffix": "don nema a cikin waɗannan takardu",

  "locale.switch": "Harshe",
  "locale.english": "English",
  "locale.notice":
    "Wannan shafi fassara ce. Turanci ne mai iko — idan wani abu ya saɓa, a bi shafin Turanci.",
  "locale.readInEnglish": "Karanta da Turanci",
};
