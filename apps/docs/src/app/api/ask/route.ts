import { streamText } from "ai";

import { retrieve } from "@/lib/ask-retrieval";

/**
 * Ask-AI answer route (Phase 09) — a strictly-grounded RAG endpoint over the
 * docs corpus (`public/ask-index.json`). It retrieves the most relevant chunks,
 * refuses when retrieval is weak, and streams an answer that MUST cite source
 * URLs and MUST express money as integer kobo. No ungrounded answers, no
 * invented endpoints.
 *
 * Uses the Vercel AI SDK through the AI Gateway. Needs `AI_GATEWAY_API_KEY`; the
 * model is overridable via `ASK_AI_MODEL` (default `openai/gpt-5.4-nano` — a cheap
 * model is plenty here since the retrieved context carries the answer).
 */

export const runtime = "nodejs";
export const maxDuration = 30;

// A bare `provider/model` string routes through the Vercel AI Gateway (auth,
// failover, cost tracking) when AI_GATEWAY_API_KEY is set. Overridable per deploy.
// A nano/mini model is plenty for grounded doc Q&A — the RAG context does the
// heavy lifting, so we optimise for cost, not raw reasoning.
const MODEL = process.env.ASK_AI_MODEL ?? "openai/gpt-5.4-nano";

const SYSTEM = `You are the Nomba One documentation assistant. Nomba One is a
subscription-billing engine on Nomba (Nigerian payments).

Hard rules — follow every one:
- Answer ONLY from the provided context. If the context does not contain the
  answer, say "I don't have that in the docs" and point to the closest page. Never
  invent an endpoint, field, parameter, or error code.
- Cite your sources: end the answer with a "Sources:" list of the exact URLs you
  used, taken only from the context.
- Money is ALWAYS integer kobo (e.g. 250000 = ₦2,500.00). Never emit a naira
  amount where an amount is sent to the API; if you show an amount, use integer
  kobo and note the naira value in a comment.
- Be concise and lead with the answer. Prefer a short code sample when relevant.`;

export async function POST(req: Request) {
  let question = "";
  try {
    const body = (await req.json()) as { question?: string; messages?: { content?: string }[] };
    question = body.question ?? body.messages?.at(-1)?.content ?? "";
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  question = question.trim();
  if (!question) return new Response("Empty question", { status: 400 });

  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(
      { error: "Ask AI is not configured on this deployment (missing AI_GATEWAY_API_KEY)." },
      { status: 503 },
    );
  }

  const hits = await retrieve(question, 8);
  const strong = hits.filter((h) => h.score >= 2);

  if (strong.length === 0) {
    return Response.json({
      grounded: false,
      answer:
        "I don't have that in the docs. Try the search (⌘K), or browse the reference and guides — I can only answer from the Nomba One documentation.",
    });
  }

  const context = strong
    .map((h, i) => `[${i + 1}] ${h.title} (${h.url})\n${h.text}`)
    .join("\n\n");

  const result = streamText({
    model: MODEL,
    system: SYSTEM,
    prompt: `Context:\n\n${context}\n\n---\n\nQuestion: ${question}\n\nAnswer using only the context above, and cite the URLs you used.`,
    temperature: 0.2,
  });

  return result.toTextStreamResponse();
}
