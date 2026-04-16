import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireAdmin } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

type Ctx = { params: { id: string } | Promise<{ id: string }> };
async function getId(ctx: Ctx) {
  const p = await Promise.resolve(ctx.params);
  return String((p as any).id);
}

// generic decimal parser: supports "12,5" and trims spaces
function parseDecimal(v: any): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// percentage parser: supports "20%", "20,5", " 20 % "
function parsePct(v: any): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const cleaned = s.replace("%", "").trim();
  const n = Number(cleaned.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function pickCategoryId(body: any): string | null {
  const direct = body?.category_id ? String(body.category_id).trim() : "";
  if (direct) return direct;

  const arr: string[] = Array.isArray(body?.category_ids)
    ? body.category_ids.map((x: any) => String(x)).filter(Boolean)
    : [];
  return arr[0] ? String(arr[0]) : null;
}

function cleanUuid(v: any): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

/**
 * Normalize part codes so equivalences match reliably.
 * Adjust rules if you want (e.g. keep "/" or "+").
 */
function normalizePartCode(raw: string) {
  const code_raw = String(raw ?? "").trim();
  if (!code_raw) return null;
  const code_norm = code_raw
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[-_.]/g, ""); // remove separators
  return code_norm ? { code_raw, code_norm } : null;
}

