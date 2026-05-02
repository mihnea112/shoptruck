import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(req: Request) {
  try {
    await requireStaff(req, ["admin"]);

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ ok: false, error: "Content-Type trebuie să fie application/json." }, 415);
    }

    const body = await req.json();
    const { subject, tone, keyPoints } = body;

    // Validate inputs
    if (!subject || typeof subject !== "string") {
      return json({ ok: false, error: "Subiect necesar și trebuie să fie string." }, 400);
    }

    if (!tone || !["professional", "friendly", "urgent"].includes(tone)) {
      return json({
        ok: false,
        error: "Tone trebuie să fie 'professional', 'friendly', sau 'urgent'.",
      }, 400);
    }

    if (!keyPoints || typeof keyPoints !== "string") {
      return json({ ok: false, error: "Puncte cheie necesare și trebuie să fie string." }, 400);
    }

    // Build prompt for Claude
    const toneDescriptions: { [key: string]: string } = {
      professional: "profesional și formal",
      friendly: "prietenos și ușor de citit",
      urgent: "urgent și care solicită acțiune imediată",
    };

    const prompt = `Ești un specialist în marketing prin email. Generează un email marketing în limba română cu:
- Subiect: ${subject}
- Ton: ${toneDescriptions[tone]}
- Puncte cheie de inclus: ${keyPoints}

Generează DOAR în format HTML valid, fără explicații. Structura trebuie să fie:
1. Salutare
2. Introducere cu context
3. Punctele cheie prezentate clar
4. Call-to-action
5. Semnătură

Asigură-te că HTML-ul este bine structurat cu taguri semantice (h1, p, a, etc.) și stil inline minimal.
Nu include linkuri de dezabonare - voi fi adăugate automat.`;

    // Call Gemini API
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return json({ ok: false, error: "GOOGLE_API_KEY nu este configurat." }, 500);
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("[Gemini API Error]", error);
      return json(
        { ok: false, error: "Eroare la API Gemini: " + (error?.error?.message || "Unknown error") },
        response.status
      );
    }

    const data = await response.json();
    const bodyHtml = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!bodyHtml || bodyHtml.trim().length === 0) {
      return json({ ok: false, error: "IA nu a putut genera email." }, 500);
    }

    // Extract plain text version by stripping HTML
    const bodyText = stripHtmlToText(bodyHtml);

    return json({
      ok: true,
      body_html: bodyHtml,
      body_text: bodyText,
    });
  } catch (e: any) {
    console.error("[API compose-ai POST]", e);
    return json({
      ok: false,
      error: e?.message || "Eroare la generarea email-ului cu AI.",
    }, 500);
  }
}

function stripHtmlToText(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>.*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>.*?<\/style>/gi, "");

  // Remove HTML comments
  text = text.replace(/<!--.*?-->/g, "");

  // Replace block elements with newlines
  text = text.replace(/<(br|p|div|h[1-6]|blockquote|li)[^>]*>/gi, "\n");
  text = text.replace(/<\/(p|div|h[1-6]|blockquote|li)>/gi, "\n");

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');

  // Clean up whitespace
  text = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line)
    .join("\n");

  return text;
}
