import { getModel } from "@/lib/ai/server";

export const dynamic = "force-dynamic";

/** Reports whether the server has a key. Never returns the key itself. */
export function GET() {
  const configured = !!process.env.GEMINI_API_KEY?.trim();
  return Response.json({ configured, model: configured ? getModel() : undefined }, { headers: { "cache-control": "no-store" } });
}
