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
  discount_price: number | null;
  discount_active: boolean;
  discount_percentage: number;
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

    // Build website branding context with actual company details
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

## Company Contact Details (for footer):
- **Company Name**: ShopTruck.ro
- **Address**: Str. Miresei Nr. 12A, TIMIS, TIMISOARA
- **Phone**: 0256 244 136
- **Email**: office@autotruck.ro
- **CIF**: RO14084923
- **Registration**: J35/838/2001
- **Website**: https://shoptruck.ro
`;

    // Build product list with links
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NODE_ENV === "production" ? "https://shoptruck.ro" : "http://localhost:3000");

    const productListHtml = products
      .map((p: Product, idx: number) => {
        const productUrl = `${siteUrl}/produs/${p.slug}`;
        const regularPrice = new Intl.NumberFormat("ro-RO", {
          style: "currency",
          currency: "RON",
          maximumFractionDigits: 0,
        }).format(p.price_gross);

        const priceInfo = p.discount_active && p.discount_price
          ? `Original Price: ${regularPrice} | Discounted Price: ${new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(p.discount_price)} | Discount: -${p.discount_percentage}%`
          : `Price: ${regularPrice}`;

        return `
Product ${idx + 1}:
- Name: ${p.name}
- Brand: ${p.brand_name || "N/A"}
- ${priceInfo}
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
   - Product image (centered, with alt text)
   - Product name (centered)
   - Brand name (centered)
   - For DISCOUNTED products: Show original price (strikethrough) + discounted price (in green, bold) + red discount badge with percentage (e.g., "-30%")
   - For regular products: Show price only
   - Direct link button to product page (centered)
4. CENTER all product cards, images, and text alignment in the email
5. Add professional header with ShopTruck branding
6. Include compelling call-to-action button
7. Add footer with:
   - Company name: ShopTruck.ro
   - Full address: Str. Miresei Nr. 12A, TIMIS, TIMISOARA
   - Phone: 0256 244 136
   - Email: office@autotruck.ro
   - CIF: RO14084923 | Registration: J35/838/2001
   - Website link: https://shoptruck.ro
   - Unsubscribe link/placeholder
   - Professional styling with gray background
8. Use inline CSS for email compatibility
9. Ensure responsive design
10. Keep email under 600px width
11. Use the tone: ${toneDescriptions[tone]}
12. **IMPORTANT**: Center all product images and text for professional appearance

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
