import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/api";

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
  await requireAdmin(req);

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  // convert empty string to null so ::uuid never sees ""
  const categoryIdRaw = (searchParams.get("categoryId") || "").trim();
  const categoryId = categoryIdRaw ? categoryIdRaw : null;

  const brandIdRaw = (searchParams.get("brandId") || "").trim();
  const brandId = brandIdRaw ? brandIdRaw : null;

  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);
  const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

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
      COALESCE(b.name, '') AS brand_name,
      COALESCE(c.name, '') AS category_name,
      (
        p.buy_price_net *
        (1 + (p.profit_margin_pct / 100.0)) *
        (1 + COALESCE(tr.rate, 0))
      )::numeric(12,2) AS price_gross,
      pc_primary.code_norm AS primary_code,
      COALESCE(pc_stats.equivalents_count, 0)::int AS equivalents_count
    FROM product p
    LEFT JOIN brand b ON b.id = p.brand_id
    LEFT JOIN category c ON c.id = p.category_id
    LEFT JOIN tax_rate tr ON tr.id = p.tax_rate_id
    LEFT JOIN LATERAL (
      SELECT pc.code_norm
      FROM product_code j
      JOIN part_code pc ON pc.id = j.code_id
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

  return json({ ok: true, items: rows, limit, offset });
}

export async function POST(req: Request) {
  await requireAdmin(req);

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
  const isPrimaryFlags = uniqCodes.map((x) => x.code_norm === primaryNorm?.code_norm);

  const taxRateId = body?.tax_rate_id ? String(body.tax_rate_id).trim() : "";
  const brandId = body?.brand_id ? String(body.brand_id).trim() : null;

  const buyPriceNet = safeNum(body?.buy_price_net);
  const marginPct = safeNum(body?.profit_margin_pct ?? body?.margin_pct) ?? 0;

  const uom = body?.uom ? String(body.uom).trim() : null;

  const categoryIdOne = body?.category_id
    ? String(body.category_id).trim()
    : Array.isArray(body?.category_ids)
    ? String(body.category_ids[0] ?? "").trim() || null
    : null;

  if (!sku || sku.length < 2) return json({ ok: false, error: "SKU invalid." }, 400);
  if (!name || name.length < 2) return json({ ok: false, error: "Numele este obligatoriu." }, 400);
  if (!slug) return json({ ok: false, error: "Slug invalid." }, 400);
  if (!taxRateId) return json({ ok: false, error: "Selectează TVA." }, 400);
  if (!categoryIdOne) return json({ ok: false, error: "Selectează categorie." }, 400);
  if (!primaryNorm) return json({ ok: false, error: "Codul principal este obligatoriu." }, 400);
  if (buyPriceNet == null || buyPriceNet < 0) return json({ ok: false, error: "Preț achiziție (fără TVA) invalid." }, 400);
  if (marginPct < 0) return json({ ok: false, error: "Marjă (%) invalidă (>= 0)." }, 400);

  try {
    const rows = await sql`
      WITH p AS (
        INSERT INTO product (
          sku, slug, name,
          brand_id, tax_rate_id, category_id,
          buy_price_net, profit_margin_pct,
          uom,
          is_active
        )
        VALUES (
          ${sku}, ${slug}, ${name},
          ${brandId}::uuid, ${taxRateId}::uuid, ${categoryIdOne}::uuid,
          ${buyPriceNet}, ${marginPct},
          ${uom && uom.trim() ? uom.trim() : 'buc'},
          ${isActive}
        )
        RETURNING id
      ),
      input AS (
        SELECT *
        FROM unnest(
          ${codeRaws}::text[],
          ${codeNorms}::text[],
          ${isPrimaryFlags}::boolean[]
        ) AS t(code_raw, code_norm, is_primary)
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

    const id = (rows as any[])?.[0]?.id;
    if (!id) return json({ ok: false, error: "Eroare la creare produs." }, 500);

    return json({ ok: true, id });
  } catch (e: any) {
    const msg = e?.code === "23505" ? "SKU sau slug deja există." : "Eroare internă.";
    return json({ ok: false, error: msg }, 500);
  }
}
