import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function errPayload(err: any) {
  // ApiError from requireStaff / auth layer
  const status = Number(err?.status ?? err?.statusCode ?? 500);

  // Postgres errors usually expose: code, detail, hint
  const code = err?.code;
  const detail = err?.detail;
  const hint = err?.hint;

  const message = String(err?.message || "Eroare internă.");

  // In dev, expose more diagnostics.
  const isDev = process.env.NODE_ENV !== "production";
  return {
    status: status >= 400 && status <= 599 ? status : 500,
    body: {
      ok: false,
      error: message,
      ...(isDev
        ? {
            debug: {
              code,
              detail,
              hint,
              stack: err?.stack,
            },
          }
        : {}),
    },
  };
}

type OfferRow = {
  id: string;
  status: string;
  created_at: string;
  valid_until: string | null;
  total_net: string | number;
  total_tax: string | number;
  total_gross: string | number;

  created_by_user_id: string | null;
  created_by_email: string | null;
  created_by_full_name: string | null;

  account_id: string;
  account_kind: "COMPANY" | "INDIVIDUAL";
  account_name: string;

  vehicle_id: string | null;
  plate_no: string | null;
  make: string | null;
  model: string | null;
};

// 1) LIST OFFERS (GET)
export async function GET(req: NextRequest) {
  try {
    await requireStaff(req, ["admin", "sales", "sales_rep"]);

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200);

    // NOTE: Offers are internal ERP docs, so we list recent first.
    // Optional search: by account name/email/phone or plate/VIN.
    const rows = (await sql`
      SELECT
        o.id,
        o.status,
        o.created_at,
        o.valid_until,
        o.total_net,
        o.total_tax,
        o.total_gross,
        o.created_by_user_id,

        a.id AS account_id,
        a.kind AS account_kind,
        a.display_name AS account_name,

        v.id AS vehicle_id,
        v.plate_no,
        v.make,
        v.model,

        p_created.email AS created_by_email,
        p_created.full_name AS created_by_full_name
      FROM offer o
      JOIN account a ON a.id = o.account_id
      LEFT JOIN vehicle v ON v.id = o.vehicle_id
      LEFT JOIN profile p_created ON p_created.user_id = o.created_by_user_id
      WHERE (
        ${q} = ''
        OR a.display_name ILIKE '%' || ${q} || '%'
        OR COALESCE(a.email,'') ILIKE '%' || ${q} || '%'
        OR COALESCE(a.phone,'') ILIKE '%' || ${q} || '%'
        OR COALESCE(v.plate_no,'') ILIKE '%' || ${q} || '%'
        OR COALESCE(v.chassis_vin,'') ILIKE '%' || ${q} || '%'
      )
      ORDER BY o.created_at DESC
      LIMIT ${limit}
    `) as any[];

    const offers = (rows || []).map((o: OfferRow) => ({
      id: o.id,
      status: o.status,
      created_at: o.created_at,
      valid_until: o.valid_until,
      total_net: Number(o.total_net ?? 0),
      total_tax: Number(o.total_tax ?? 0),
      total_gross: Number(o.total_gross ?? 0),
      created_by: o.created_by_user_id
        ? {
            user_id: o.created_by_user_id,
            email: o.created_by_email,
            full_name: o.created_by_full_name,
          }
        : null,
      account: {
        id: o.account_id,
        kind: o.account_kind,
        name: o.account_name,
      },
      vehicle:
        o.vehicle_id
          ? {
              id: o.vehicle_id,
              plate_no: o.plate_no,
              make: o.make,
              model: o.model,
              label: o.plate_no ? `${o.plate_no}${o.make || o.model ? ` (${o.make ?? ''} ${o.model ?? ''}`.trim() + ")" : ""}` : `${o.make ?? ""} ${o.model ?? ""}`.trim(),
            }
          : null,
    }));

    return json({ ok: true, items: offers });
  } catch (err: any) {
    // Ensure we never lose the real root cause in server logs
    console.error("/api/admin/offers GET failed", err);
    const p = errPayload(err);
    return json(p.body, p.status);
  }
}

