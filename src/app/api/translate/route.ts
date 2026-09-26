import { isLanguageCode } from "@/lib/languages";

export async function POST(request: Request) {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key) return Response.json({ error: "Translation is not configured" }, { status: 503 });

  let payload: unknown;
  try { payload = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  const body = payload as { lang?: unknown; text?: unknown };
  if (!isLanguageCode(body?.lang) || body.lang === "en" || !Array.isArray(body.text) ||
      body.text.length > 80 || body.text.some((item) => typeof item !== "string" || item.length > 500) ||
      body.text.join("").length > 5000) {
    return Response.json({ error: "Invalid translation request" }, { status: 400 });
  }
  if (body.text.length === 0) return Response.json({ translations: [] });

  try {
    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: body.text, source: "en", target: body.lang, format: "text" }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return Response.json({ error: "Translation is unavailable" }, { status: 502 });
    const data = await response.json() as { data?: { translations?: { translatedText?: string }[] } };
    const translations = data.data?.translations?.map((item) => item.translatedText ?? "");
    if (!translations || translations.length !== body.text.length) throw new Error("Incomplete translation");
    return Response.json({ translations }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch {
    return Response.json({ error: "Translation is unavailable" }, { status: 502 });
  }
}
