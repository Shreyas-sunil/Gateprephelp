import "server-only";
import { GoogleGenAI } from "@google/genai";
import { MODEL_DEFAULT } from "./prompt";
import { rateLimit } from "./ratelimit";

export function getModel(): string {
  const m = process.env.GEMINI_MODEL?.trim();
  return m && /^[a-z0-9.\-]+$/i.test(m) ? m : MODEL_DEFAULT;
}

export function getClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}

export function checkRate(req: Request, bucket: string) {
  const limit = Math.max(1, Number(process.env.TUTOR_RATE_LIMIT_PER_MINUTE) || 20);
  return rateLimit(`${bucket}:${clientIp(req)}`, limit);
}

/** Maps SDK/HTTP errors to a safe message. Never includes the key or request headers. */
export function describeError(err: unknown): { status: number; message: string } {
  const e = err as { status?: number; code?: number; message?: string };
  const status = e?.status ?? e?.code ?? 0;
  const msg = String(e?.message ?? "");
  if (status === 400 && /api key/i.test(msg)) return { status: 502, message: "Gemini rejected the API key. Check GEMINI_API_KEY on the server." };
  if (status === 401 || status === 403) return { status: 502, message: "Gemini refused the request (permission). Check the API key and that the Gemini API is enabled for it." };
  if (status === 404) return { status: 502, message: `The model “${getModel()}” isn't available to this key. Set GEMINI_MODEL to a supported model.` };
  if (status === 429) return { status: 429, message: "Gemini quota or rate limit reached. Wait a minute and try again." };
  if (status >= 500) return { status: 502, message: "Gemini is having trouble right now. Try again shortly." };
  return { status: 502, message: "The tutor couldn't get a response from Gemini." };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
}
