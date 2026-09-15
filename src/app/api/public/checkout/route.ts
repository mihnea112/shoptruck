import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { getUserDiscountPct, applyClassDiscount } from "@/lib/discount";
import { decryptPII, encryptPII } from "@/lib/crypto/pii";
import { getEpClient, getAppUrl } from "@/lib/euplatesc";

function toPublicUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/product-images/${path}`;
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

// GET /api/public/checkout — prefill data (profile + cart summary)
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return json({ ok: false, error: "Neautorizat." }, 401);

    // Fetch profile
    const profiles = await sql`
      SELECT
        a.display_name,
        a.email,
        a.phone,
        a.kind,
        a.legal_name,
        a.tax_id,
        a.reg_no,
        a.billing_line1,
        a.billing_city,
        a.billing_zip,
        a.billing_country
      FROM account a
      WHERE a.user_id = ${user.userId}::uuid
      LIMIT 1
    `;

    const raw = profiles[0] || null;
    // Normalize column names for the client
    const profile = raw
      ? {
          display_name: raw.display_name,
          email: raw.email,
          phone: decryptPII(raw.phone),
          kind: raw.kind,
          company_name: (raw.kind || "").toLowerCase() === "company" ? raw.display_name : null,
          legal_name: raw.legal_name,
          tax_id: decryptPII(raw.tax_id),
          reg_no: decryptPII(raw.reg_no),
          address: decryptPII(raw.billing_line1),
          city: raw.billing_city,
          postal_code: raw.billing_zip,
          country: raw.billing_country,
        }
      : null;

    // Fetch cart with prices
    const classDiscountPct = await getUserDiscountPct(user.userId);

    const cartItems = await sql`
      SELECT
        cc.product_id,
        cc.quantity,
        p.name,
        p.slug,
        p.discount_price,
        p.discount_active,
        b.name as brand_name,
        pc.code_norm as primary_code,
        pi.primary_image_path,
        CEIL(p.buy_price_net * (1 + p.profit_margin_pct/100.0) *
          (1 + CASE WHEN tr.rate <= 1 THEN tr.rate ELSE tr.rate/100 END)) AS price_gross,
        p.buy_price_net,
        p.profit_margin_pct,
        tr.rate as tax_rate
      FROM customer_cart cc
      JOIN product p ON p.id = cc.product_id
      JOIN tax_rate tr ON tr.id = p.tax_rate_id
      LEFT JOIN brand b ON b.id = p.brand_id
      LEFT JOIN LATERAL (
        SELECT pc2.code_norm FROM product_code j
        JOIN part_code pc2 ON pc2.id = (CASE WHEN j.code_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN j.code_id::uuid ELSE NULL END)
        WHERE j.product_id = p.id AND j.is_primary = true LIMIT 1
      ) pc ON true
      LEFT JOIN LATERAL (
        SELECT pi2.storage_path AS primary_image_path
        FROM product_image pi2 WHERE pi2.product_id = p.id
        ORDER BY pi2.is_primary DESC, pi2.sort_order ASC LIMIT 1
      ) pi ON true
      WHERE cc.customer_id = ${user.userId}::uuid
      ORDER BY cc.added_at DESC
    `;

    const items = cartItems.map((row: any) => {
      const originalGross = Number(row.price_gross);
      const productDiscountPrice = row.discount_active ? Number(row.discount_price) : null;
      const basePrice = productDiscountPrice ?? originalGross;
      const finalPrice = classDiscountPct > 0 ? applyClassDiscount(basePrice, classDiscountPct) : basePrice;
      const taxRate = Number(row.tax_rate) <= 1 ? Number(row.tax_rate) : Number(row.tax_rate) / 100;
      const unitNet = finalPrice / (1 + taxRate);

      return {
        product_id: row.product_id,
        name: row.name,
        brand_name: row.brand_name || null,
        primary_code: row.primary_code || null,
        primary_image_path: toPublicUrl(row.primary_image_path),
        price_gross: originalGross,
        final_price: finalPrice,
        unit_net: Math.round(unitNet * 100) / 100,
        tax_rate: taxRate,
        quantity: Number(row.quantity),
      };
    });

    const totalGross = items.reduce((s: number, i: any) => s + i.final_price * i.quantity, 0);
    const totalNet = items.reduce((s: number, i: any) => s + i.unit_net * i.quantity, 0);
    const totalTax = totalGross - totalNet;

    const warehouses = await sql`
      SELECT id, name, address FROM warehouse WHERE is_active = true ORDER BY name ASC
    `;

    return json({
      ok: true,
      profile,
      items,
      totals: {
        net: Math.round(totalNet * 100) / 100,
        tax: Math.round(totalTax * 100) / 100,
        gross: Math.round(totalGross * 100) / 100,
      },
      class_discount_pct: classDiscountPct,
      warehouses,
    });
  } catch (e: any) {
    console.error("[API checkout GET]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

// POST /api/public/checkout — place order from cart
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return json({ ok: false, error: "Neautorizat." }, 401);

    const body = await req.json().catch(() => null);
    console.log("[checkout POST body]", JSON.stringify(body));
    const shippingAddress = body?.shipping_address?.trim() || "";
    const shippingCity = body?.shipping_city?.trim() || "";
    const shippingPostalCode = body?.shipping_postal_code?.trim() || "";
    const shippingCountry = body?.shipping_country?.trim() || "România";
    const billingName = body?.billing_name?.trim() || "";
    const billingTaxId = body?.billing_tax_id?.trim() || "";
    const billingRegNo = body?.billing_reg_no?.trim() || "";
    const phone = body?.phone?.trim() || "";
    const notes = body?.notes?.trim() || "";
    const deliveryMethod = body?.delivery_method === "pickup" ? "pickup" : "courier";
    const pickupWarehouseId = body?.pickup_warehouse_id?.trim() || null;
    const paymentMethod = body?.payment_method === "transfer" ? "transfer" : "card";

    if (deliveryMethod === "courier") {
      if (!shippingAddress || !shippingCity) {
        return json({ ok: false, error: "Adresa și orașul sunt obligatorii pentru livrare prin curier." }, 400);
      }
    }
    if (deliveryMethod === "pickup" && !pickupWarehouseId) {
      return json({ ok: false, error: "Selectează un depozit pentru ridicare." }, 400);
    }
    if (!phone) {
      return json({ ok: false, error: "Telefonul este obligatoriu." }, 400);
    }

    // Fetch account
    const accounts = await sql`
      SELECT id FROM account WHERE user_id = ${user.userId}::uuid LIMIT 1
    `;
    if (!accounts.length) {
      return json({ ok: false, error: "Cont inexistent." }, 400);
    }
    const accountId = accounts[0].id;

    // Fetch cart items with computed prices
    const classDiscountPct = await getUserDiscountPct(user.userId);

    const cartItems = await sql`
      SELECT
        cc.product_id,
        cc.quantity,
        p.name,
        p.discount_price,
        p.discount_active,
        CEIL(p.buy_price_net * (1 + p.profit_margin_pct/100.0) *
          (1 + CASE WHEN tr.rate <= 1 THEN tr.rate ELSE tr.rate/100 END)) AS price_gross,
        p.buy_price_net,
        tr.rate as tax_rate
      FROM customer_cart cc
      JOIN product p ON p.id = cc.product_id
      JOIN tax_rate tr ON tr.id = p.tax_rate_id
      WHERE cc.customer_id = ${user.userId}::uuid
    `;

    if (!cartItems.length) {
      return json({ ok: false, error: "Coșul este gol." }, 400);
    }

    // Build order items
    const orderItems = cartItems.map((row: any) => {
      const originalGross = Number(row.price_gross);
      const productDiscountPrice = row.discount_active ? Number(row.discount_price) : null;
      const basePrice = productDiscountPrice ?? originalGross;
      const finalPrice = classDiscountPct > 0 ? applyClassDiscount(basePrice, classDiscountPct) : basePrice;
      const taxRate = Number(row.tax_rate) <= 1 ? Number(row.tax_rate) : Number(row.tax_rate) / 100;
      const unitNet = finalPrice / (1 + taxRate);
      const qty = Number(row.quantity);

      return {
        product_id: row.product_id,
        qty,
        unit_price_net: Math.round(unitNet * 100) / 100,
        tax_rate: taxRate,
        line_net: Math.round(unitNet * qty * 100) / 100,
        line_tax: Math.round((finalPrice * qty - unitNet * qty) * 100) / 100,
        line_gross: Math.round(finalPrice * qty * 100) / 100,
      };
    });

    // Build structured notes with shipping/billing info — encrypt PII fields
    const plainNotes = [
      `LIVRARE: ${shippingAddress}, ${shippingCity}${shippingPostalCode ? ` ${shippingPostalCode}` : ""}, ${shippingCountry}`,
      `TEL: ${phone}`,
      billingName ? `FACTURARE: ${billingName}` : null,
      billingTaxId ? `CUI: ${billingTaxId}` : null,
      billingRegNo ? `Reg.Com: ${billingRegNo}` : null,
      notes ? `OBS: ${notes}` : null,
    ].filter(Boolean).join("\n");
    const structuredNotes = encryptPII(plainNotes) || plainNotes;

    // Create order + items + clear cart
    const [order] = await sql`
      INSERT INTO public."order" (
        account_id,
        status,
        notes,
        delivery_method,
        pickup_warehouse_id,
        payment_method,
        payment_status,
        created_by_user_id
      )
      VALUES (
        ${accountId}::uuid,
        'PLACED',
        ${structuredNotes},
        ${deliveryMethod},
        ${pickupWarehouseId ? pickupWarehouseId : null}::uuid,
        ${paymentMethod},
        ${paymentMethod === "card" ? "pending" : "not_required"},
        ${user.userId}::uuid
      )
      RETURNING id
    `;

    const resultOrderId = order.id;

    // Insert order items
    for (const item of orderItems) {
      await sql`
        INSERT INTO public.order_item (
          order_id,
          product_id,
          qty,
          reserved_qty,
          unit_price_net,
          tax_rate,
          line_net,
          line_tax,
          line_gross
        )
        VALUES (
          ${resultOrderId}::uuid,
          ${item.product_id}::uuid,
          ${item.qty},
          0,
          ${item.unit_price_net},
          ${item.tax_rate},
          ${item.line_net},
          ${item.line_tax},
          ${item.line_gross}
        )
      `;
    }

    // Clear cart
    await sql`
      DELETE FROM customer_cart WHERE customer_id = ${user.userId}::uuid
    `;

    // Generate EuPlatesc payment URL for card payments
    if (paymentMethod === "card") {
      const totalGross = orderItems.reduce((s, i) => s + i.line_gross, 0);
      const appUrl = getAppUrl();

      // Fetch user email for EuPlatesc
      const [acct] = await sql`
        SELECT email, display_name FROM account WHERE id = ${accountId}::uuid LIMIT 1
      `;

      const paymentResult = getEpClient().paymentUrl({
        amount: Math.round(totalGross * 100) / 100,
        currency: "RON",
        invoiceId: resultOrderId,
        orderDescription: `Comanda ShopTruck #${resultOrderId.slice(0, 8)}`,
        billingFirstName: billingName.split(" ")[0] || undefined,
        billingLastName: billingName.split(" ").slice(1).join(" ") || undefined,
        billingPhone: phone || undefined,
        billingEmail: acct?.email || undefined,
        billingCity: shippingCity || undefined,
        billingCountry: shippingCountry || undefined,
        silentUrl: `${appUrl}/api/public/euplatesc/callback`,
        successUrl: `${appUrl}/api/public/euplatesc/success`,
        failedUrl: `${appUrl}/api/public/euplatesc/failed`,
        backToSite: `${appUrl}/checkout`,
      } as any);

      return json({
        ok: true,
        order_id: resultOrderId,
        payment_url: paymentResult.paymentUrl,
      });
    }

    return json({ ok: true, order_id: resultOrderId });
  } catch (e: any) {
    console.error("[API checkout POST]", e);
    return json({ ok: false, error: e?.message || "Eroare la plasarea comenzii." }, 500);
  }
}
