import { NextResponse } from "next/server";
import { requireWarehouse } from "@/lib/auth/api";
import { sql } from "@/lib/db";
// @ts-ignore — use /lib path to skip pdf-parse's test file auto-load
import pdfParse from "pdf-parse/lib/pdf-parse.js";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

/* ── Number parser supporting both RO and EN formats ── */
function parseRoNumber(s: string): number {
  const cleaned = s.replace(/\s/g, "");
  // Romanian: 1.234,56 → 1234.56 (comma as decimal, dots as thousands)
  if (/,\d{1,2}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }
  // English: 3,079.48 → 3079.48 (comma as thousands, dot as decimal)
  if (/,\d{3}/.test(cleaned) && /\.\d{1,2}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/,/g, ""));
  }
  return parseFloat(cleaned);
}

function normalizeCode(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Strip whitespace from product codes for display */
function stripCodeSpaces(s: string): string {
  return s.replace(/\s+/g, "");
}

type ParsedItem = { code: string; name: string; quantity: number; buyPrice: number };

/* ════════════════════════════════════════════════════════════════
   CSV PARSERS — most reliable, no AI needed
   ════════════════════════════════════════════════════════════════ */

/** Parse CSV with proper quote handling */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

/** Detect supplier from CSV header */
function detectCsvSupplier(
  header: string
): "inter_cars" | "ad_auto_total" | "unknown" {
  const h = header.toUpperCase();
  // Inter Cars: "Factura fiscala,Numărul activ,Numele produsului,Cantitate,..."
  if (h.includes("NUMĂRUL ACTIV") || h.includes("NUMARUL ACTIV")) return "inter_cars";
  // AD Auto Total: "NR FACTURA","NR COMANDA","DATA COMANDA",...,"DENUMIRE ARTICOL"
  if (h.includes("DENUMIRE ARTICOL") || h.includes("NR FACTURA")) return "ad_auto_total";
  return "unknown";
}

/**
 * AD Auto Total CSV:
 *   "NR FACTURA","NR COMANDA","DATA COMANDA","DATA SCADENTA","DENUMIRE ARTICOL","PRODUCATOR","CANTITATE","PRET UNITAR","VALOAREA","VALOAREA TVA","COTA TVA","VALUTA"
 *
 * DENUMIRE ARTICOL has code embedded: "CUREA TRANSMISIE CONTITECH" → first word-ish token is code
 * But in AD Auto Total, the code isn't always the first word of DENUMIRE. The PDF shows it separately.
 * CSV might not have a code column at all — use the full name as code fallback.
 *
 * Actually looking at the PDF text: "AVX13X1575CT CUREA TRANSMISIE CONTITECH" — the code IS in the name.
 * But the CSV just has "CUREA TRANSMISIE CONTITECH" without the code prefix.
 * We'll extract what we can and let the matching logic find the product.
 */
function parseAdAutoTotalCsv(lines: string[]): { items: ParsedItem[]; supplier: string } {
  const results: ParsedItem[] = [];
  const header = parseCsvLine(lines[0]);

  // Find column indices
  const iName = header.findIndex((h) => /DENUMIRE/i.test(h));
  const iQty = header.findIndex((h) => /CANTITATE/i.test(h));
  const iPrice = header.findIndex((h) => /PRET UNITAR/i.test(h));

  if (iName < 0 || iQty < 0 || iPrice < 0) return { items: [], supplier: "ad_auto_total" };

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = parseCsvLine(lines[i]);
    const fullName = cells[iName] || "";
    const qty = parseRoNumber(cells[iQty] || "0");
    const price = parseRoNumber(cells[iPrice] || "0");
    if (!fullName || qty <= 0 || price <= 0) continue;

    // Try to extract code from name: first token if it looks like a part code
    const firstToken = fullName.split(/\s+/)[0];
    const looksLikeCode = /\d/.test(firstToken) && firstToken.length >= 4;
    const code = looksLikeCode ? firstToken : fullName.split(/\s+/).slice(0, 2).join(" ");
    const name = looksLikeCode ? fullName.slice(firstToken.length).trim() : fullName;

    results.push({ code: stripCodeSpaces(code), name: name || fullName, quantity: qty, buyPrice: price });
  }

  return { items: results, supplier: "ad_auto_total" };
}

/**
 * Inter Cars CSV:
 *   Factura fiscala,Numărul activ,Numele produsului,Cantitate,Pret recomandat fara TVA,Pret articol excl. TVA,Total excl. TVA,Valută,...
 *
 * "Numărul activ" = product code (may have spaces like "K 285136K50")
 * "Pret articol excl. TVA" = buy price after discount (Romanian format: "3.437,31")
 */
