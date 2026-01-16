import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

type Ctx = { params: { id: string } | Promise<{ id: string }> };

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

async function getId(ctx: Ctx) {
  const p = await Promise.resolve(ctx.params);
  return String((p as any).id);
}

const safeUUID = (val: any) =>
  val && typeof val === "string" && val.trim().length > 0 ? val.trim() : null;

// GET SINGLE OFFER
export async function GET(req: NextRequest, ctx: Ctx) {
  await requireStaff(req, ["ADMIN", "SALES_REP"]);
  const id = await getId(ctx);

  try {
    // Header + Account + Vehicle (NEW schema)
    const offerRows = (await sql`
      SELECT
        o.id,
        o.status,
        o.created_at,
        o.updated_at,
        o.notes,
        o.valid_until,
        o.total_net,
        o.total_tax,
        o.total_gross,

        a.id AS account_id,
        a.kind AS account_kind,
        a.display_name AS account_display_name,
        a.email AS account_email,
        a.phone AS account_phone,
        a.tax_id AS account_tax_id,
        a.reg_no AS account_reg_no,

        v.id AS vehicle_id,
        v.plate_no,
        v.make,
        v.model,
        v.series,
        v.chassis_vin,
        v.engine_code,
        v.year
      FROM offer o
      JOIN account a ON a.id = o.account_id
      LEFT JOIN vehicle v ON v.id = o.vehicle_id
      WHERE o.id = ${id}::uuid
      LIMIT 1
    `) as any[];

    if (!offerRows || offerRows.length === 0) {
      return json({ ok: false, error: "Oferta nu există" }, 404);
    }

    const offer = offerRows[0];

    // Lines (NEW schema)
    const itemRows = (await sql`
      SELECT
        id,
        product_id,
        name,
        quantity,
        unit_price_net,
        tax_rate,
        line_net,
        line_tax,
        line_gross
      FROM offer_item
      WHERE offer_id = ${id}::uuid
      ORDER BY id ASC
    `) as any[];

    const formattedData = {
      id: offer.id,
      status: offer.status,
      created_at: offer.created_at,
      updated_at: offer.updated_at,
      notes: offer.notes ?? "",
      validUntil: offer.valid_until
        ? new Date(offer.valid_until).toISOString().split("T")[0]
        : "",

      // Keep legacy shape for UI compatibility: `customer` is actually account
      customer: {
        id: offer.account_id,
        kind: String(offer.account_kind || "").toLowerCase(),
        display_name: offer.account_display_name,
        vat_id: offer.account_tax_id ?? null,
        phone: offer.account_phone ?? "",
        email: offer.account_email ?? "",
        reg_no: offer.account_reg_no ?? null,
      },

      // convenience
      accountId: offer.account_id,

      vehicle: offer.vehicle_id
        ? {
            id: offer.vehicle_id,
            // NEW fields
            chassis_vin: offer.chassis_vin ?? "",
            plate_no: offer.plate_no ?? "",
            make: offer.make ?? "",
            model: offer.model ?? "",
            series: offer.series ?? "",
            engine_code: offer.engine_code ?? "",
            year: offer.year ?? new Date().getFullYear(),
            // Legacy aliases (so older UI still works)
            vin: offer.chassis_vin ?? "",
            plate_number: offer.plate_no ?? "",
            brand: offer.make ?? "",
          }
        : {
            chassis_vin: "",
            plate_no: "",
            make: "",
            model: "",
            series: "",
            engine_code: "",
            year: new Date().getFullYear(),
            vin: "",
            plate_number: "",
            brand: "",
          },

      totals: {
        total_net: Number(offer.total_net ?? 0),
        total_tax: Number(offer.total_tax ?? 0),
        total_gross: Number(offer.total_gross ?? 0),
      },

      // UI expects qty/price/tax(%)
      items: (itemRows || []).map((i: any) => {
        const qty = Number(i.quantity) || 1;
        const unitNet = Number(i.unit_price_net ?? 0);
        const taxFrac = Number(i.tax_rate ?? 0);
        const taxPct = taxFrac <= 1 ? taxFrac * 100 : taxFrac;
        return {
          id: i.id,
          productId: i.product_id,
          name: i.name,
          qty,
          quantity: qty,
          price: unitNet,
          tax: taxPct,
          tax_rate: taxFrac,
        };
      }),
    };

    return json({ ok: true, data: formattedData });
  } catch (err: any) {
    console.error("API Error:", err);
    return json({ ok: false, error: err?.message || "Eroare internă." }, 500);
  }
}

