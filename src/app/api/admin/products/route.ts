import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/auth/api";

function pickPgError(e: any) {
  return {
    name: e?.name,
    code: e?.code,
    message: e?.message,
    detail: e?.detail,
    hint: e?.hint,
    position: e?.position,
    where: e?.where,
    schema: e?.schema,
    table: e?.table,
    column: e?.column,
    constraint: e?.constraint,
    routine: e?.routine,
    severity: e?.severity,
    status: e?.status,
  };
}

function debugLog(msg: string, data?: any) {
  // Keep logs structured and safe (no credentials, no full body dumps)
  try {
    console.log(`[${new Date().toISOString()}] [${msg}]`, data ?? "");
  } catch {
    // noop
  }
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function safeNum(v: any) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizePartCode(raw: string) {
  const code_raw = String(raw ?? "").trim();
  if (!code_raw) return null;
  const code_norm = code_raw
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[-_.]/g, "");
  return code_norm ? { code_raw, code_norm } : null;
}

function uniqueByNorm(list: Array<{ code_raw: string; code_norm: string }>) {
  const m = new Map<string, { code_raw: string; code_norm: string }>();
  for (const x of list) {
    if (!m.has(x.code_norm)) m.set(x.code_norm, x);
  }
  return Array.from(m.values());
}

