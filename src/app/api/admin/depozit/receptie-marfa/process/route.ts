import { NextResponse } from "next/server";
import { requireWarehouse } from "@/lib/auth/api";
import { sql } from "@/lib/db";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function normalizePartCode(raw: string) {
  const code_raw = raw.trim();
  const code_norm = code_raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!code_norm) return null;
  return { code_raw, code_norm };
}

type ItemInput = {
  productId: string | null;
  code: string;
  name: string;
  quantity: number;
  buyPrice: number;
  marginPct: number;
};

export async function POST(req: Request) {
  const user = await requireWarehouse(req);

  const body = await req.json().catch(() => null);
  const items: ItemInput[] = body?.items;
  const warehouseId = String(body?.warehouseId ?? "").trim() || null;
  const documentNumber = String(body?.documentNumber ?? "").trim() || null;
  const supplierName = String(body?.supplierName ?? "").trim() || null;
  const note = String(body?.note ?? "").trim() || null;
  const source: string = body?.source === "pdf" ? "pdf" : "manual";

  if (!Array.isArray(items) || !items.length) {
    return json({ error: "Niciun produs de procesat." }, 400);
  }
  if (!warehouseId) {
    return json({ error: "Selectează un depozit." }, 400);
  }

  // Create the receipt header
  const receiptRows = (await sql`
    INSERT INTO goods_receipt (document_number, supplier_name, note, source, uploaded_by)
    VALUES (${documentNumber}, ${supplierName}, ${note}, ${source}, ${user.userId}::uuid)
    RETURNING id
  `) as any[];

  const receiptId = receiptRows[0]?.id;

  const results: Array<{
    code: string;
    name: string;
    action: "updated" | "created";
    productId: string;
    newStock: number;
    buyPrice: number;
    marginPct: number;
  }> = [];

  for (const item of items) {
    const qty = Number(item.quantity);
    const price = Number(item.buyPrice);
    const margin = Number(item.marginPct ?? 30);

    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!Number.isFinite(price) || price < 0) continue;

    let action: "updated" | "created";
    let productId: string;
    let newStock: number;

    if (item.productId) {
      // ── UPDATE existing product ──
      await sql`
        UPDATE product
        SET buy_price_net = ${price},
            profit_margin_pct = ${margin},
            stock_on_hand = stock_on_hand + ${qty},
            updated_at = now()
        WHERE id = ${item.productId}::uuid
      `;

      const rows = (await sql`
        SELECT stock_on_hand FROM product WHERE id = ${item.productId}::uuid
      `) as any[];

      productId = item.productId;
      newStock = Number(rows[0]?.stock_on_hand ?? qty);
      action = "updated";
    } else {
      // ── CREATE new product ──
      const sku = item.code.trim();
      const name = item.name.trim() || sku;
      const slug = slugify(name) || slugify(sku);

      const taxRows = (await sql`
        SELECT id FROM tax_rate ORDER BY rate DESC LIMIT 1
      `) as any[];
      const taxRateId = taxRows[0]?.id ?? null;

      const inserted = (await sql`
        INSERT INTO product (sku, slug, name, buy_price_net, profit_margin_pct, stock_on_hand, is_active, tax_rate_id, created_by_user_id, uom)
        VALUES (${sku}, ${slug}, ${name}, ${price}, ${margin}, ${qty}, true, ${taxRateId}::uuid, ${user.userId}::uuid, 'buc')
        ON CONFLICT (sku) DO UPDATE SET
          buy_price_net = ${price},
          stock_on_hand = product.stock_on_hand + ${qty},
          updated_at = now()
        RETURNING id, stock_on_hand
      `) as any[];

      productId = inserted[0]?.id ?? "";
      newStock = Number(inserted[0]?.stock_on_hand ?? qty);
      action = inserted[0] ? "created" : "updated";

      // Link part_code
      if (productId) {
        const norm = normalizePartCode(sku);
        if (norm) {
          await sql`
            INSERT INTO part_code (code_raw, code_norm)
            VALUES (${norm.code_raw}, ${norm.code_norm})
            ON CONFLICT (code_norm) DO NOTHING
          `;
          const codeRow = (await sql`
            SELECT id FROM part_code WHERE code_norm = ${norm.code_norm} LIMIT 1
          `) as any[];
          if (codeRow.length) {
            await sql`
              INSERT INTO product_code (product_id, code_id, is_primary, code_kind)
              VALUES (${productId}::uuid, ${codeRow[0].id}::uuid, true, 'PRIMARY')
              ON CONFLICT (product_id, code_id) DO NOTHING
            `;
          }
        }
      }
    }

    // Update warehouse-level inventory
    if (productId && warehouseId) {
      await sql`
        INSERT INTO inventory_balance (warehouse_id, product_id, stock_on_hand, stock_reserved)
        VALUES (${warehouseId}::uuid, ${productId}::uuid, ${qty}, 0)
        ON CONFLICT (warehouse_id, product_id)
        DO UPDATE SET
          stock_on_hand = inventory_balance.stock_on_hand + ${qty},
          updated_at = now()
      `;
    }

    // Save line item
    if (receiptId) {
      await sql`
        INSERT INTO goods_receipt_item (receipt_id, product_id, code, name, quantity, buy_price, action)
        VALUES (${receiptId}::uuid, ${productId}::uuid, ${item.code}, ${item.name}, ${qty}, ${price}, ${action})
      `;
    }

    results.push({
      code: item.code,
      name: item.name,
      action,
      productId,
      newStock,
      buyPrice: price,
      marginPct: margin,
    });
  }

  return json({ ok: true, receiptId, results });
}