// DELETE
export async function DELETE(req: NextRequest, ctx: Ctx) {
  await requireStaff(req, ["ADMIN", "SALES_REP"]);
  const id = await getId(ctx);

  try {
    await sql`DELETE FROM offer_item WHERE offer_id = ${id}::uuid`;
    const del = await sql`DELETE FROM offer WHERE id = ${id}::uuid RETURNING id`;
    const deleted = (del as any[])?.[0]?.id;
    if (!deleted) return json({ ok: false, error: "Oferta nu există" }, 404);
    return json({ ok: true });
  } catch (err: any) {
    console.error("DELETE Error:", err);
    return json({ ok: false, error: err?.message || "Eroare internă." }, 500);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const user = await requireStaff(req, ["ADMIN", "SALES_REP"]);
  const id = await getId(ctx);

  try {
    const body = await req.json().catch(() => null);

    // accept both new + old keys
    const accountId = String(body?.accountId ?? body?.customerId ?? "").trim();
    const notes = body?.notes == null ? null : String(body.notes).trim() || null;
    const validUntil = body?.validUntil ? String(body.validUntil).trim() : null;

    const vehicleIdRaw = safeUUID(body?.vehicleId);
    const vehicle = body?.vehicle ?? null;
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!accountId) return json({ ok: false, error: "Selectează clientul (accountId)." }, 400);
    if (!Array.isArray(items) || items.length === 0)
      return json({ ok: false, error: "Adaugă cel puțin un produs." }, 400);

    // Validate offer exists
    const exists = await sql`SELECT id FROM offer WHERE id = ${id}::uuid LIMIT 1`;
    if (!Array.isArray(exists) || exists.length === 0) {
      return json({ ok: false, error: "Oferta nu există" }, 404);
    }

    // Validate account exists
    const acc = await sql`SELECT id FROM account WHERE id = ${accountId}::uuid LIMIT 1`;
    if (!Array.isArray(acc) || acc.length === 0) {
      return json({ ok: false, error: "Client inexistent." }, 404);
    }

    // Vehicle upsert by VIN (preferred) or plate
    let finalVehicleId: string | null = vehicleIdRaw;

    const vin = vehicle?.chassis_vin
      ? String(vehicle.chassis_vin).trim()
      : vehicle?.vin
      ? String(vehicle.vin).trim()
      : "";
    const plateNo = vehicle?.plate_no
      ? String(vehicle.plate_no).trim()
      : vehicle?.plate_number
      ? String(vehicle.plate_number).trim()
      : null;
    const make = vehicle?.make
      ? String(vehicle.make).trim()
      : vehicle?.brand
      ? String(vehicle.brand).trim()
      : null;
    const model = vehicle?.model ? String(vehicle.model).trim() : null;
    const series = vehicle?.series ? String(vehicle.series).trim() : null;
    const engineCode = vehicle?.engine_code ? String(vehicle.engine_code).trim() : null;
    const year = vehicle?.year != null && vehicle.year !== "" ? Number(vehicle.year) : null;

    if (vin || plateNo) {
      const existingV = vin
        ? await sql`
            SELECT id
            FROM vehicle
            WHERE upper(chassis_vin) = upper(${vin})
            LIMIT 1
          `
        : await sql`
            SELECT id
            FROM vehicle
            WHERE upper(plate_no) = upper(${plateNo})
            LIMIT 1
          `;

      if (Array.isArray(existingV) && existingV.length > 0) {
        finalVehicleId = (existingV as any[])[0].id;
        await sql`
          UPDATE vehicle
          SET
            account_id = ${accountId}::uuid,
            plate_no = COALESCE(${plateNo}, plate_no),
            make = COALESCE(${make}, make),
            model = COALESCE(${model}, model),
            series = COALESCE(${series}, series),
            chassis_vin = COALESCE(${vin || null}, chassis_vin),
            engine_code = COALESCE(${engineCode}, engine_code),
            year = COALESCE(${year}, year),
            updated_at = now()
          WHERE id = ${finalVehicleId}::uuid
        `;
      } else {
        const inserted = await sql`
          INSERT INTO vehicle (
            account_id, make, model, series, chassis_vin, engine_code, year, plate_no
          )
          VALUES (
            ${accountId}::uuid,
            ${make ?? ""},
            ${model ?? ""},
            ${series},
            ${vin || null},
            ${engineCode},
            ${year},
            ${plateNo}
          )
          RETURNING id
        `;
        finalVehicleId = (inserted as any[])?.[0]?.id ?? null;
      }
    }

    // Totals + normalize items
    let totalNet = 0;
    let totalTax = 0;

    const normalizedItems = items.map((i: any) => {
      const qty = Number(i?.qty ?? i?.quantity ?? 0);
      const unitNet = Number(i?.unit_net ?? i?.unitNet ?? i?.price ?? i?.unit_price_net ?? 0);

      // tax can be provided as 0.19 OR 19
      const tr = Number(i?.tax_rate ?? i?.taxRate ?? i?.tax ?? 0);
      const taxFrac = tr <= 1 ? tr : tr / 100;

      const productId = i?.productId ? String(i.productId).trim() : i?.product_id ? String(i.product_id).trim() : null;
      const name = String(i?.name ?? "").trim();

      if (!name) throw new Error("Lipsă nume produs pe o linie.");
      if (!Number.isFinite(qty) || qty <= 0) throw new Error("Cantitate invalidă pe o linie.");
      if (!Number.isFinite(unitNet) || unitNet < 0) throw new Error("Preț invalid pe o linie.");
      if (!Number.isFinite(taxFrac) || taxFrac < 0 || taxFrac > 1) throw new Error("TVA invalid pe o linie.");

      const lineNet = qty * unitNet;
      const lineTax = lineNet * taxFrac;
      const lineGross = lineNet + lineTax;

      totalNet += lineNet;
      totalTax += lineTax;

      return { productId, name, qty, unitNet, taxFrac, lineNet, lineTax, lineGross };
    });

    const totalGross = totalNet + totalTax;
    const safeValidUntil = validUntil ? new Date(validUntil).toISOString() : null;

    await sql`BEGIN`;

    await sql`
      UPDATE offer
      SET
        account_id = ${accountId}::uuid,
        vehicle_id = ${finalVehicleId ? sql`${finalVehicleId}::uuid` : null},
        notes = ${notes},
        valid_until = ${safeValidUntil},
        total_net = ${totalNet},
        total_tax = ${totalTax},
        total_gross = ${totalGross},
        updated_at = now()
      WHERE id = ${id}::uuid
    `;

    await sql`DELETE FROM offer_item WHERE offer_id = ${id}::uuid`;

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
          ${id}::uuid,
          ${it.productId ? sql`${it.productId}::uuid` : null},
          ${it.name},
          ${it.qty},
          ${it.unitNet},
          ${it.taxFrac},
          ${it.lineNet},
          ${it.lineTax},
          ${it.lineGross}
        )
      `;
    }

    await sql`COMMIT`;

    return json({
      ok: true,
      message: "Oferta a fost actualizată.",
      data: {
        id,
        total_net: totalNet,
        total_tax: totalTax,
        total_gross: totalGross,
        vehicle_id: finalVehicleId,
      },
    });
  } catch (err: any) {
    try {
      await sql`ROLLBACK`;
    } catch {}
    console.error("PUT Error:", err);
    return json({ ok: false, error: err?.message || "Eroare internă." }, 500);
  }
}