function parseInterCarsCsv(lines: string[]): { items: ParsedItem[]; supplier: string } {
  const results: ParsedItem[] = [];
  const header = parseCsvLine(lines[0]);

  const iCode = header.findIndex((h) => /activ/i.test(h));
  const iName = header.findIndex((h) => /Numele produsului/i.test(h));
  const iQty = header.findIndex((h) => /Cantitate/i.test(h));
  // "Pret articol excl. TVA" is the actual buy price (after discount)
  const iPrice = header.findIndex((h) => /Pret articol excl/i.test(h));

  if (iCode < 0 || iName < 0 || iQty < 0 || iPrice < 0) return { items: [], supplier: "inter_cars" };

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = parseCsvLine(lines[i]);
    const code = cells[iCode] || "";
    const name = cells[iName] || "";
    const qty = parseRoNumber(cells[iQty] || "0");
    const price = parseRoNumber(cells[iPrice] || "0");
    if (!code || qty <= 0 || price <= 0) continue;

    results.push({ code: stripCodeSpaces(code), name, quantity: qty, buyPrice: price });
  }

  return { items: results, supplier: "inter_cars" };
}

function parseCsv(text: string): { items: ParsedItem[]; supplier: string } | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;

  const supplier = detectCsvSupplier(lines[0]);
  switch (supplier) {
    case "inter_cars":
      return parseInterCarsCsv(lines);
    case "ad_auto_total":
      return parseAdAutoTotalCsv(lines);
    default:
      return null;
  }
}

/* ════════════════════════════════════════════════════════════════
   PDF TEXT PARSERS — for PDFs with embedded text (not scanned)
   ════════════════════════════════════════════════════════════════ */

/** Detect supplier from raw PDF text */
function detectSupplier(text: string): "inter_cars" | "ad_auto_total" | "unknown" {
  const upper = text.toUpperCase();
  if (upper.includes("INTER CARS")) return "inter_cars";
  if (upper.includes("AUTO TOTAL") || upper.includes("AUTOTOTAL")) return "ad_auto_total";
  return "unknown";
}

/**
 * Inter Cars PDF (pdf-parse output).
 *
 * Text comes concatenated with no spaces between columns:
 *   "1K 285136K5084812090Valva principala1BUC3,079.4825.002,309.61212,309.61"
 *   "10FE4678787083091Inel ABS1BUC60.6935.0039.452139.45"
 *   "16FE0399773181595Bolt roata10BUC12.2835.027.982179.80"
 *
 * Structure: row_num + code + tarif(8 digits) + description + qty + BUC + price + disc% + disc_price + tva% + total
 * We anchor on: 8-digit tarif vamal and BUC keyword.
 * Lines starting with "#" are alternate pricing — skip them.
 */
function parseInterCarsPdf(lines: string[]): ParsedItem[] {
  const results: ParsedItem[] = [];
  let expectedRow = 1;

  for (const line of lines) {
    if (!/\dBUC/i.test(line) || line.startsWith("#")) continue;

    // Split on BUC to separate before (code+tarif+desc+qty) and after (prices)
    const bucMatch = line.match(/^(.+?)(\d+)BUC(.+)$/i);
    if (!bucMatch) continue;

    const before = bucMatch[1];
    const qty = parseInt(bucMatch[2], 10);
    const after = bucMatch[3];
    if (qty <= 0) continue;

    // Strip the row number from "before". Row numbers are sequential (1,2,3...).
    // Try the expected row number first, then fall back to regex.
    const rowStr = String(expectedRow);
    let rest: string;
    if (before.startsWith(rowStr)) {
      rest = before.slice(rowStr.length);
    } else {
      // Fallback: row is 1-2 digits followed by a non-digit
      const rowMatch = before.match(/^(\d{1,2})([A-Za-z\s])/);
      if (rowMatch) {
        rest = before.slice(rowMatch[1].length);
      } else {
        continue;
      }
    }

    // In "rest": code + tarif(8 digits) + description
    // Use greedy match to grab the code before the last 8-digit tarif vamal
    const tarifMatch = rest.match(/^(.+)(\d{8})(.+)$/);
    if (!tarifMatch) continue;

    const code = tarifMatch[1].trim();
    const description = tarifMatch[3].trim();

    // In "after": unit_price + discount% + disc_price + tva% + total
    // Numbers use mixed formats: "3,079.48" or "25.00" or "2,309.61"
    // disc_price is the 3rd number
    const nums = [...after.matchAll(/([\d,]+\.\d{2})/g)]
      .map((n) => parseRoNumber(n[1]));

    if (nums.length >= 3) {
      const discPrice = nums[2];
      if (discPrice > 0) {
        results.push({ code: stripCodeSpaces(code), name: description, quantity: qty, buyPrice: discPrice });
        expectedRow++;
      }
    }
  }

  return results;
}