function uniqueByNorm(list: Array<{ code_raw: string; code_norm: string }>) {
  const m = new Map<string, { code_raw: string; code_norm: string }>();
  for (const x of list) {
    if (!m.has(x.code_norm)) m.set(x.code_norm, x);
  }
  return Array.from(m.values());
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireAdmin(req);
  } catch (e: any) {
    const status = Number(e?.status ?? e?.statusCode ?? (e instanceof ApiError ? e.status : 403));
    return json({ ok: false, error: e?.message || "Acces interzis." }, status);
  }
  const id = await getId(ctx);

  const rows = await sql`
    SELECT
      id,
      sku,
      slug,
      name,
      brand_id,
      category_id,
      tax_rate_id,
      buy_price_net,
      profit_margin_pct,
      uom,
      is_active,
      stock_on_hand,
      stock_reserved,
      created_at,
      updated_at
    FROM product
    WHERE id = ${id}::uuid
    LIMIT 1
  `;

  const p = (rows as any[])?.[0];
  if (!p) return json({ ok: false, error: "Produs inexistent." }, 404);

  const codeRows = await sql`
    SELECT
      j.id,
      pc.code_raw,
      pc.code_norm,
      j.is_primary,
      j.code_kind,
      j.note,
      j.created_at
    FROM product_code j
    JOIN part_code pc ON pc.id = j.code_id
    WHERE j.product_id = ${id}::uuid
    ORDER BY j.is_primary DESC, pc.code_norm ASC
  `;

  const codes = (codeRows as any[]) || [];

  // Primary code is the SKU (business rule). If DB has a primary row, we still expose it,
  // but we fall back to SKU so UI always sees a primary.
  const skuNorm = normalizePartCode(p.sku)?.code_norm ?? null;
  const primaryRow = codes.find((c) => c.is_primary);

  const primary_code =
    String(p.sku || "").trim() ||
    (primaryRow?.code_raw ?? primaryRow?.code_norm ?? null);
  const primary_code_normalized = skuNorm ?? (primaryRow?.code_norm ?? null);

  const equivalent_codes = codes
    .filter((c) => !c.is_primary)
    .map((c) => String(c.code_norm));

  const categoryId = p.category_id ? String(p.category_id) : null;

  return json({
    ok: true,
    item: {
      ...p,
      // helpful aliases for UI
      margin_pct: p.profit_margin_pct,
      primary_code,
      primary_code_normalized,
      equivalent_codes,
      codes: codes.map((c) => ({
        id: c.id,
        code: c.code_norm,
        code_normalized: c.code_norm,
        code_type: c.code_kind,
        is_primary: c.is_primary,
        note: c.note ?? null,
      })),
    },
    category_id: categoryId,
    category_ids: categoryId ? [categoryId] : [],
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  let me: any = null;
  try {
    me = await requireAdmin(req);
  } catch (e: any) {
    const status = Number(
      e?.status ?? e?.statusCode ?? (e instanceof ApiError ? e.status : 403)
    );
    return json({ ok: false, error: e?.message || "Acces interzis." }, status);
  }
  const id = await getId(ctx);

  const actorId = String(me?.userId ?? me?.user_id ?? me?.id ?? "").trim();

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return json(
      { ok: false, error: "Content-Type invalid. Folosește application/json." },
      415
    );
  }

  const body = await req.json().catch(() => null);

  const sku = String(body?.sku ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const slug = String(body?.slug ?? "").trim();

  const isActive = body?.is_active !== false;

  const brandId = cleanUuid(body?.brand_id);
  const taxRateId = cleanUuid(body?.tax_rate_id);
  const categoryId = pickCategoryId(body);

  const buyPriceNet = parseDecimal(body?.buy_price_net);

  // accept both names (UI might send margin_pct)
  const marginPct = parsePct(
    body?.profit_margin_pct != null ? body.profit_margin_pct : body?.margin_pct
  );

  const uom = String(body?.uom ?? "buc").trim() || "buc";

  // parse manual stock edit
  const stockOnHand = parseDecimal(
    body?.stock_on_hand ?? body?.stockOnHand ?? body?.stock
  );

  if (!sku || sku.length < 2)
    return json({ ok: false, error: "SKU invalid." }, 400);
  if (!name || name.length < 2)
    return json({ ok: false, error: "Numele este obligatoriu." }, 400);
  if (!slug) return json({ ok: false, error: "Slug invalid." }, 400);
  if (!taxRateId) return json({ ok: false, error: "Selectează TVA." }, 400);
  if (!categoryId)
    return json({ ok: false, error: "Selectează o categorie." }, 400);

  if (buyPriceNet == null || buyPriceNet < 0) {
    return json(
      { ok: false, error: "Preț achiziție (fără TVA) invalid (>= 0)." },
      400
    );
  }
  if (marginPct == null || marginPct < 0) {
    return json({ ok: false, error: "Marjă invalidă (>= 0)." }, 400);
  }
  if (marginPct > 1000) {
    return json({ ok: false, error: "Marjă prea mare (max 1000%)." }, 400);
  }
  if (stockOnHand != null && stockOnHand < 0) {
    return json({ ok: false, error: "Stoc invalid (>= 0)." }, 400);
  }

  // --- CODES (PRIMARY = SKU, EQUIVALENTS OPTIONAL) ---
  // Business rule: the product SKU is the primary part code.
  // We ALWAYS ensure the primary code exists in DB.
  // We ONLY sync (add/remove) equivalents when caller explicitly sends an equivalents field.

  const primaryNorm = normalizePartCode(sku);
  if (!primaryNorm) {
    return json({ ok: false, error: "SKU invalid (cod principal)." }, 400);
  }

  // Accept equivalents from multiple UI keys (to be resilient)
  const hasEquivsField =
    Object.prototype.hasOwnProperty.call(body || {}, "equivalent_codes") ||
    Object.prototype.hasOwnProperty.call(body || {}, "equiv_codes") ||
    Object.prototype.hasOwnProperty.call(body || {}, "equivalents") ||
    Object.prototype.hasOwnProperty.call(body || {}, "equivCodes");

  const rawEquivsAny =
    (body as any)?.equivalent_codes ??
    (body as any)?.equiv_codes ??
    (body as any)?.equivalents ??
    (body as any)?.equivCodes;

  let eqArr: string[] = [];

  if (Array.isArray(rawEquivsAny)) {
    eqArr = rawEquivsAny
      .map((x: any) => String(x ?? "").trim())
      .filter(Boolean);
  } else if (typeof rawEquivsAny === "string") {
    // Allow pasting multiple codes at once: "A001, B002\nC003; D004"
    // IMPORTANT: do NOT split by spaces.
    eqArr = rawEquivsAny
      .split(/[,;\n\r\t]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (rawEquivsAny != null) {
    const one = String(rawEquivsAny ?? "").trim();
    eqArr = one ? [one] : [];
  }

  // Safety cap (avoid accidentally pasting thousands of tokens)
  if (eqArr.length > 200) {
    return json(
      { ok: false, error: "Prea multe coduri echivalente (max 200)." },
      400
    );
  }

  // Normalize all codes (primary + equivalents), dedupe by normalized value
  const allNormalized = [
    primaryNorm,
    ...(eqArr
      .map((x) => normalizePartCode(x))
      .filter(Boolean) as Array<{ code_raw: string; code_norm: string }>),
  ];

  const uniq = uniqueByNorm(allNormalized);

  const inputArr = uniq.map((x) => ({
    code_raw: x.code_raw,
    code_norm: x.code_norm,
    is_primary: x.code_norm === primaryNorm.code_norm,
  }));

  // IMPORTANT: pass JSON as a real json/jsonb parameter (avoid double-encoded strings)
  // postgres.js exposes sql.json(value). If unavailable, we fall back to a JSON string.
  const inputJsonb =
    (sql as any).json ? (sql as any).json(inputArr) : JSON.stringify(inputArr);

  try {
    // 1) Update product fields
    const upd = await sql`
      WITH _ctx AS (
        SELECT set_config('app.user_id', ${actorId}, true)
      )
      UPDATE product
      SET
        sku = ${sku},
        slug = ${slug},
        name = ${name},

        brand_id = ${brandId ? sql`${brandId}::uuid` : null},
        tax_rate_id = ${taxRateId}::uuid,
        category_id = ${categoryId}::uuid,

        buy_price_net = ${buyPriceNet},
        profit_margin_pct = ${marginPct},

        uom = ${uom},
        is_active = ${isActive},
        stock_on_hand = COALESCE(${stockOnHand}, stock_on_hand),
        updated_at = now()
      WHERE id = ${id}::uuid
      RETURNING id
    `;

    const okId = (upd as any[])?.[0]?.id;
    if (!okId) return json({ ok: false, error: "Produs inexistent." }, 404);

    // 2) Always ensure PRIMARY code exists for this product (PRIMARY = SKU)
    // If caller provided equivalents field, we do full sync (add + delete removed).
    // If not, we ONLY upsert primary and we do NOT delete existing equivalents.

    if (hasEquivsField) {
      // Full sync: primary + equivalents
      await sql`
        WITH _ctx AS (
          SELECT set_config('app.user_id', ${actorId}, true)
        ),
        input AS (
          SELECT *
          FROM jsonb_to_recordset(${inputJsonb}::jsonb)
            AS t(code_raw text, code_norm text, is_primary boolean)
        ),
        upsert_codes AS (
          INSERT INTO part_code (code_raw, code_norm)
          SELECT i.code_raw, i.code_norm
          FROM input i
          ON CONFLICT (code_norm) DO UPDATE
            SET code_raw = EXCLUDED.code_raw
          RETURNING id, code_norm
        ),
        selected AS (
          SELECT pc.id AS code_id, i.is_primary
          FROM part_code pc
          JOIN input i ON i.code_norm = pc.code_norm
        ),
        del AS (
          DELETE FROM product_code
          WHERE product_id = ${okId}::uuid
            AND code_id NOT IN (SELECT code_id FROM selected)
          RETURNING 1
        ),
        ins AS (
          INSERT INTO product_code (product_id, code_id, is_primary, code_kind)
          SELECT
            ${okId}::uuid,
            s.code_id,
            s.is_primary,
            CASE WHEN s.is_primary THEN 'PRIMARY' ELSE 'EQUIVALENT' END
          FROM selected s
          ON CONFLICT (product_id, code_id)
          DO UPDATE SET
            is_primary = EXCLUDED.is_primary,
            code_kind = EXCLUDED.code_kind
          RETURNING 1
        )
        SELECT 1
      `;
    } else {
      // Primary-only upsert (no deletions)
      await sql`
        WITH _ctx AS (
          SELECT set_config('app.user_id', ${actorId}, true)
        ),
        upsert_code AS (
          INSERT INTO part_code (code_raw, code_norm)
          VALUES (${primaryNorm.code_raw}, ${primaryNorm.code_norm})
          ON CONFLICT (code_norm) DO UPDATE
            SET code_raw = EXCLUDED.code_raw
          RETURNING id
        ),
        code_id_sel AS (
          SELECT id AS code_id FROM upsert_code
          UNION ALL
          SELECT id AS code_id FROM part_code WHERE code_norm = ${primaryNorm.code_norm} LIMIT 1
        )
        INSERT INTO product_code (product_id, code_id, is_primary, code_kind)
        SELECT ${okId}::uuid, (SELECT code_id FROM code_id_sel LIMIT 1), true, 'PRIMARY'
        ON CONFLICT (product_id, code_id)
        DO UPDATE SET is_primary = true, code_kind = 'PRIMARY'
      `;

      // Ensure no other rows remain marked primary
      await sql`
        WITH _ctx AS (
          SELECT set_config('app.user_id', ${actorId}, true)
        )
        UPDATE product_code
        SET is_primary = false, code_kind = 'EQUIVALENT'
        WHERE product_id = ${okId}::uuid
          AND is_primary = true
          AND code_id <> (
            SELECT pc.id
            FROM part_code pc
            WHERE pc.code_norm = ${primaryNorm.code_norm}
            LIMIT 1
          )
      `;
    }

    return json({ ok: true, id: okId });
  } catch (e: any) {
    console.error("/api/admin/products/[id] PATCH failed", {
      productId: id,
      actorId,
      code: e?.code ?? null,
      message: e?.message ?? null,
      detail: e?.detail ?? null,
      hint: e?.hint ?? null,
      position: e?.position ?? null,
      constraint: e?.constraint ?? null,
      table: e?.table ?? null,
      column: e?.column ?? null,
    });
    const status = Number(e?.status ?? e?.statusCode ?? 500);

    // More precise messages for common DB errors
    const msg =
      e?.code === "23505"
        ? "SKU sau slug deja există."
        : e?.code === "23503"
        ? "Referință invalidă (brand/categorie/TVA)."
        : e?.code === "22P02"
        ? "UUID invalid."
        : e?.message || "Eroare internă.";

    return json(
      {
        ok: false,
        error: msg,
        // Keep extra detail only for server logs / troubleshooting
        detail: {
          code: e?.code ?? null,
          constraint: e?.constraint ?? null,
          table: e?.table ?? null,
          column: e?.column ?? null,
        },
      },
      status >= 400 && status <= 599 ? status : 500
    );
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    await requireAdmin(req);
  } catch (e: any) {
    const status = Number(e?.status ?? e?.statusCode ?? (e instanceof ApiError ? e.status : 403));
    return json({ ok: false, error: e?.message || "Acces interzis." }, status);
  }
  const id = await getId(ctx);

  try {
    const rows =
      await sql`DELETE FROM product WHERE id = ${id}::uuid RETURNING id`;
    const deleted = (rows as any[])?.[0]?.id;
    if (!deleted) return json({ ok: false, error: "Produs inexistent." }, 404);

    return json({ ok: true, id: deleted });
  } catch {
    return json({ ok: false, error: "Eroare la ștergere." }, 500);
  }
}
