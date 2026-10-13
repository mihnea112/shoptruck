import "server-only";
import { randomBytes } from "crypto";
import { sql } from "@/lib/db";

export const WELCOME_PCT = 5;
export const WELCOME_VALID_DAYS = 30;

export function generateCode(): string {
  // No ambiguous characters (0/O, 1/I)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `TRUCK-${out}`;
}

/** Returns the discount percentage for a usable code, or null. */
export async function getValidCodePct(code: string | null | undefined): Promise<number | null> {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;
  const rows = (await sql`
    SELECT pct FROM discount_code
    WHERE code = ${c} AND used_at IS NULL AND expires_at > now()
    LIMIT 1
  `) as any[];
  return rows.length ? Number(rows[0].pct) : null;
}