function parseEquivalentCodes(body: any): string[] {
  // Support multiple payload shapes from different UIs
  const v =
    body?.equivalent_codes ??
    body?.equivalentCodes ??
    body?.equivalent_codes_text ??
    body?.equivalentCodesText ??
    body?.equiv_codes ??
    body?.equivCodes ??
    body?.codes_equivalent ??
    body?.codes;

  // Accept array form:
  // - ["A001", "B-002"]
  // - [{code: "A001"}, {value: "B-002"}]
  if (Array.isArray(v)) {
    return v
      .map((x: any) => {
        if (x == null) return "";
        if (typeof x === "string" || typeof x === "number") return String(x).trim();
        if (typeof x === "object") {
          const c = x.code ?? x.value ?? x.label ?? "";
          return String(c).trim();
        }
        return String(x).trim();
      })
      .filter(Boolean);
  }

  // Accept string form: "A001, B-002\nC003" (comma/semicolon/newline/tab separated)
  if (typeof v === "string") {
    return v
      .split(/[\n\r\t,;]+/g)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  // Accept single field fallbacks
  if (body?.equivalent_code != null) {
    const s = String(body.equivalent_code ?? "").trim();
    return s ? [s] : [];
  }
  if (body?.equivalentCode != null) {
    const s = String(body.equivalentCode ?? "").trim();
    return s ? [s] : [];
  }

  return [];
}

export async function GET(req: Request) {
  try {
    debugLog("api/admin/products GET", { url: req.url, method: "GET" });
    // Allow read access for ADMIN and SALES_REP
    const me = await requireStaff(req, ["admin", "sales_rep"]);
    debugLog("api/admin/products GET auth ok", { user_id: (me as any)?.userId });

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    // convert empty string to null so ::uuid never sees ""
    const categoryIdRaw = (searchParams.get("categoryId") || "").trim();
    const categoryId = categoryIdRaw ? categoryIdRaw : null;

    const brandIdRaw = (searchParams.get("brandId") || "").trim();
    const brandId = brandIdRaw ? brandIdRaw : null;

    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 50), 1),
      200
    );
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    debugLog("api/admin/products GET query", {
      q_len: q.length,
      has_category: !!categoryId,
      has_brand: !!brandId,
      limit,
      offset,
    });

    const rows = await sql`
      SELECT
        p.id,
        p.sku,
        p.slug,
        p.name,
        p.buy_price_net,
        p.profit_margin_pct,
        p.is_active,
        p.brand_id,
        p.category_id,
        p.tax_rate_id,
        p.uom,
        p.stock_on_hand,
        p.stock_reserved,
        p.created_by_user_id,
        COALESCE(pr_creator.email, '') AS created_by_email,
        COALESCE(pr_creator.full_name, '') AS created_by_name,
        COALESCE(b.name, '') AS brand_name,
        COALESCE(c.name, '') AS category_name,
        (
          p.buy_price_net *
          (1 + (p.profit_margin_pct / 100.0)) *
          (1 + COALESCE(tr.rate, 0))
        )::numeric(12,2) AS price_gross,
        pc_primary.code_id AS primary_code,
        COALESCE(pc_stats.equivalents_count, 0)::int AS equivalents_count
      FROM product p
      LEFT JOIN brand b ON b.id = p.brand_id
      LEFT JOIN category c ON c.id = p.category_id
      LEFT JOIN tax_rate tr ON tr.id = p.tax_rate_id
      LEFT JOIN profile pr_creator ON pr_creator.user_id = p.created_by_user_id
      LEFT JOIN LATERAL (
        SELECT j.code_id
        FROM product_code j
        WHERE j.product_id = p.id AND j.is_primary = true
        LIMIT 1
      ) pc_primary ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS equivalents_count
        FROM product_code j
        WHERE j.product_id = p.id AND j.is_primary = false
      ) pc_stats ON true
      WHERE
        (${q} = '' OR p.name ILIKE '%' || ${q} || '%' OR p.sku ILIKE '%' || ${q} || '%' OR p.slug ILIKE '%' || ${q} || '%')
        AND (
          ${categoryId}::uuid IS NULL
          OR p.category_id = ${categoryId}::uuid
        )
        AND (
          ${brandId}::uuid IS NULL
          OR p.brand_id = ${brandId}::uuid
        )
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    debugLog("api/admin/products GET ok", {
      user_id: (me as any)?.userId,
      count: Array.isArray(rows) ? rows.length : null,
    });

    return json({ ok: true, items: rows, limit, offset });
  } catch (e: any) {
    debugLog("api/admin/products GET failed", {
      url: req.url,
      method: "GET",
      error: pickPgError(e),
      stack: e?.stack,
    });
    const status = Number(e?.status ?? e?.statusCode ?? 500);
    const msg = e?.message || "Eroare internă.";
    return json({ ok: false, error: msg }, status >= 400 && status <= 599 ? status : 500);
  }
}

export async function POST(req: Request) {
  let me: any = null;
  try {
    me = await requireAdmin(req);
    debugLog("api/admin/products POST auth ok", { user_id: me?.userId });
  } catch (e: any) {
    debugLog("api/admin/products POST auth failed", { error: pickPgError(e), stack: e?.stack });
    const status = Number(e?.status ?? e?.statusCode ?? 403);
    return json({ ok: false, error: e?.message || "Acces interzis." }, status);
  }

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

  // codes (new DB structure)
  const primaryRaw = String(body?.primary_code ?? body?.code ?? "").trim();
  const primaryNorm = normalizePartCode(primaryRaw);

  const eqArr = parseEquivalentCodes(body);

  const allNormalized = [
    ...(primaryNorm ? [primaryNorm] : []),
    ...(eqArr
      .map((x) => normalizePartCode(x))
      .filter(Boolean) as Array<{ code_raw: string; code_norm: string }>),
  ];

  const uniqCodes = uniqueByNorm(allNormalized);
  const codeRaws = uniqCodes.map((x) => x.code_raw);
  const codeNorms = uniqCodes.map((x) => x.code_norm);

  // NOTE: We intentionally DO NOT pass a boolean[] into SQL.
  // Some drivers bind boolean arrays inconsistently and can cause:
  // "cannot cast type boolean to boolean[]".
  // Instead, we compute `is_primary` in SQL by comparing `code_norm` to the primary code.
  const primaryNormValue = primaryNorm?.code_norm ?? null;

  const taxRateId = body?.tax_rate_id ? String(body.tax_rate_id).trim() : "";
  const brandId = body?.brand_id ? String(body.brand_id).trim() : null;

  const buyPriceNet = safeNum(body?.buy_price_net);
  const marginPct = safeNum(body?.profit_margin_pct ?? body?.margin_pct) ?? 0;
  // Manual stock edit (admin can set on-hand; reserved is managed by orders)
  const stockOnHand = safeNum(body?.stock_on_hand ?? body?.stockOnHand ?? body?.stock);

  const uom = body?.uom ? String(body.uom).trim() : null;

  const categoryIdOne = body?.category_id
    ? String(body.category_id).trim()
    : Array.isArray(body?.category_ids)
    ? String(body.category_ids[0] ?? "").trim() || null
    : null;

  debugLog("api/admin/products POST payload", {
    user_id: me?.userId,
    sku,
    slug,
    name_len: name.length,
    brand_id: brandId,
    category_id: categoryIdOne,
    tax_rate_id: taxRateId,
    codes_count: uniqCodes.length,
    has_primary: !!primaryNorm,
    buy_price_net: buyPriceNet,
    profit_margin_pct: marginPct,
    stock_on_hand: stockOnHand,
  });

  if (!sku || sku.length < 2) return json({ ok: false, error: "SKU invalid." }, 400);
  if (!name || name.length < 2) return json({ ok: false, error: "Numele este obligatoriu." }, 400);
  if (!slug) return json({ ok: false, error: "Slug invalid." }, 400);
  if (!taxRateId) return json({ ok: false, error: "Selectează TVA." }, 400);
  if (!categoryIdOne) return json({ ok: false, error: "Selectează categorie." }, 400);
  if (!primaryNorm) return json({ ok: false, error: "Codul principal este obligatoriu." }, 400);
  if (buyPriceNet == null || buyPriceNet < 0) return json({ ok: false, error: "Preț achiziție (fără TVA) invalid." }, 400);
  if (stockOnHand != null && stockOnHand < 0) return json({ ok: false, error: "Stoc invalid (>= 0)." }, 400);
  if (marginPct < 0) return json({ ok: false, error: "Marjă (%) invalidă (>= 0)." }, 400);

  try {
    const rows = await sql`
      WITH p AS (
        INSERT INTO product (
          sku, slug, name,
          created_by_user_id,
          brand_id, tax_rate_id, category_id,
          buy_price_net, profit_margin_pct,
          uom,
          stock_on_hand,
          is_active
        )
        VALUES (
          ${sku}, ${slug}, ${name},
          ${me?.userId ?? null}::uuid,
          ${brandId}::uuid, ${taxRateId}::uuid, ${categoryIdOne}::uuid,
          ${buyPriceNet}, ${marginPct},
          ${uom && uom.trim() ? uom.trim() : 'buc'},
          ${stockOnHand == null ? 0 : stockOnHand},
          ${isActive}
        )
        RETURNING id
      ),
      input AS (
        SELECT
          t.code_raw,
          t.code_norm,
          (t.code_norm = ${primaryNormValue}) AS is_primary
        FROM unnest(
          ${codeRaws}::text[],
          ${codeNorms}::text[]
        ) AS t(code_raw, code_norm)
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
      ins AS (
        INSERT INTO product_code (product_id, code_id, is_primary, code_kind)
        SELECT
          (SELECT id FROM p),
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
      SELECT (SELECT id FROM p) AS id
    `;
    debugLog("api/admin/products POST sql ok", { returned_rows: Array.isArray(rows) ? rows.length : null, id: (rows as any[])?.[0]?.id });

    const id = (rows as any[])?.[0]?.id;
    if (!id) return json({ ok: false, error: "Eroare la creare produs." }, 500);

    return json({ ok: true, id });
  } catch (e: any) {
    debugLog("api/admin/products POST failed", {
      user_id: me?.userId,
      url: req.url,
      method: "POST",
      sku,
      slug,
      brand_id: brandId,
      category_id: categoryIdOne,
      tax_rate_id: taxRateId,
      codes_count: uniqCodes?.length,
      has_primary: !!primaryNorm,
      buy_price_net: buyPriceNet,
      profit_margin_pct: marginPct,
      stock_on_hand: stockOnHand,
      error: pickPgError(e),
      stack: e?.stack,
    });
    const msg = e?.code === "23505" ? "SKU sau slug deja există." : "Eroare internă.";
    return json({ ok: false, error: msg }, 500);
  }
}
