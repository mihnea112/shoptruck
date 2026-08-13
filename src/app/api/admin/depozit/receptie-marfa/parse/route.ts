import { NextResponse } from "next/server";
import { requireWarehouse } from "@/lib/auth/api";
import { sql } from "@/lib/db";
// @ts-ignore — pdf-parse has no types
import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as any).default || pdfParseModule;

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

/* ── Romanian-format number parser ── */
function parseRoNumber(s: string): number {
  const cleaned = s.replace(/\s/g, "");
  // 1.234,56 → 1234.56
  if (/,\d{1,2}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }
  return parseFloat(cleaned);
}

function normalizeCode(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Heuristic parser for Romanian supplier invoices / goods receipts.
 *
 * Looks for table rows with patterns like:
 *   CODE   DENUMIRE   UM   CANT   PRET   VALOARE
 *
 * Also tries tab/multi-space separated values.
 */
function parseProductLines(text: string) {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const results: Array<{
    code: string;
    name: string;
    quantity: number;
    buyPrice: number;
  }> = [];

  // Strategy 1: strict pattern — code, description, numbers
  //   Matches: CODE_LIKE   Some product name   buc   10   45.50   455.00
  const strict =
    /^([A-Za-z0-9][\w\-./]{2,})\s{2,}(.+?)\s{2,}(?:\S{1,5}\s{2,})?(\d[\d.,]*)\s{2,}(\d[\d.,]*)/;

  for (const line of lines) {
    const m = strict.exec(line);
    if (m) {
      const qty = parseRoNumber(m[3]);
      const price = parseRoNumber(m[4]);
      if (qty > 0 && price > 0) {
        results.push({ code: m[1].trim(), name: m[2].trim(), quantity: qty, buyPrice: price });
      }
    }
  }

  if (results.length) return results;

  // Strategy 2: tab-separated (common in PDF table extraction)
  for (const line of lines) {
    const cells = line.split(/\t+/).map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 4) {
      const codeCandidate = cells[0];
      if (/^[A-Za-z0-9][\w\-./]{2,}$/.test(codeCandidate)) {
        const nums = cells.slice(2).map(parseRoNumber).filter((n) => n > 0 && Number.isFinite(n));
        if (nums.length >= 2) {
          results.push({
            code: codeCandidate,
            name: cells[1],
            quantity: nums[0],
            buyPrice: nums[1],
          });
        }
      }
    }
  }

  if (results.length) return results;

  // Strategy 3: relaxed — scan for code-like + numbers anywhere on the line
  const relaxed =
    /([A-Za-z0-9][\w\-./]{2,})\s+(.{3,80}?)\s+(\d[\d.,]*)\s+(\d[\d.,]*)/;
  for (const line of lines) {
    const m = relaxed.exec(line);
    if (m) {
      const qty = parseRoNumber(m[3]);
      const price = parseRoNumber(m[4]);
      if (qty > 0 && price > 0) {
        results.push({ code: m[1].trim(), name: m[2].trim(), quantity: qty, buyPrice: price });
      }
    }
  }

  return results;
}

export async function POST(req: Request) {
  await requireWarehouse(req);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.type !== "application/pdf") {
    return json({ error: "Încarcă un fișier PDF valid." }, 400);
  }
  if (file.size > 20 * 1024 * 1024) {
    return json({ error: "Fișierul depășește 20 MB." }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let pdfText: string;
  try {
    const parsed = await pdfParse(buffer);
    pdfText = parsed.text || "";
  } catch (e: any) {
    return json({ error: "Nu am putut citi PDF-ul: " + (e.message || "format invalid.") }, 400);
  }

  if (!pdfText || pdfText.trim().length < 10) {
    return json({
      error:
        "Nu am putut extrage text din PDF. Verifică dacă documentul conține text selectabil (nu este scanat ca imagine).",
      rawText: pdfText?.slice(0, 500) || "",
    }, 400);
  }

  const parsedItems = parseProductLines(pdfText);

  if (!parsedItems.length) {
    return json({
      ok: true,
      items: [],
      rawText: pdfText.slice(0, 5000),
      message:
        "Nu am găsit produse în document. Textul extras este inclus pentru verificare manuală.",
    });
  }

  // Match each code against existing products (including equivalents, elastic)
  const enriched = await Promise.all(
    parsedItems.map(async (item) => {
      const norm = normalizeCode(item.code);

      const found = (row: any) => ({
        ...item,
        matched: true,
        productId: row.id,
        marginPct: Number(row.profit_margin_pct ?? 30),
        existingName: row.name,
        existingSku: row.sku,
        existingBuyPrice: Number(row.buy_price_net),
        existingMarginPct: Number(row.profit_margin_pct ?? 30),
        existingStock: Number(row.stock_on_hand),
      });

      // 1) exact code_norm match (primary + equivalents)
      const exact = (await sql`
        SELECT p.id, p.sku, p.name, p.buy_price_net, p.profit_margin_pct, p.stock_on_hand
        FROM part_code pc2
        JOIN product_code j ON j.code_id = pc2.id
        JOIN product p ON p.id = j.product_id
        WHERE pc2.code_norm = ${norm}
        LIMIT 1
      `) as any[];
      if (exact.length) return found(exact[0]);

      // 2) elastic code_norm — LIKE match (handles partial overlaps)
      if (norm.length >= 4) {
        const elastic = (await sql`
          SELECT p.id, p.sku, p.name, p.buy_price_net, p.profit_margin_pct, p.stock_on_hand
          FROM part_code pc2
          JOIN product_code j ON j.code_id = pc2.id
          JOIN product p ON p.id = j.product_id
          WHERE pc2.code_norm LIKE ${`%${norm}%`}
             OR ${norm} LIKE '%' || pc2.code_norm || '%'
          LIMIT 1
        `) as any[];
        if (elastic.length) return found(elastic[0]);
      }

      // 3) SKU match (case-insensitive, elastic)
      const bySku = (await sql`
        SELECT id, sku, name, buy_price_net, profit_margin_pct, stock_on_hand
        FROM product
        WHERE LOWER(REPLACE(REPLACE(REPLACE(sku, '.', ''), '-', ''), ' ', ''))
            = ${norm}
        LIMIT 1
      `) as any[];
      if (bySku.length) return found(bySku[0]);

      // 4) name match (fuzzy)
      if (item.name.length >= 5) {
        const byName = (await sql`
          SELECT id, sku, name, buy_price_net, profit_margin_pct, stock_on_hand
          FROM product WHERE name ILIKE ${`%${item.name}%`} LIMIT 1
        `) as any[];
        if (byName.length) return found(byName[0]);
      }

      return {
        ...item,
        matched: false,
        marginPct: 30,
        productId: null,
        existingName: null,
        existingSku: null,
        existingBuyPrice: null,
        existingMarginPct: null,
        existingStock: null,
      };
    })
  );

  return json({ ok: true, items: enriched, rawText: pdfText.slice(0, 5000) });
}
