import type { Dict } from "./en";

/**
 * Yorùbá (yo-NG) chrome.
 *
 * Orthography: subdots (ẹ ọ ṣ) and full tone marking, NFC-normalized. Checked
 * mechanically by `scripts/check-l10n.ts`.
 *
 * Product surfaces and API nouns stay English by policy — `Console`, `SDKs`,
 * `API Reference`, `idempotency`, `webhook`. See `dict/en.ts` for why.
 */
export const yo: Dict = {
  "chrome.skipToContent": "Fò sí àkóónú",
  "chrome.loading": "Ojú-ìwé ń ṣí…",

  "nav.primary": "Àkọ́kọ́",
  "nav.docs": "Àkọsílẹ̀",
  "nav.apiReference": "API Reference",
  "nav.sdks": "SDKs",
  "nav.ai": "AI",
  "nav.resources": "Àwọn ohun èlò",
  "nav.console": "Console",
  "nav.apiStatus": "Ipò API",
  "nav.external": "Òde",
  "nav.openNavigation": "Ṣí àtòjọ",
  "nav.documentation": "Àkọsílẹ̀",
  "nav.documentationNav": "Àtòjọ àkọsílẹ̀",
  "nav.browseDocs": "Wo àkọsílẹ̀ Nombaone.",
  "nav.breadcrumb": "Ọ̀nà ìtọ́ka",
  "nav.overview": "Àkópọ̀",
  "nav.glossary": "Ìtumọ̀ ọ̀rọ̀",

  "toc.onThisPage": "Lórí ojú-ìwé yìí",

  "pager.previous": "Ti ṣáájú",
  "pager.next": "Tókàn",

  "feedback.question": "Ṣé ojú-ìwé yìí ṣèrànwọ́?",
  "feedback.yes": "Bẹ́ẹ̀ ni",
  "feedback.no": "Bẹ́ẹ̀ kọ́",
  "feedback.thanks": "A dúpẹ́ fún èsì rẹ!",

  "search.trigger": "Wá…",
  "search.ariaTrigger": "Wá nínú àkọsílẹ̀",
  "search.title": "Wá nínú àkọsílẹ̀",
  "search.description": "Wá àkọsílẹ̀ Nombaone nípa ojú-ìwé tàbí apá.",
  "search.placeholder": "Wá nínú àkọsílẹ̀…",
  "search.hintEsc": "Esc láti tì",
  "search.hintNavigate": "↑↓ lọ",
  "search.hintOpen": "⏎ ṣí",
  "search.empty": "Wá àwọn ìtọ́sọ́nà, èròngbà, àti API reference.",
  "search.emptyHint": "Gbìyànjú {terms}.",
  "search.noMatches": "Kò sí èsì fún “{query}”.",
  "search.noMatchesHint": "Ṣàyẹ̀wò ìkọ̀wé rẹ, tàbí wo àtòjọ ẹ̀gbẹ́.",

  "copy.page": "Ṣe àdàkọ ojú-ìwé",
  "copy.copied": "A ti ṣàdàkọ",
  "copy.failed": "Àdàkọ kùnà",
  "copy.moreActions": "Àwọn ìṣe mìíràn",
  "copy.viewMarkdown": "Wò ó ní Markdown",
  "copy.openLlmsFull": "Ṣí llms-full.txt",
  "copy.openInChatGpt": "Ṣí nínú ChatGPT",
  "copy.openInClaude": "Ṣí nínú Claude",
  "copy.openInPerplexity": "Ṣí nínú Perplexity",
  "copy.copyMcp": "Ṣe àdàkọ MCP Server",
  "copy.connectCursor": "So mọ́ Cursor",
  "copy.connectVscode": "So mọ́ VS Code",

  "ask.open": "Bi AI nípa àkọsílẹ̀",
  "ask.label": "Bi AI",
  "ask.title": "Bi àkọsílẹ̀ náà",
  "ask.newChat": "Ìjíròrò tuntun",
  "ask.close": "Tì",
  "ask.placeholder": "Bi ìbéèrè…",
  "ask.send": "Bi",
  "ask.searching": "Ń wá nínú àkọsílẹ̀…",
  "ask.grounded": "Dá lórí àkọsílẹ̀ · ó tọ́ka orísun",
  "ask.empty": "Kò dá èsì kankan padà. Gbìyànjú láti tún un kọ.",
  "ask.error": "Nǹkan kan ṣàṣìṣe. Gbìyànjú lẹ́ẹ̀kansí, tàbí lo ìwáàwá (⌘K).",
  "ask.noStream": "Kò sí èsì.",
  "ask.englishOnly": "Ní Gẹ̀ẹ́sì ni olùrànlọ́wọ́ yìí ń dáhùn.",

  "theme.change": "Yí àwọ̀ ojú-ìwé padà",

  "notFound.code": "404",
  "notFound.title": "O ti dé etí ilẹ̀ máàpù.",
  "notFound.body": "Ojú-ìwé yìí kò sí (síbẹ̀). Ó lè ti ṣí kúrò, tàbí o lè ti tẹ̀lé ọ̀nà tí kò wúlò mọ́.",
  "notFound.back": "Padà sí àkọsílẹ̀",
  "notFound.quickstart": "Bẹ̀rẹ̀ pẹ̀lú quickstart",
  "notFound.searchPrefix": "tàbí tẹ",
  "notFound.searchSuffix": "láti wá nínú àkọsílẹ̀ yìí",

  "locale.switch": "Èdè",
  "locale.english": "English",
  "locale.notice":
    "Ìtumọ̀ ni ojú-ìwé yìí. English ni ó jẹ́ àṣẹ — bí ohunkóhun bá yàtọ̀, tẹ̀lé ojú-ìwé Gẹ̀ẹ́sì.",
  "locale.readInEnglish": "Kà á ní Gẹ̀ẹ́sì",
};