/**
 * AD Auto Total PDF (pdf-parse output).
 *
 * Text comes as:
 *   line N:   "1BUC1 38.92 38.92 8.17"       — data line (row_numBUCqty price total tva)
 *   line N+1: "AVX13X1575CT CUREA TRANSMISIE" — product code + name
 *   line N+2: "CONTITECH"                     — continuation of name (optional)
 *   line N+3: "NC=40103200"                   — tarif vamal (skip)
 *
 * NOTE: product name comes AFTER the data line in pdf-parse output.
 */
function parseAdAutoTotalPdf(lines: string[]): ParsedItem[] {
  const results: ParsedItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match data line: "1BUC1 38.92 38.92 8.17"
    const dataMatch = line.match(
      /^(\d{1,3})BUC(\d+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/i
    );
    if (!dataMatch) continue;

    const qty = parseInt(dataMatch[2], 10);
    const unitPrice = parseRoNumber(dataMatch[3]);
    if (qty <= 0 || unitPrice <= 0) continue;

    // Product code+name is on the NEXT line(s)
    let code = "";
    let name = "";
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      const next = lines[j].trim();
      // Skip NC= lines
      if (/^NC[=8]/.test(next)) continue;
      // Skip lines that are just numbers or empty
      if (!next || /^[\d.,\s]+$/.test(next)) continue;
      // First alphanumeric line after data is the product
      if (/^[A-Za-z0-9]/.test(next)) {
        if (!code) {
          // First line: code + start of name
          const spaceIdx = next.indexOf(" ");
          if (spaceIdx > 0) {
            code = next.slice(0, spaceIdx);
            name = next.slice(spaceIdx + 1).trim();
          } else {
            code = next;
          }
        } else {
          // Continuation line (e.g. "CONTITECH")
          name = (name + " " + next).trim();
          break;
        }
      }
    }

    if (code) {
      results.push({ code: stripCodeSpaces(code), name: name || code, quantity: qty, buyPrice: unitPrice });
    }
  }

  return results;
}

function parseProductLines(text: string): ParsedItem[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const supplier = detectSupplier(text);

  switch (supplier) {
    case "inter_cars":
      return parseInterCarsPdf(lines);
    case "ad_auto_total":
      return parseAdAutoTotalPdf(lines);
    default: {
      // Generic fallback — try relaxed patterns
      const results: ParsedItem[] = [];
      const relaxed =
        /([A-Za-z0-9][\w\-./]{2,})\s+(.{3,80}?)\s+(\d[\d.,]*)\s+(\d[\d.,]*)/;
      for (const line of lines) {
        const m = relaxed.exec(line);
        if (m) {
          const qty = parseRoNumber(m[3]);
          const price = parseRoNumber(m[4]);
          if (qty > 0 && price > 0) {
            results.push({ code: stripCodeSpaces(m[1].trim()), name: m[2].trim(), quantity: qty, buyPrice: price });
          }
        }
      }
      return results;
    }
  }
}

/* ════════════════════════════════════════════════════════════════
   GEMINI VISION — last resort for scanned PDFs
   ════════════════════════════════════════════════════════════════ */

