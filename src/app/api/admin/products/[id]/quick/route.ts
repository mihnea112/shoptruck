import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireAdmin } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

type Ctx = { params: { id: string } | Promise<{ id: string }> };

function parseDecimal(v: any): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Quick edit used from the offer product search: name and net sell price only.
 * The sell price is stored as buy_price_net with the product's margin kept, so
 * price = buy_price_net * (1 + margin/100) (same formula as the search results). buy_price_net has
 * 2 decimals, so the closest buy price that yields the typed price is used; the response
 * always carries the price actually stored.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  let me: any = null;
  try {
    me = await requireAdmin(req);
  } catch (e: any) {
    const status = Number(e?.status ?? e?.statusCode ?? (e instanceof ApiError ? e.status : 403));
    return json({ ok: false, error: e?.message || "Acces interzis." }, status);
  }
  const { id } = await Promise.resolve(ctx.params);
  const actorId = String(me?.userId ?? me?.user_id ?? me?.id ?? "").trim();

  const body = await req.json().catch(() => null);
  const name = body?.name != null ? String(body.name).trim() : null;
  const price = body?.price != null ? parseDecimal(body.price) : null;

  if (name !== null && name.length < 2) return json({ ok: false, error: "Numele este obligatoriu." }, 400);
  if (body?.price != null && (price == null || price < 0)) return json({ ok: false, error: "Preț invalid (>= 0)." }, 400);
  if (name === null && price === null) return json({ ok: false, error: "Nimic de actualizat." }, 400);

  try {
    const rows = await sql`
      WITH _ctx AS (SELECT set_config('app.user_id', ${actorId}, true))
      UPDATE product
      SET
        name = COALESCE(${name}, name),
        buy_price_net = CASE WHEN ${price}::numeric IS NULL THEN buy_price_net
          ELSE COALESCE(
            -- buy_price_net has 2 decimals and the app prices with CEILING, so look for the
            -- buy price whose resulting price equals the typed one exactly
            (SELECT g / 100.0
               FROM generate_series(
                 FLOOR(${price}::numeric / (1 + profit_margin_pct / 100.0) * 100)::int - 2,
                 CEIL(${price}::numeric / (1 + profit_margin_pct / 100.0) * 100)::int + 2) g
              WHERE CEILING((g / 100.0) * (1 + profit_margin_pct / 100.0) * 100) / 100.0 = ROUND(${price}::numeric, 2)
              ORDER BY abs(g / 100.0 - ${price}::numeric / (1 + profit_margin_pct / 100.0))
              LIMIT 1),
            ROUND(${price}::numeric / (1 + profit_margin_pct / 100.0), 2)) END,
        updated_at = now()
      WHERE id = ${id}::uuid
      RETURNING id, name,
        (CEILING((buy_price_net * (1 + (profit_margin_pct / 100.0))) * 100) / 100.0) AS price
    `;
    if (!(rows as any[]).length) return json({ ok: false, error: "Produs inexistent." }, 404);
    const r = (rows as any[])[0];
    return json({ ok: true, item: { id: r.id, name: r.name, price: Number(r.price) } });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare la salvare." }, 500);
  }
}
