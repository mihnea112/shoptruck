import "server-only";
import { sql } from "@/lib/db";
import { sendEmail } from "./sender";
import { promotionTemplate } from "./templates";

const CONCURRENCY = 5;

/**
 * Email every client (account with an email address) about a product that was
 * just put on promotion. Never throws; failures are logged per recipient.
 */
export async function notifyClientsOfPromotion(product: {
  name: string;
  slug: string | null;
  originalPrice: number;
  discountPrice: number;
  discountPercentage: number;
}): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  try {
    const recipients = (await sql`
      SELECT display_name, email
      FROM account
      WHERE email IS NOT NULL AND btrim(email) <> ''
    `) as { display_name: string | null; email: string }[];

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://shoptruck.ro").replace(/\/$/, "");
    const productUrl = product.slug ? `${appUrl}/produs/${product.slug}` : `${appUrl}/promotii`;

    for (let i = 0; i < recipients.length; i += CONCURRENCY) {
      await Promise.all(
        recipients.slice(i, i + CONCURRENCY).map(async (r) => {
          try {
            const tpl = promotionTemplate({
              customerName: r.display_name,
              productName: product.name,
              productUrl,
              originalPrice: product.originalPrice,
              discountPrice: product.discountPrice,
              discountPercentage: product.discountPercentage,
            });
            await sendEmail({ to: r.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
            sent++;
          } catch {
            failed++; // sendEmail already logs the error
          }
        })
      );
    }
    console.log(`[Promotion Email] ${product.name}: sent=${sent} failed=${failed}`);
  } catch (e: any) {
    console.error("[Promotion Email] failed to load recipients", e?.message);
  }

  return { sent, failed };
}
