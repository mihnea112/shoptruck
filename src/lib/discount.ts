import "server-only";
import { sql } from "@/lib/db";

/**
 * Get the discount class percentage for a user.
 * Returns 0 if no partner/discount class found.
 */
export async function getUserDiscountPct(userId: string): Promise<number> {
  if (!userId) return 0;

  try {
    const rows = await sql`
      SELECT dc.discount_pct
      FROM partner p
      JOIN discount_class dc ON dc.id = p.discount_class_id AND dc.is_active = true
      WHERE p.account_id = ${userId}::uuid
        AND p.is_active = true
        AND (dc.applies_to = 'CLIENT' OR dc.applies_to = 'BOTH')
      LIMIT 1
    ` as any[];

    if (!rows.length) return 0;
    return Number(rows[0].discount_pct) || 0;
  } catch {
    return 0;
  }
}

/**
 * Apply a class discount % on top of a price.
 * The class discount stacks with product-level discounts.
 */
export function applyClassDiscount(price: number, classPct: number): number {
  if (!classPct || classPct <= 0) return price;
  return Math.round(price * (1 - classPct / 100) * 100) / 100;
}
