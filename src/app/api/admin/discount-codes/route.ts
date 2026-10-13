import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";
import { generateCode } from "@/lib/welcome-discount";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(req: NextRequest) {
  await requireStaff(req, ["admin"]);
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const status = searchParams.get("status") || "";
    const like = `%${q}%`;

    const rows = (await sql`
      SELECT id, code, email, pct, source, expires_at, used_at, order_id, created_at,
        CASE WHEN used_at IS NOT NULL THEN 'used'
             WHEN expires_at <= now() THEN 'expired'
             ELSE 'active' END AS status
      FROM discount_code
      WHERE (${q} = '' OR code ILIKE ${like} OR email ILIKE ${like})
      ORDER BY created_at DESC
      LIMIT 500
    `) as any[];

    const filtered = status ? rows.filter((r) => r.status === status) : rows;
    const stats = {
      total: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      used: rows.filter((r) => r.status === "used").length,
      expired: rows.filter((r) => r.status === "expired").length,
    };
    return json({ ok: true, items: filtered, stats });
  } catch (e: any) {
    console.error("[admin discount-codes GET]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

// Manually create a code { email, pct, days }
export async function POST(req: NextRequest) {
  await requireStaff(req, ["admin"]);
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email || "").trim().toLowerCase();
    const pct = Number(body?.pct);
    const days = Number(body?.days ?? 30);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      return json({ ok: false, error: "Email invalid." }, 400);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100)
      return json({ ok: false, error: "Procent invalid (1-100)." }, 400);
    if (!Number.isFinite(days) || days < 1 || days > 365)
      return json({ ok: false, error: "Valabilitate invalidă (1-365 zile)." }, 400);

    const code = generateCode();
    await sql`
      INSERT INTO discount_code (code, email, pct, source, expires_at)
      VALUES (${code}, ${email}, ${pct}, 'manual', now() + (${Math.floor(days)} || ' days')::interval)
    `;
    return json({ ok: true, code });
  } catch (e: any) {
    console.error("[admin discount-codes POST]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}
