import { groq } from "@ai-sdk/groq";
import { streamText, type ModelMessage } from "ai";

import { retrieve } from "@/lib/ask-retrieval";

/**
 * Ask-AI answer route (Phase 09) — a strictly-grounded RAG endpoint over the
 * docs corpus (`public/ask-index.json`). It accepts the running conversation,
 * retrieves the chunks most relevant to the latest question, refuses when
 * nothing relevant is found, and streams a grounded answer that cites source
 * URLs and expresses money as integer kobo. Multi-turn: prior messages are sent
 * to the model so follow-ups keep context.
 *
 * Runs on Groq through the Vercel AI SDK (`@ai-sdk/groq`). Needs `GROQ_API_KEY`;
 * the model is overridable via `ASK_AI_MODEL` (default `llama-3.3-70b-versatile`).
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.ASK_AI_MODEL ?? "llama-3.3-70b-versatile";

const SYSTEM = `You are the Nomba One documentation assistant. Nomba One is a
subscription-billing engine on Nomba (Nigerian payments).

Hard rules, follow every one:
- Answer from the provided context and the conversation so far. Prose is a fine
  answer — you do NOT need a code sample to answer; only include code when the
  context contains it and it helps.
- Only if the context is clearly unrelated to the question should you say "I
  don't have that in the docs yet" and point to the closest page. Never invent an
  endpoint, field, parameter, or error code.
- Cite your sources: end the answer with a "Sources:" list of the exact URLs from
  the context that you used.
- Money is ALWAYS integer kobo (e.g. 250000 = ₦2,500.00). Never emit a naira
  amount where an amount is sent to the API; if you show one, use integer kobo and
  note the naira value in a comment.
- Be concise and lead with the answer.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  let messages: ChatMessage[] = [];
  try {
    const body = (await req.json()) as {
      question?: string;
      messages?: { role?: string; content?: string }[];
    };
    if (Array.isArray(body.messages)) {
      messages = body.messages
        .filter(
          (m): m is ChatMessage =>
            (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
        )
        .map((m) => ({ role: m.role, content: m.content }));
    } else if (typeof body.question === "string") {
      messages = [{ role: "user", content: body.question }];
    }
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Retrieve against the last two user turns so a short follow-up still carries
  // the terms of what it's following up on.
  const userTurns = messages.filter((m) => m.role === "user");
  const question = userTurns.at(-1)?.content.trim() ?? "";
  if (!question) return new Response("Empty question", { status: 400 });

  if (!process.env.GROQ_API_KEY) {
    return Response.json(
      { error: "Ask AI is not configured on this deployment (missing GROQ_API_KEY)." },
      { status: 503 },
    );
  }

  const retrievalQuery = userTurns
    .slice(-2)
    .map((m) => m.content)
    .join(" ");
  const hits = await retrieve(retrievalQuery, 8);

  if (hits.length === 0) {
    return Response.json({
      grounded: false,
      answer:
        "I don't have that in the docs yet. Try the search (⌘K), or browse the reference and guides. I can only answer from the Nomba One documentation.",
    });
  }

  const context = hits
    .map((h, i) => `[${i + 1}] ${h.title} (${h.url})\n${h.text}`)
    .join("\n\n");

  const result = streamText({
    model: groq(MODEL),
    system: `${SYSTEM}\n\nContext for the latest question:\n\n${context}`,
    messages: messages as ModelMessage[],
    temperature: 0.2,
    onError: ({ error }) => {
      console.error("[ask] stream error:", error);
    },
  });

  return result.toTextStreamResponse();
}
