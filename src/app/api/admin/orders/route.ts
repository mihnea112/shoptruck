// src/app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { Pool } from "pg";
import { requireStaff } from "@/lib/auth/api";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

const pool =
  global.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  });

if (process.env.NODE_ENV !== "production") global.__pgPool = pool;

function asInt(v: string | null, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function asUuid(v: any) {
  const s = String(v ?? "").trim();
  return /^[0-9a-fA-F-]{36}$/.test(s) ? s : null;
}

export async function GET(req: Request) {
  try {
    await requireStaff(req);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(asInt(searchParams.get("limit"), 50), 200);
    const offset = Math.max(asInt(searchParams.get("offset"), 0), 0);
    const status = (searchParams.get("status") || "").trim();
    const q = (searchParams.get("q") || "").trim();

    const where: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status) {
      where.push(`o.status = $${idx++}`);
      values.push(status);
    }

    if (q) {
      // Search in account display_name/email/phone and vehicle plate_no/chassis_vin
      where.push(`
        (
          COALESCE(a.display_name,'') ILIKE $${idx} OR
          COALESCE(a.email,'') ILIKE $${idx} OR
          COALESCE(a.phone,'') ILIKE $${idx} OR
          COALESCE(v.plate_no,'') ILIKE $${idx} OR
          COALESCE(v.chassis_vin,'') ILIKE $${idx}
        )
      `);
      values.push(`%${q}%`);
      idx++;
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT
        o.id,
        o.offer_id,
        o.account_id,
        o.vehicle_id,
        o.status,
        o.notes,
        o.created_at,
        o.updated_at,

        a.kind as account_kind,
        a.display_name as account_display_name,
        a.display_name as account_name,
        a.email as account_email,
        a.phone as account_phone,

        v.plate_no as plate_no,
        v.plate_no as vehicle_plate,
        v.chassis_vin as chassis_vin,
        v.chassis_vin as vehicle_vin,
        v.make as vehicle_make,
        v.model as vehicle_model,
        v.year as vehicle_year,

        o.created_by_user_id,
        p.email as created_by_email,
        p.full_name as created_by_name,

        COALESCE(SUM(oi.qty), 0) as items_qty,
        COALESCE(SUM(oi.reserved_qty), 0) as reserved_qty,
        COALESCE(SUM(oi.line_gross), 0) as total_gross
      FROM public."order" o
      LEFT JOIN public.account a ON a.id = o.account_id
      LEFT JOIN public.vehicle v ON v.id = o.vehicle_id
      LEFT JOIN public.profile p ON p.user_id = o.created_by_user_id
      LEFT JOIN public.order_item oi ON oi.order_id = o.id
      ${whereSql}
      GROUP BY
        o.id, a.id, v.id, p.user_id
      ORDER BY o.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    values.push(limit, offset);

    const { rows } = await pool.query(sql, values);

    return json({
      ok: true,
      items: rows,
      limit,
      offset,
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Orders list failed" }, 500);
  }
}

export async function POST(req: Request) {
  // Create an Order from an Offer + selected Offer Items
  // Body:
  // {
  //   offer_id: "uuid",
  //   item_ids: ["uuid", ...], // offer_item ids to include
  //   notes?: string
  // }
  try {
    const me: any = await requireStaff(req); // default roles apply
    const userId = (me?.userId ?? me?.user_id ?? null) as string | null;

    const body = await req.json().catch(() => null);
    const offerId = asUuid(body?.offer_id);
    const rawIds: any[] = Array.isArray(body?.item_ids) ? body.item_ids : [];
    const itemIds = rawIds.map(asUuid).filter(Boolean) as string[];
    const notes = typeof body?.notes === "string" ? body.notes.trim() : null;
    const warehouseId = asUuid(body?.warehouse_id);

    if (!offerId)
      return json({ ok: false, error: "offer_id lipsă sau invalid." }, 400);
    if (itemIds.length === 0)
      return json(
        { ok: false, error: "Selectează cel puțin un item din ofertă." },
        400,
      );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Ensure offer exists
      const offerRes = await client.query(
        `SELECT id, account_id, vehicle_id, status, notes, valid_until, total_net, total_tax, total_gross
         FROM public.offer
         WHERE id = $1::uuid
         LIMIT 1`,
        [offerId],
      );

      if (offerRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return json({ ok: false, error: "Oferta nu există." }, 404);
      }

      // Fetch ONLY selected items, and ensure they belong to the offer
      const itemsRes = await client.query(
        `SELECT id, offer_id, product_id, name, quantity, unit_price_net, tax_rate, line_net, line_tax, line_gross
         FROM public.offer_item
         WHERE offer_id = $1::uuid
           AND id = ANY($2::uuid[])
         ORDER BY id ASC`,
        [offerId, itemIds],
      );

      if (itemsRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return json(
          {
            ok: false,
            error: "Nu am găsit item-urile selectate în oferta respectivă.",
          },
          400,
        );
      }

      // If some ids were invalid / not part of this offer, fail fast
      if (itemsRes.rowCount !== itemIds.length) {
        await client.query("ROLLBACK");
        return json(
          { ok: false, error: "Unele item-uri selectate nu aparțin ofertei." },
          400,
        );
      }

      // Create order header
      const insOrder = await client.query(
        `INSERT INTO public."order" (
           offer_id,
           account_id,
           vehicle_id,
           status,
           notes,
           warehouse_id,
           created_by_user_id
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'PLACED', $4, $5::uuid, $6::uuid)
         RETURNING id`,
        [
          offerId,
          offerRes.rows[0].account_id,
          offerRes.rows[0].vehicle_id,
          notes,
          warehouseId ?? null,
          userId,
        ],
      );

      const orderId = insOrder.rows[0]?.id as string;

      // Insert order items (copying from offer_item)
      for (const it of itemsRes.rows) {
        await client.query(
          `INSERT INTO public.order_item (
             order_id,
             product_id,
             qty,
             reserved_qty,
             unit_price_net,
             tax_rate,
             line_net,
             line_tax,
             line_gross,
             warehouse_id
           )
           VALUES ($1::uuid, $2::uuid, $3::numeric, 0, $4::numeric, $5::numeric, $6::numeric, $7::numeric, $8::numeric, $9::uuid)`,
          [
            orderId,
            it.product_id,
            it.quantity,
            it.unit_price_net,
            it.tax_rate,
            it.line_net,
            it.line_tax,
            it.line_gross,
            warehouseId ?? null,
          ],
        );
      }

      await client.query("COMMIT");
      return json({ ok: true, id: orderId });
    } catch (e: any) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      console.error("[api/admin/orders POST failed]", {
        message: e?.message,
        code: e?.code,
        detail: e?.detail,
        hint: e?.hint,
      });
      return json(
        { ok: false, error: e?.message || "Eroare la creare comandă." },
        500,
      );
    } finally {
      client.release();
    }
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}
