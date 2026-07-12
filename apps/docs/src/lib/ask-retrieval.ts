import { promises as fs } from "node:fs";
import path from "node:path";

import { normalizeForMatch, terms as tokenize } from "./tokenize";

/**
 * Lexical retrieval over the Ask-AI grounding index (Phase 09). Scores chunks
 * against a query by term overlap (title/heading weighted). No embeddings —
 * lexical is the floor and keeps the assistant grounded and dependency-free.
 */

export interface AskChunk {
  type: "page" | "operation" | "error";
  url: string;
  title: string;
  text: string;
}

let cache: AskChunk[] | null = null;

async function loadIndex(): Promise<AskChunk[]> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "public", "ask-index.json"), "utf8");
    cache = JSON.parse(raw) as AskChunk[];
  } catch {
    cache = [];
  }
  return cache;
}

export interface Retrieved extends AskChunk {
  score: number;
}

export async function retrieve(query: string, limit = 8): Promise<Retrieved[]> {
  const index = await loadIndex();
  const terms = tokenize(query, 3);
  if (terms.length === 0) return [];

  return index
    .map((chunk) => {
      const title = normalizeForMatch(chunk.title);
      const text = normalizeForMatch(chunk.text);
      let score = 0;
      for (const t of terms) {
        if (title.includes(t)) score += 3;
        score += (text.split(t).length - 1);
      }
      return { ...chunk, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
