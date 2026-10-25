import { buildQuizPrompt } from "@/lib/ai/prompt";
import { QUIZ_JSON_SCHEMA, quizRequestSchema, quizResponseSchema } from "@/lib/ai/schema";
import { checkRate, describeError, getClient, getModel, json } from "@/lib/ai/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ai = getClient();
  if (!ai) return json({ error: "not_configured", message: "The AI tutor isn't set up: GEMINI_API_KEY is missing on the server." }, 503);
  const rate = checkRate(req, "quiz");
  if (!rate.ok) return json({ error: "rate_limited", message: `Too many requests. Try again in ${rate.retryAfter}s.` }, 429, { "retry-after": String(rate.retryAfter) });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request", message: "Request body must be JSON." }, 400);
  }
  const p = quizRequestSchema.safeParse(body);
  if (!p.success) return json({ error: "bad_request", message: p.error.issues[0]?.message ?? "Invalid request." }, 400);
  try {
    const res = await ai.models.generateContent({
      model: getModel(),
      contents: [{ role: "user", parts: [{ text: buildQuizPrompt(p.data.subjectName, p.data.topicName, p.data.count, p.data.difficulty, p.data.notes) }] }],
      config: { responseMimeType: "application/json", responseJsonSchema: QUIZ_JSON_SCHEMA, temperature: 0.5, abortSignal: req.signal },
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(res.text ?? "");
    } catch {
      return json({ error: "bad_output", message: "The model returned malformed quiz data. Try again." }, 502);
    }
    const q = quizResponseSchema.safeParse(parsed);
    if (!q.success) return json({ error: "bad_output", message: "The model's quiz didn't match the expected format. Try again." }, 502);
    // Drop internally inconsistent questions rather than show wrong keys.
    const questions = q.data.questions.filter((x) => (x.type === "NAT" ? !!x.natAnswer : x.options.length >= 2 && x.correct.length >= 1 && x.correct.every((i) => i < x.options.length) && (x.type !== "MCQ" || x.correct.length === 1)));
    if (!questions.length) return json({ error: "bad_output", message: "No usable questions came back. Try again." }, 502);
    return json({ questions, model: getModel() });
  } catch (err) {
    const d = describeError(err);
    console.error("quiz: Gemini request failed", (err as { status?: number })?.status ?? "");
    return json({ error: "upstream", message: d.message }, d.status);
  }
}
