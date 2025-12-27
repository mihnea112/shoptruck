import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";

// 1. LISTARE OFERTE (GET)
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    // Luăm ofertele + numele clientului + date vehicul
    const offers = await sql`
      SELECT 
        o.id,
        o.total_gross,
        o.created_at,
        o.status,
        c.kind,
        ci.first_name, ci.last_name, 
        cc.company_name,
        v.plate_number, v.brand, v.model
      FROM offer o
      JOIN customer c ON o.customer_id = c.id
      LEFT JOIN customer_individual ci ON c.id = ci.customer_id
      LEFT JOIN customer_company cc ON c.id = cc.customer_id
      LEFT JOIN vehicle v ON o.vehicle_id = v.id
      ORDER BY o.created_at DESC
      LIMIT 50
    `;

    // Procesăm numele pentru afișare
    const formatted = offers.map((o: any) => ({
      id: o.id,
      date: o.created_at,
      total: Number(o.total_gross),
      status: o.status,
      clientName: o.kind === 'company' ? o.company_name : `${o.first_name || ''} ${o.last_name || ''}`.trim(),
      vehicle: o.plate_number ? `${o.plate_number} (${o.brand} ${o.model})` : '-'
    }));

    return NextResponse.json({ ok: true, offers: formatted });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// 2. CREARE OFERTĂ NOUĂ (POST)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json();
  const { customerId, vehicle, items, notes, validUntil } = body;

  try {
    // A. Gestionare Vehicul (Creăm sau Actualizăm dacă avem VIN)
    let vehicleId = null;
    if (vehicle.vin) {
      // Căutăm dacă există deja
      const existingV = await sql`SELECT id FROM vehicle WHERE vin = ${vehicle.vin} LIMIT 1`;
      
      if (existingV.length > 0) {
        vehicleId = existingV[0].id;
        // Opțional: Update km sau alte date aici
      } else {
        // Inserăm vehicul nou
        const newV = await sql`
          INSERT INTO vehicle (customer_id, vin, plate_number, brand, model, year)
          VALUES (${customerId}, ${vehicle.vin}, ${vehicle.plate_number}, ${vehicle.brand}, ${vehicle.model}, ${vehicle.year})
          RETURNING id
        `;
        vehicleId = newV[0].id;
      }
    }

    // B. Calcule
    let totalNet = 0;
    let totalTax = 0;
    
    // Validăm calculele venite din frontend
    items.forEach((i: any) => {
      const lineNet = i.qty * i.price;
      const lineTax = lineNet * (i.tax / 100);
      totalNet += lineNet;
      totalTax += lineTax;
    });
    const totalGross = totalNet + totalTax;

    // C. Inserare Oferta (Header)
    const offerRes = await sql`
      INSERT INTO offer (customer_id, vehicle_id, status, notes, valid_until, total_net, total_tax, total_gross)
      VALUES (${customerId}, ${vehicleId}, 'draft', ${notes}, ${validUntil}, ${totalNet}, ${totalTax}, ${totalGross})
      RETURNING id
    `;
    const offerId = offerRes[0].id;

    // D. Inserare Linii (Items)
    for (const item of items) {
      await sql`
        INSERT INTO offer_item (offer_id, product_id, name, quantity, unit_price, tax_percentage)
        VALUES (${offerId}, ${item.productId || null}, ${item.name}, ${item.qty}, ${item.price}, ${item.tax})
      `;
    }

    return NextResponse.json({ ok: true, id: offerId });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}