// src/app/api/admin/orders/[id]/route.ts
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

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaff(req);

    const { id } = await ctx.params;

    const orderSql = `
      SELECT
        o.id,
        o.offer_id,
        o.account_id,
        o.vehicle_id,
        o.status,
        o.notes,
        o.created_by_user_id,
        o.created_at,
        o.updated_at,
        o.warehouse_id,

        w.code as warehouse_code,
        w.name as warehouse_name,

        a.display_name as account_display_name,
        a.kind as account_kind,
        a.email as account_email,
        a.phone as account_phone,
        a.tax_id as account_tax_id,
        a.reg_no as account_reg_no,

        v.plate_no as vehicle_plate_no,
        v.make as vehicle_make,
        v.model as vehicle_model,
        v.series as vehicle_series,
        v.chassis_vin as vehicle_chassis_vin,
        v.engine_code as vehicle_engine_code,
        v.year as vehicle_year,

        p.email as created_by_email,
        p.full_name as created_by_name
      FROM public."order" o
      LEFT JOIN public.account a ON a.id = o.account_id
      LEFT JOIN public.vehicle v ON v.id = o.vehicle_id
      LEFT JOIN public.warehouse w ON w.id = o.warehouse_id
      LEFT JOIN public.profile p ON p.user_id = o.created_by_user_id
      WHERE o.id = $1
      LIMIT 1
    `;

    const itemsSql = `
      SELECT
        oi.*,
        pr.sku as product_sku,
        pr.slug as product_slug,
        pr.name as product_name,
        pr.uom as product_uom,
        pr.stock_on_hand,
        pr.stock_reserved,
        (pr.stock_on_hand - pr.stock_reserved) as stock_available,
        (oi.qty - oi.reserved_qty) as missing_qty
      FROM public.order_item oi
      JOIN public.product pr ON pr.id = oi.product_id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at ASC
    `;

    const [orderRes, itemsRes] = await Promise.all([
      pool.query(orderSql, [id]),
      pool.query(itemsSql, [id]),
    ]);

    const order = orderRes.rows[0];
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Order not found", data: null },
        { status: 404 },
      );
    }

    const items = itemsRes.rows;

    // Normalize into UI-friendly shape (similar to offer details)
    const totalsFromItems = (items || []).reduce(
      (acc: any, it: any) => {
        acc.total_net += Number(it.line_net ?? 0);
        acc.total_tax += Number(it.line_tax ?? 0);
        acc.total_gross += Number(it.line_gross ?? 0);
        return acc;
      },
      { total_net: 0, total_tax: 0, total_gross: 0 },
    );

    const formattedData = {
      id: order.id,
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
      notes: order.notes ?? "",

      offerId: order.offer_id ?? null,
      accountId: order.account_id ?? null,
      vehicleId: order.vehicle_id ?? null,

      // Keep legacy shape: `customer` is actually account
      customer: order.account_id
        ? {
            id: order.account_id,
            kind: String(order.account_kind || "").toLowerCase(),
            display_name: order.account_display_name ?? "",
            vat_id: order.account_tax_id ?? null,
            phone: order.account_phone ?? "",
            email: order.account_email ?? "",
            reg_no: order.account_reg_no ?? null,
          }
        : null,

      vehicle: order.vehicle_id
        ? {
            id: order.vehicle_id,
            chassis_vin: order.vehicle_chassis_vin ?? "",
            plate_no: order.vehicle_plate_no ?? "",
            make: order.vehicle_make ?? "",
            model: order.vehicle_model ?? "",
            series: order.vehicle_series ?? "",
            engine_code: order.vehicle_engine_code ?? "",
            year: order.vehicle_year ?? new Date().getFullYear(),

            // Legacy aliases (older UI)
            vin: order.vehicle_chassis_vin ?? "",
            plate_number: order.vehicle_plate_no ?? "",
            brand: order.vehicle_make ?? "",
          }
        : null,

      totals: {
        total_net: totalsFromItems.total_net,
        total_tax: totalsFromItems.total_tax,
        total_gross: totalsFromItems.total_gross,
      },

      warehouse: order.warehouse_id
        ? {
            id: order.warehouse_id,
            code: order.warehouse_code ?? "",
            name: order.warehouse_name ?? "",
          }
        : null,

      createdBy: {
        user_id: order.created_by_user_id ?? null,
        email: order.created_by_email ?? null,
        full_name: order.created_by_name ?? null,
      },

      items: (items || []).map((i: any) => {
        const qty = Number(i.qty) || 0;
        const reserved = Number(i.reserved_qty) || 0;
        const unitNet = Number(i.unit_price_net ?? 0);
        const taxFrac = Number(i.tax_rate ?? 0);
        const taxPct = taxFrac <= 1 ? taxFrac * 100 : taxFrac;

        return {
          id: i.id,
          productId: i.product_id,
          name: i.product_name ?? i.name ?? "",
          sku: i.product_sku ?? null,
          slug: i.product_slug ?? null,
          uom: i.product_uom ?? null,

          qty,
          quantity: qty,
          reserved_qty: reserved,
          reservedQty: reserved,

          price: unitNet,
          unit_price_net: unitNet,
          tax: taxPct,
          tax_rate: taxFrac,

          line_net: Number(i.line_net ?? 0),
          line_tax: Number(i.line_tax ?? 0),
          line_gross: Number(i.line_gross ?? 0),

          stock_on_hand: Number(i.stock_on_hand ?? 0),
          stock_reserved: Number(i.stock_reserved ?? 0),
          stock_available: Number(i.stock_available ?? 0),
          missing_qty: Number(i.missing_qty ?? 0),
        };
      }),
    };

    return NextResponse.json({
      ok: true,
      data: formattedData,
      // backward-compat (some pages read these directly)
      order,
      items,
    });
  } catch (e: any) {
    console.error("[api/admin/orders/:id GET failed]", {
      id: (ctx as any)?.params ? "(see ctx.params)" : undefined,
      name: e?.name,
      message: e?.message,
      code: e?.code,
      detail: e?.detail,
      hint: e?.hint,
      where: e?.where,
      position: e?.position,
      schema: e?.schema,
      table: e?.table,
      column: e?.column,
      constraint: e?.constraint,
      routine: e?.routine,
      severity: e?.severity,
      stack: e?.stack,
    });

    return NextResponse.json(
      { ok: false, error: e?.message || "Order get failed", data: null },
      { status: 500 },
    );
  }
}
