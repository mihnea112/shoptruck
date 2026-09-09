import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/api";
import { sql } from "@/lib/db";
import { decryptPII } from "@/lib/crypto/pii";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

/* ── Number to Romanian words ── */
const ONES = ["", "una", "doua", "trei", "patru", "cinci", "sase", "sapte", "opt", "noua"];
const TEENS = ["zece", "unsprezece", "doisprezece", "treisprezece", "paisprezece", "cincisprezece",
  "saisprezece", "saptesprezece", "optsprezece", "nouasprezece"];
const TENS = ["", "", "douazeci", "treizeci", "patruzeci", "cincizeci", "saizeci", "saptezeci", "optzeci", "nouazeci"];
const HUNDREDS = ["", "osuta", "douasute", "treisute", "patrusute", "cincisute", "saisute", "saptesute", "optsute", "nouasute"];

function numberToWords(n: number): string {
  if (n === 0) return "zero";
  const intPart = Math.floor(n);
  const decPart = Math.round((n - intPart) * 100);

  let result = "";

  if (intPart >= 1000) {
    const thousands = Math.floor(intPart / 1000);
    if (thousands === 1) result += "omie";
    else if (thousands === 2) result += "douamii";
    else result += chunkToWords(thousands) + "mii";
  }

  const remainder = intPart % 1000;
  if (remainder > 0) {
    result += chunkToWords(remainder);
  }

  if (decPart > 0) {
    result += "si" + chunkToWords(decPart) + "bani";
  }

  result += "lei";
  return result;
}

function chunkToWords(n: number): string {
  if (n === 0) return "";
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return TENS[t] + (o > 0 ? "si" + ONES[o] : "");
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return HUNDREDS[h] + (rest > 0 ? chunkToWords(rest) : "");
}

/* ── POST: create chitanta from order ── */
export async function POST(req: Request) {
  const user = await requireStaff(req, ["admin", "sales", "sales_rep"]);

  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId ?? "").trim();
  const invoiceRef = String(body?.invoiceRef ?? "").trim();
  const amountOverride = body?.amount != null ? Number(body.amount) : null;

  if (!orderId) return json({ error: "orderId este obligatoriu." }, 400);

  // Fetch order with account
  const orders = (await sql`
    SELECT
      o.id, o.account_id,
      a.display_name, a.tax_id, a.reg_no, a.email, a.phone,
      a.billing_line1, a.billing_city, a.billing_zip, a.billing_country
    FROM "order" o
    JOIN account a ON a.id = o.account_id
    WHERE o.id = ${orderId}::uuid
    LIMIT 1
  `) as any[];

  if (!orders.length) return json({ error: "Comanda nu a fost gasita." }, 404);
  const order = orders[0];

  // Compute total from order items if no override
  let amount = amountOverride;
  if (amount == null) {
    const totals = (await sql`
      SELECT COALESCE(SUM(line_net + line_tax), 0) AS total
      FROM order_item WHERE order_id = ${orderId}::uuid
    `) as any[];
    amount = Number(totals[0]?.total ?? 0);
  }

  // Generate series + number
  const year = new Date().getFullYear();
  const series = `CCCHI${year}`;

  const nextNumRows = (await sql`
    SELECT COALESCE(MAX(number), 0) + 1 AS next_num
    FROM chitanta WHERE series = ${series}
  `) as any[];
  const chitantaNumber = nextNumRows[0]?.next_num ?? 1;

  const chitantaDate = new Date().toISOString().split("T")[0];
  const amountWords = numberToWords(amount);

  // Find related invoice for "representing" field
  let representing = invoiceRef;
  if (!representing) {
    const invoices = (await sql`
      SELECT series, number FROM invoice WHERE order_id = ${orderId}::uuid
      ORDER BY created_at DESC LIMIT 1
    `) as any[];
    if (invoices.length) {
      representing = `cvf ${invoices[0].series} ${invoices[0].number}`;
    } else {
      representing = `comanda ${orderId.slice(0, 8)}`;
    }
  }

  // Insert chitanta
  const inserted = (await sql`
    INSERT INTO chitanta (
      order_id, account_id, series, number,
      chitanta_date, amount, amount_words, representing,
      created_by
    ) VALUES (
      ${orderId}::uuid, ${order.account_id}::uuid,
      ${series}, ${chitantaNumber},
      ${chitantaDate}::date, ${amount}, ${amountWords}, ${representing},
      ${user.userId}::uuid
    ) RETURNING id
  `) as any[];

  const chitantaId = inserted[0]?.id;

  return json({
    ok: true,
    chitanta: {
      id: chitantaId,
      series,
      number: chitantaNumber,
      chitantaDate,
      amount,
      amountWords,
      representing,
      customer: {
        display_name: order.display_name,
        reg_no: decryptPII(order.reg_no),
        vat_id: decryptPII(order.tax_id),
        address: decryptPII(order.billing_line1),
        city: order.billing_city,
        county: order.billing_country,
      },
    },
  });
}