async function extractWithGemini(
  pdfBase64: string
): Promise<{ items: ParsedItem[]; rawText: string } | null> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: pdfBase64,
                  },
                },
                {
                  text: `This is a Romanian supplier invoice (factura). Extract ALL product lines from the table.

For each product, return:
- code: the product/article code WITHOUT spaces (e.g. "PA1035G", "YMD630600100", "WHT000232")
- name: product description/name
- quantity: quantity ordered (number)
- buyPrice: unit price WITHOUT VAT (pretul unitar fara TVA, after any discount)

Return ONLY a JSON array, no explanation. Example:
[{"code":"PA1035G","name":"POMPA DE APA GRAF","quantity":1,"buyPrice":86.84}]

If there's a discount column (reducere/discount %), use the discounted price (pret unitar cu discount / pret unit. disc.), not the original price.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from response (may be wrapped in ```json ... ```)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      code: string;
      name: string;
      quantity: number;
      buyPrice: number;
    }>;

    if (!Array.isArray(parsed) || !parsed.length) return null;

    return {
      items: parsed
        .filter((p) => p.code && p.quantity > 0 && p.buyPrice > 0)
        .map((p) => ({ ...p, code: stripCodeSpaces(p.code) })),
      rawText: text,
    };
  } catch {
    return null;
  }
}

/* ════════════════════════════════════════════════════════════════
   PRODUCT MATCHING — find existing products by code/SKU/name
   ════════════════════════════════════════════════════════════════ */

async function matchProducts(parsedItems: ParsedItem[], supplier: string) {
  return Promise.all(
    parsedItems.map(async (item) => {
      const norm = normalizeCode(item.code);

      const found = (row: any) => ({
        ...item,
        matched: true,
        productId: row.id,
        marginPct: Number(row.profit_margin_pct ?? 74),
        existingName: row.name,
        existingSku: row.sku,
        existingBuyPrice: Number(row.buy_price_net),
        existingMarginPct: Number(row.profit_margin_pct ?? 74),
        existingStock: Number(row.stock_on_hand),
      });

      // 1) exact code_norm match (primary + equivalents)
      const exact = (await sql`
        SELECT p.id, p.sku, p.name, p.buy_price_net, p.profit_margin_pct, p.stock_on_hand
        FROM part_code pc2
        JOIN product_code j ON j.code_id::text = pc2.id::text
        JOIN product p ON p.id::text = j.product_id::text
        WHERE pc2.code_norm = ${norm}
        LIMIT 1
      `) as any[];
      if (exact.length) return found(exact[0]);

      // 2) elastic code_norm — LIKE match
      if (norm.length >= 4) {
        const elastic = (await sql`
          SELECT p.id, p.sku, p.name, p.buy_price_net, p.profit_margin_pct, p.stock_on_hand
          FROM part_code pc2
          JOIN product_code j ON j.code_id::text = pc2.id::text
          JOIN product p ON p.id::text = j.product_id::text
          WHERE pc2.code_norm LIKE ${`%${norm}%`}
             OR ${norm} LIKE '%' || pc2.code_norm || '%'
          LIMIT 1
        `) as any[];
        if (elastic.length) return found(elastic[0]);
      }

      // 3) SKU match
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
        marginPct: 74,
        productId: null,
        existingName: null,
        existingSku: null,
        existingBuyPrice: null,
        existingMarginPct: null,
        existingStock: null,
      };
    })
  );
}

/* ════════════════════════════════════════════════════════════════
   ROUTE HANDLER
   ════════════════════════════════════════════════════════════════ */

const ACCEPTED_TYPES = [
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",       // some browsers send this for CSV
  "application/octet-stream",        // generic fallback
];

export async function POST(req: Request) {
  try {
    await requireWarehouse(req);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return json({ error: "Încarcă un fișier PDF sau CSV." }, 400);
    }
    if (file.size > 20 * 1024 * 1024) {
      return json({ error: "Fișierul depășește 20 MB." }, 400);
    }

    const fileName = file.name.toLowerCase();
    const isCsv = fileName.endsWith(".csv");
    const isPdf = fileName.endsWith(".pdf") || file.type === "application/pdf";

    if (!isCsv && !isPdf) {
      return json({ error: "Încarcă un fișier PDF sau CSV." }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    /* ── CSV path ── */
    if (isCsv) {
      // Try UTF-8, fall back to latin1
      let text = buffer.toString("utf-8");
      // Remove BOM
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

      const result = parseCsv(text);
      if (!result || !result.items.length) {
        return json({
          ok: true,
          items: [],
          supplier: result?.supplier || "unknown",
          rawText: text.slice(0, 5000),
          message: "Nu am găsit produse în CSV. Verifică formatul fișierului.",
        });
      }

      const enriched = await matchProducts(result.items, result.supplier);
      return json({ ok: true, items: enriched, supplier: result.supplier, rawText: text.slice(0, 5000) });
    }

    /* ── PDF path ── */
    // Step 1: Try pdf-parse (text-based PDFs)
    let pdfText = "";
    try {
      const parsed = await pdfParse(buffer);
      pdfText = parsed.text || "";
    } catch {
      // pdf-parse can fail on some PDFs, continue
    }

    // Step 2: If we got meaningful text, parse it with regex
    if (pdfText && pdfText.trim().length >= 30) {
      const supplier = detectSupplier(pdfText);
      const parsedItems = parseProductLines(pdfText);

      if (parsedItems.length) {
        const enriched = await matchProducts(parsedItems, supplier);
        return json({ ok: true, items: enriched, supplier, rawText: pdfText.slice(0, 5000) });
      }
    }

    // Step 3: Last resort — Gemini vision (for scanned PDFs or when regex failed)
    const pdfBase64 = buffer.toString("base64");
    const geminiResult = await extractWithGemini(pdfBase64);
    if (geminiResult && geminiResult.items.length) {
      const supplier = detectSupplier(geminiResult.rawText) || "unknown";
      const enriched = await matchProducts(geminiResult.items, supplier);
      return json({ ok: true, items: enriched, supplier, rawText: geminiResult.rawText.slice(0, 5000) });
    }

    // Nothing worked
    return json({
      ok: true,
      items: [],
      supplier: detectSupplier(pdfText),
      rawText: pdfText.slice(0, 5000),
      message: "Nu am găsit produse în document. Textul extras este inclus pentru verificare manuală.",
    });

  } catch (e: any) {
    console.error("[receptie-marfa/parse] Unhandled error:", e);
    return json({ error: "Eroare internă: " + (e.message || "necunoscută") }, 500);
  }
}
