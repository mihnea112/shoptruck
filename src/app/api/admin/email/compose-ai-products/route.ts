import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

interface Product {
  id: string;
  slug: string;
  name: string;
  price_gross: number;
  primary_image_url: string | null;
  brand_name: string | null;
}

export async function POST(req: Request) {
  try {
    await requireStaff(req, ["admin"]);

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ ok: false, error: "Content-Type trebuie să fie application/json." }, 415);
    }

    const body = await req.json();
    const { subject, tone, keyPoints, products } = body;

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

    if (!products || !Array.isArray(products) || products.length === 0) {
      return json({ ok: false, error: "Cel puțin un produs este necesar." }, 400);
    }

    // Build website branding context
    const brandingContext = `
## Branding Guidelines (MUST respect):
- **Website**: ShopTruck - magazin online de piese și echipamente
- **Primary Color**: #feab1f (warm orange/amber)
- **Secondary Colors**: #b57712 (darker orange), #ffffff (white), #f8f9fa (light gray)
- **Typography**: Clean, modern, professional
- **Tone**: Professional but approachable, focused on quality and reliability
- **Logo**: ShopTruck brand
- **Email Style**: Professional HTML email with:
  - Header with ShopTruck branding
  - Product showcase section
  - Footer with contact & unsubscribe info
  - Orange accent colors (#feab1f)
  - Responsive design
`;

    // Build product list with links
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NODE_ENV === "production" ? "https://shoptruck.ro" : "http://localhost:3000");

    const productListHtml = products
      .map((p: Product, idx: number) => {
        const productUrl = `${siteUrl}/produs/${p.slug}`;
        const price = new Intl.NumberFormat("ro-RO", {
          style: "currency",
          currency: "RON",
          maximumFractionDigits: 0,
        }).format(p.price_gross);

        return `
Product ${idx + 1}:
- Name: ${p.name}
- Brand: ${p.brand_name || "N/A"}
- Price: ${price}
- URL: ${productUrl}
- Image URL: ${p.primary_image_url || "N/A"}`;
      })
      .join("\n");

    const toneDescriptions: { [key: string]: string } = {
      professional: "profesional și formal",
      friendly: "prietenos și ușor de citit",
      urgent: "urgent și care solicită acțiune imediată",
    };

    const prompt = `You are a professional email marketing specialist working for ShopTruck, a Romanian online parts and equipment store.

${brandingContext}

## Email Campaign Task:
Create an email marketing campaign in Romanian (Limba română) with:
- **Subject**: ${subject}
- **Tone**: ${toneDescriptions[tone]}
- **Key Points**: ${keyPoints}
- **Featured Products**:
${productListHtml}

## Requirements:
1. Generate ONLY valid, professional HTML email code
2. Use ShopTruck branding (#feab1f orange color, professional layout)
3. Include all products with:
   - Product image
   - Product name
   - Price in RON (lei)
   - Direct link button to product page
4. Add professional header with ShopTruck branding
5. Include compelling call-to-action button
6. Add footer with:
   - Company info
   - Unsubscribe placeholder
   - Contact info
7. Use inline CSS for email compatibility
8. Ensure responsive design
9. Keep email under 600px width
10. Use the tone: ${toneDescriptions[tone]}

## Output Format:
ONLY return the complete HTML email code. No explanations, no markdown, no text before or after the HTML. Start with <!DOCTYPE html> and end with </html>.

Make it visually appealing, professional, and aligned with ShopTruck's branding.`;

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
            maxOutputTokens: 4000,
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
    console.error("[API compose-ai-products POST]", e);
    return json({
      ok: false,
      error: e?.message || "Eroare la generarea email-ului cu AI.",
    }, 500);
  }
}

function stripHtmlToText(html: string): string {
  let text = html.replace(/<script[^>]*>.*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>.*?<\/style>/gi, "");
  text = text.replace(/<!--.*?-->/g, "");
  text = text.replace(/<(br|p|div|h[1-6]|blockquote|li)[^>]*>/gi, "\n");
  text = text.replace(/<\/(p|div|h[1-6]|blockquote|li)>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line)
    .join("\n");
  return text;
}