// 2) CREATE OFFER (POST)
// Expected body (example):
// {
//   "accountId": "uuid",
//   "vehicle": { "chassis_vin": "...", "plate_no": "...", "make": "...", "model": "...", "series": "...", "engine_code": "...", "year": 2020 },
//   "items": [{ "productId": "uuid?", "name": "Text", "qty": 2, "unit_net": 100, "tax_rate": 0.19 }],
//   "notes": "...",
//   "validUntil": "2026-02-01"
// }
export async function POST(req: NextRequest) {
  let user: Awaited<ReturnType<typeof requireStaff>>;
  try {
    user = await requireStaff(req, ["admin", "sales", "sales_rep"]);
  } catch (err: any) {
    console.error("/api/admin/offers POST auth failed", err);
    const p = errPayload(err);
    return json(p.body, p.status);
  }

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return json({ ok: false, error: "Content-Type invalid. Folosește application/json." }, 415);
  }

  const body = await req.json().catch(() => null);
  const accountId = String(body?.accountId ?? "").trim();
  const notes = body?.notes == null ? null : String(body.notes).trim() || null;
  const validUntil = body?.validUntil ? String(body.validUntil).trim() : null;

  const vehicle = body?.vehicle ?? null;
  const items = Array.isArray(body?.items) ? body.items : [];

  if (!accountId) return json({ ok: false, error: "Selectează clientul (accountId)." }, 400);
  if (!Array.isArray(items) || items.length === 0) return json({ ok: false, error: "Adaugă cel puțin un produs." }, 400);

  // Validate account exists
  const acc = await sql`SELECT id FROM account WHERE id = ${accountId}::uuid LIMIT 1`;
  if (!Array.isArray(acc) || acc.length === 0) {
    return json({ ok: false, error: "Client inexistent." }, 404);
  }

  // A) Vehicle upsert-like by VIN (if present)
  let vehicleId: string | null = null;

  const vin = vehicle?.chassis_vin ? String(vehicle.chassis_vin).trim() : "";
  const plateNo = vehicle?.plate_no ? String(vehicle.plate_no).trim() : null;
  const make = vehicle?.make ? String(vehicle.make).trim() : null;
  const model = vehicle?.model ? String(vehicle.model).trim() : null;
  const series = vehicle?.series ? String(vehicle.series).trim() : null;
  const engineCode = vehicle?.engine_code ? String(vehicle.engine_code).trim() : null;
  const year = vehicle?.year != null && vehicle.year !== "" ? Number(vehicle.year) : null;

  if (vin) {
    const existingV = await sql`
      SELECT id
      FROM vehicle
      WHERE upper(chassis_vin) = upper(${vin})
      LIMIT 1
    `;

    if (Array.isArray(existingV) && existingV.length > 0) {
      vehicleId = (existingV as any[])[0].id;

      // Optional: update basic details if provided
      await sql`
        UPDATE vehicle
        SET
          account_id = ${accountId}::uuid,
          plate_no = COALESCE(${plateNo}, plate_no),
          make = COALESCE(${make}, make),
          model = COALESCE(${model}, model),
          series = COALESCE(${series}, series),
          engine_code = COALESCE(${engineCode}, engine_code),
          year = COALESCE(${year}, year),
          updated_at = now()
        WHERE id = ${vehicleId}::uuid
      `;
    } else {
      const inserted = await sql`
        INSERT INTO vehicle (account_id, make, model, series, chassis_vin, engine_code, year, plate_no)
        VALUES (
          ${accountId}::uuid,
          ${make ?? ""},
          ${model ?? ""},
          ${series},
          ${vin},
          ${engineCode},
          ${year},
          ${plateNo}
        )
        RETURNING id
      `;
      vehicleId = (inserted as any[])[0]?.id ?? null;
    }
  }

  // B) Totals calculation (net + tax)
  // We store totals in DB for fast listing; UI can still display its own computed values.
  let totalNet = 0;
  let totalTax = 0;

  const normalizedItems = items.map((i: any) => {
    const qty = Number(i?.qty ?? i?.quantity ?? 0);
    const unitNet = Number(i?.unit_net ?? i?.unitNet ?? i?.price ?? 0);

    // tax can be provided as 0.19 OR 19
    const tr = Number(i?.tax_rate ?? i?.taxRate ?? i?.tax ?? 0);
    const taxFrac = tr <= 1 ? tr : tr / 100;

    const productId = i?.productId ? String(i.productId).trim() : null;
    const name = String(i?.name ?? "").trim();

    if (!name || name.length < 1) throw new Error("Lipsă nume produs pe o linie.");
    if (!Number.isFinite(qty) || qty <= 0) throw new Error("Cantitate invalidă pe o linie.");
    if (!Number.isFinite(unitNet) || unitNet < 0) throw new Error("Preț invalid pe o linie.");
    if (!Number.isFinite(taxFrac) || taxFrac < 0 || taxFrac > 1) throw new Error("TVA invalid pe o linie.");

    const lineNet = qty * unitNet;
    const lineTax = lineNet * taxFrac;

    totalNet += lineNet;
    totalTax += lineTax;

    return {
      productId,
      name,
      qty,
      unitNet,
      taxRate: taxFrac,
      lineNet,
      lineTax,
    };
  });

  const totalGross = totalNet + totalTax;

  // C) Insert offer header + lines
  try {
    const offerRows = await sql`
      INSERT INTO offer (
        account_id,
        vehicle_id,
        created_by_user_id,
        status,
        notes,
        valid_until,
        total_net,
        total_tax,
        total_gross
      )
      VALUES (
        ${accountId}::uuid,
        ${vehicleId ? sql`${vehicleId}::uuid` : null},
        ${user.userId}::uuid,
        'DRAFT',
        ${notes},
        ${validUntil},
        ${totalNet},
        ${totalTax},
        ${totalGross}
      )
      RETURNING id
    `;

    const offerId = (offerRows as any[])?.[0]?.id as string | undefined;
    if (!offerId) return json({ ok: false, error: "Eroare internă." }, 500);

    for (const it of normalizedItems) {
      await sql`
        INSERT INTO offer_item (
          offer_id,
          product_id,
          name,
          quantity,
          unit_price_net,
          tax_rate,
          line_net,
          line_tax,
          line_gross
        )
        VALUES (
          ${offerId}::uuid,
          ${it.productId ? sql`${it.productId}::uuid` : null},
          ${it.name},
          ${it.qty},
          ${it.unitNet},
          ${it.taxRate},
          ${it.lineNet},
          ${it.lineTax},
          ${it.lineNet + it.lineTax}
        )
      `;
    }

    return json({ ok: true, id: offerId });
  } catch (err: any) {
    console.error("/api/admin/offers POST failed", err);
    const p = errPayload(err);
    return json(p.body, p.status);
  }
}