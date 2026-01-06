import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function normalizeCode(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

export async function GET(req: Request) {
  await requireAdmin(req);

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? 20), 1),
    50
  );

  if (q.length < 2) return json({ ok: true, items: [] });

  const qLike = `%${q}%`;
  const qNorm = normalizeCode(q);
  const qNormLike = `%${qNorm}%`;

  const rows = await sql`
    WITH vat AS (
      SELECT
        tr.id,
        tr.rate,
        CASE
          WHEN tr.rate IS NULL THEN 0.0
          WHEN tr.rate <= 1 THEN tr.rate
          ELSE tr.rate / 100.0
        END AS vat_frac,
        CASE
          WHEN tr.rate IS NULL THEN 0.0
          WHEN tr.rate <= 1 THEN tr.rate * 100.0
          ELSE tr.rate
        END AS vat_percent
      FROM tax_rate tr
    ),
    base AS (
      SELECT
        p.id,
        p.name,
        p.sku,
        p.slug,
        b.name AS brand_name,

        p.is_active,

        p.price_gross AS price_gross_db,
        p.buy_price_net,
        p.margin_pct,

        p.code,
        p.code_normalized,
        p.external_code,

        v.vat_frac,
        v.vat_percent
      FROM product p
      LEFT JOIN brand b ON b.id = p.brand_id
      LEFT JOIN vat v ON v.id = p.tax_rate_id
      WHERE p.is_active = true
    ),
    scored AS (
      SELECT
        b.*,

        -- normalize internal/external codes safely even if code_normalized is NULL
        COALESCE(NULLIF(b.code_normalized, ''), regexp_replace(lower(COALESCE(b.code, '')), '[^a-z0-9]', '', 'g')) AS code_norm,
        regexp_replace(lower(COALESCE(b.external_code, '')), '[^a-z0-9]', '', 'g') AS ext_code_norm,

        -- best equivalence match score from product_code (if any)
        COALESCE(pc_hit.code_score, 0) AS eq_code_score,

        -- internal/external code score
        CASE
          WHEN COALESCE(NULLIF(b.code_normalized, ''), regexp_replace(lower(COALESCE(b.code, '')), '[^a-z0-9]', '', 'g')) = ${qNorm} THEN 9
          WHEN COALESCE(NULLIF(b.code_normalized, ''), regexp_replace(lower(COALESCE(b.code, '')), '[^a-z0-9]', '', 'g')) ILIKE ${qNormLike} THEN 6
          WHEN b.code ILIKE ${qLike} THEN 4
          WHEN regexp_replace(lower(COALESCE(b.external_code, '')), '[^a-z0-9]', '', 'g') = ${qNorm} THEN 8
          WHEN regexp_replace(lower(COALESCE(b.external_code, '')), '[^a-z0-9]', '', 'g') ILIKE ${qNormLike} THEN 5
          WHEN b.external_code ILIKE ${qLike} THEN 3
          ELSE 0
        END AS own_code_score,

        -- text score
        (
          CASE
            WHEN b.sku ILIKE ${qLike} THEN 4
            WHEN b.name ILIKE ${qLike} THEN 3
            WHEN b.slug ILIKE ${qLike} THEN 2
            ELSE 0
          END
        ) AS text_score

      FROM base b

      LEFT JOIN LATERAL (
        SELECT
          CASE
            WHEN pc.code_normalized = ${qNorm} THEN 10
            WHEN pc.code_normalized ILIKE ${qNormLike} THEN 7
            WHEN pc.code ILIKE ${qLike} THEN 5
            ELSE 0
          END AS code_score
        FROM product_code pc
        WHERE pc.product_id = b.id
          AND (
            pc.code_normalized = ${qNorm}
            OR pc.code_normalized ILIKE ${qNormLike}
            OR pc.code ILIKE ${qLike}
          )
        ORDER BY code_score DESC
        LIMIT 1
      ) pc_hit ON true

      WHERE
        -- text hits
        (b.name ILIKE ${qLike} OR b.sku ILIKE ${qLike} OR b.slug ILIKE ${qLike})
        -- internal/external code hits
        OR (COALESCE(NULLIF(b.code_normalized, ''), regexp_replace(lower(COALESCE(b.code, '')), '[^a-z0-9]', '', 'g')) = ${qNorm})
        OR (COALESCE(NULLIF(b.code_normalized, ''), regexp_replace(lower(COALESCE(b.code, '')), '[^a-z0-9]', '', 'g')) ILIKE ${qNormLike})
        OR (regexp_replace(lower(COALESCE(b.external_code, '')), '[^a-z0-9]', '', 'g') = ${qNorm})
        OR (regexp_replace(lower(COALESCE(b.external_code, '')), '[^a-z0-9]', '', 'g') ILIKE ${qNormLike})
        OR (b.code ILIKE ${qLike})
        OR (b.external_code ILIKE ${qLike})
        -- equivalence hits (via LATERAL)
        OR (pc_hit.code_score IS NOT NULL AND pc_hit.code_score > 0)
    ),
    priced AS (
      SELECT
        s.id,
        s.name,
        s.sku,
        s.slug,
        s.brand_name,
        s.vat_percent,

        -- SELL NET = buy_price_net * (1 + margin_pct/100), rounded UP to 2 decimals
        CASE
          WHEN s.buy_price_net IS NOT NULL AND s.margin_pct IS NOT NULL THEN
            CEIL( (s.buy_price_net * (1 + (s.margin_pct / 100.0))) * 100.0 ) / 100.0
          ELSE
            -- fallback: derive net from DB gross if needed
            CASE
              WHEN s.price_gross_db IS NOT NULL THEN ROUND(s.price_gross_db / (1 + COALESCE(s.vat_frac, 0.0)), 2)
              ELSE 0
            END
        END AS price_net,

        -- optional: computed gross from net + VAT (2 decimals)
        CASE
          WHEN s.buy_price_net IS NOT NULL AND s.margin_pct IS NOT NULL THEN
            ROUND(
              (CEIL( (s.buy_price_net * (1 + (s.margin_pct / 100.0))) * 100.0 ) / 100.0)
              * (1 + COALESCE(s.vat_frac, 0.0)),
              2
            )
          ELSE s.price_gross_db
        END AS price_gross,

        GREATEST(s.eq_code_score, s.own_code_score) AS code_score,
        s.text_score
      FROM scored s
    )
    SELECT
      id,
      name,
      sku,
      slug,
      brand_name,
      price_net AS price,
      price_gross,
      vat_percent
    FROM priced
    ORDER BY code_score DESC, text_score DESC, name ASC
    LIMIT ${limit}
  `;

  return json({ ok: true, items: rows });
}
