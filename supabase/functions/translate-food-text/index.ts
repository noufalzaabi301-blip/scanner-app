// ---------------------------------------------------------------------------
// supabase/functions/translate-food-text/index.ts
// Translates short food-label texts (ingredients, allergens, allergy names)
// between English and Arabic with Google Gemini.
//
// Why an Edge Function: the AI API key must never be shipped inside the
// app. It is stored as the GEMINI_API_KEY secret and used only here.
// Supabase verifies the caller's JWT before this code runs.
//
// Deploy:
//   supabase secrets set GEMINI_API_KEY=your-key
//   supabase functions deploy translate-food-text
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gemini-2.5-flash";
const MAX_TEXTS = 80;
const MAX_LENGTH = 400;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");

  if (!apiKey) {
    return json({ error: "Translation is not configured." }, 500);
  }

  let texts: string[] = [];
  let target = "ar";

  try {
    const body = await req.json();
    target = body?.target === "en" ? "en" : "ar";
    texts = (Array.isArray(body?.texts) ? body.texts : [])
      .filter((t: unknown): t is string => typeof t === "string")
      .slice(0, MAX_TEXTS)
      .map((t: string) => t.slice(0, MAX_LENGTH));
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  if (texts.length === 0) {
    return json({ translations: [] });
  }

  const language = target === "ar" ? "Modern Standard Arabic" : "English";

  const prompt = [
    `Translate each food-label item below into ${language}.`,
    "Rules:",
    "- Return ONLY a JSON array of strings, same length and order as the input.",
    "- Keep E-numbers (e.g. E322, E160a), numbers and percentages exactly.",
    "- Use the standard food/ingredient term a shopper would recognise.",
    "- When translating to English, return the common ingredient or allergen name (e.g. 'سكر' -> 'sugar').",
    "- Do not add explanations.",
    "",
    JSON.stringify(texts),
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    return json({ error: "Translation service failed." }, 502);
  }

  try {
    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed) || parsed.length !== texts.length) {
      return json({ error: "Unexpected translation result." }, 502);
    }

    return json({
      translations: parsed.map((item: unknown, i: number) =>
        typeof item === "string" && item.trim() ? item.trim() : texts[i]
      ),
    });
  } catch {
    return json({ error: "Unexpected translation result." }, 502);
  }
});
