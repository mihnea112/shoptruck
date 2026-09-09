import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireCustomer } from "@/lib/auth/api";

type Ctx = { params: { id: string } | Promise<{ id: string }> };

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireCustomer(req);
    const p = await Promise.resolve(ctx.params);
    const id = String((p as any).id);

    // Verify the offer belongs to an account linked to this user
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
        AND a.user_id = ${user.userId}::uuid
      LIMIT 1
    `) as any[];

    if (!offerRows || offerRows.length === 0) {
      return json({ ok: false, error: "Oferta nu există sau nu ai acces." }, 404);
    }

    const offer = offerRows[0];

    // Lines
    const itemRows = (await sql`
      SELECT
        oi.id,
        oi.product_id,
        oi.name,
        oi.quantity,
        oi.unit_price_net,
        oi.tax_rate,
        oi.line_net,
        oi.line_tax,
        oi.line_gross,
        p.sku AS product_sku,
        pi.storage_path AS primary_image_path
      FROM offer_item oi
      LEFT JOIN product p ON p.id = oi.product_id
      LEFT JOIN LATERAL (
        SELECT storage_path
        FROM product_image
        WHERE product_id = oi.product_id
        ORDER BY is_primary DESC, sort_order ASC, created_at ASC
        LIMIT 1
      ) pi ON true
      WHERE oi.offer_id = ${id}::uuid
      ORDER BY oi.id ASC
    `) as any[];

    const sb = supabaseAdmin();

    const formattedData = {
      id: offer.id,
      status: offer.status,
      created_at: offer.created_at,
      updated_at: offer.updated_at,
      notes: offer.notes ?? "",
      validUntil: offer.valid_until
        ? new Date(offer.valid_until).toISOString().split("T")[0]
        : "",

      customer: {
        id: offer.account_id,
        kind: String(offer.account_kind || "").toLowerCase(),
        display_name: offer.account_display_name,
        vat_id: offer.account_tax_id ?? null,
        phone: offer.account_phone ?? "",
        email: offer.account_email ?? "",
        reg_no: offer.account_reg_no ?? null,
      },

      accountId: offer.account_id,

      vehicle: offer.vehicle_id
        ? {
            id: offer.vehicle_id,
            chassis_vin: offer.chassis_vin ?? "",
            plate_no: offer.plate_no ?? "",
            make: offer.make ?? "",
            model: offer.model ?? "",
            series: offer.series ?? "",
            engine_code: offer.engine_code ?? "",
            year: offer.year ?? new Date().getFullYear(),
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

      items: await Promise.all(
        (itemRows || []).map(async (i: any) => {
          const qty = Number(i.quantity) || 1;
          const unitNet = Number(i.unit_price_net ?? 0);
          const taxFrac = Number(i.tax_rate ?? 0);
          const taxPct = taxFrac <= 1 ? taxFrac * 100 : taxFrac;

          const rawPath = i.primary_image_path ?? null;
          let imageUrl: string | null = null;
          if (rawPath) {
            if (/^https?:\/\//i.test(rawPath)) {
              imageUrl = rawPath;
            } else {
              const { data } = await sb.storage
                .from("product-images")
                .createSignedUrl(rawPath, 3600);
              imageUrl = data?.signedUrl ?? null;
            }
          }

          return {
            id: i.id,
            offerItemId: i.id,
            productId: i.product_id,
            name: i.name,
            sku: i.product_sku ?? null,
            qty,
            quantity: qty,
            price: unitNet,
            tax: taxPct,
            tax_rate: taxFrac,
            primary_image_path: imageUrl ?? rawPath,
            image_url: imageUrl,
          };
        }),
      ),
    };

    return json({ ok: true, data: formattedData });
  } catch (err: any) {
    console.error("[API user offer GET]", err);
    return json({ ok: false, error: err?.message || "Eroare internă." }, err?.status ?? 500);
  }
}
