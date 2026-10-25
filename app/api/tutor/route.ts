import { buildSystemPrompt } from "@/lib/ai/prompt";
import { tutorRequestSchema } from "@/lib/ai/schema";
import { checkRate, describeError, getClient, getModel, json } from "@/lib/ai/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BODY = 200_000;

export async function POST(req: Request) {
  const ai = getClient();
  if (!ai) return json({ error: "not_configured", message: "The AI tutor isn't set up: GEMINI_API_KEY is missing on the server." }, 503);

  const rate = checkRate(req, "tutor");
  if (!rate.ok) return json({ error: "rate_limited", message: `Too many requests. Try again in ${rate.retryAfter}s.` }, 429, { "retry-after": String(rate.retryAfter) });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "too_large", message: "Conversation is too long. Clear it or start a new one." }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "bad_request", message: "Request body must be JSON." }, 400);
  }
  const parsed = tutorRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid request." }, 400);
  const { messages, mode, depth, useSearch, context } = parsed.data;

  let stream: AsyncGenerator<{ text?: string; candidates?: { groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[] }>;
  try {
    stream = await ai.models.generateContentStream({
      model: getModel(),
      contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.content }] })),
      config: {
        systemInstruction: buildSystemPrompt(mode, depth, context, useSearch),
        temperature: mode === "steps" || mode === "code" ? 0.3 : 0.6,
        maxOutputTokens: depth === "deep" ? 8192 : 4096,
        ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
        abortSignal: req.signal,
      },
    });
  } catch (err) {
    const d = describeError(err);
    console.error("tutor: Gemini request failed", (err as { status?: number })?.status ?? "");
    return json({ error: "upstream", message: d.message }, d.status);
  }

  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sources = new Map<string, string>();
      try {
        for await (const chunk of stream) {
          if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
          for (const g of chunk.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) if (g.web?.uri) sources.set(g.web.uri, g.web.title ?? g.web.uri);
        }
        if (sources.size) controller.enqueue(encoder.encode(`\n<sources>${JSON.stringify([...sources].map(([uri, title]) => ({ uri, title })))}</sources>`));
      } catch (err) {
        if (!req.signal.aborted) {
          const d = describeError(err);
          controller.enqueue(encoder.encode(`\n<error>${d.message}</error>`));
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(out, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
