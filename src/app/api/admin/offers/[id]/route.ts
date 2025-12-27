import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";

type Props = {
  params: Promise<{ id: string }>;
};
const safeUUID = (val: any) => (val && typeof val === 'string' && val.trim().length > 0 ? val : null);

// GET SINGLE OFFER
export async function GET(req: NextRequest, props: Props) {
  const params = await props.params;
  const { id } = params;

  try {
    // 2. Header + Client + Vehicul
    const offerRows = await sql`
      SELECT o.*, 
        c.kind, 
        c.id as customer_id,
        ci.first_name, ci.last_name, ci.phone, 
        cc.company_name, cc.vat_id,
        v.vin, v.plate_number, v.brand, v.model, v.year
      FROM offer o
      JOIN customer c ON o.customer_id = c.id
      LEFT JOIN customer_individual ci ON c.id = ci.customer_id
      LEFT JOIN customer_company cc ON c.id = cc.customer_id
      LEFT JOIN vehicle v ON o.vehicle_id = v.id
      WHERE o.id = ${id}
    `;

    if (offerRows.length === 0)
      return NextResponse.json(
        { ok: false, error: "Oferta nu există" },
        { status: 404 }
      );

    const offer = offerRows[0];

    // 3. Liniile ofertei (Items)
    const items = await sql`
      SELECT id, product_id, name, quantity, unit_price, tax_percentage
      FROM offer_item WHERE offer_id = ${id}
    `;

    // 4. Formatăm datele
    const formattedData = {
      id: offer.id,
      notes: offer.notes,
      validUntil: offer.valid_until
        ? new Date(offer.valid_until).toISOString().split("T")[0]
        : "",

      customer: {
        id: offer.customer_id,
        kind: offer.kind,
        display_name:
          offer.kind === "company"
            ? offer.company_name
            : `${offer.first_name || ""} ${offer.last_name || ""}`.trim(),
        vat_id: offer.vat_id,
        phone: offer.phone || "",
      },

      clientName:
        offer.kind === "company"
          ? offer.company_name
          : `${offer.first_name || ""} ${offer.last_name || ""}`.trim(),

      vehicle: {
        vin: offer.vin || "",
        plate_number: offer.plate_number || "",
        brand: offer.brand || "",
        model: offer.model || "",
        year: offer.year || new Date().getFullYear(),
      },

      // ✅ FIX AICI: Trimitem și 'qty' și 'quantity'
      items: items.map((i: any) => ({
        id: i.id,
        productId: i.product_id,
        name: i.name,

        // Pagina de Editare folosește 'qty'
        qty: Number(i.quantity) || 1,

        // PDF-ul folosește 'quantity'
        quantity: Number(i.quantity) || 1,

        price: Number(i.unit_price),
        tax: Number(i.tax_percentage),
      })),
    };

    return NextResponse.json({ ok: true, data: formattedData });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}

// DELETE
export async function DELETE(req: NextRequest, props: Props) {
  const params = await props.params;
  const { id } = params;

  const user = await getSessionUser();
  if (!user)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );

  try {
    await sql`DELETE FROM offer_item WHERE offer_id = ${id}`;
    await sql`DELETE FROM offer WHERE id = ${id}`;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { 
      customerId, 
      vehicleId, 
      vehicle, // Obiectul cu detaliile vehiculului (vin, plate, brand...)
      notes, 
      validUntil, 
      items 
    } = body;

    // 1. CALCULEAZĂ TOTALELE (Net, Tax, Gross)
    let grandNet = 0;
    let grandTax = 0;
    
    // Pregătim itemele pentru inserare și calculăm sumele
    const itemsToInsert = (items || []).map((item: any) => {
      const qty = Number(item.qty || item.quantity) || 1;
      const price = Number(item.price) || 0;
      const taxPercent = Number(item.tax || item.tax_percentage) || 0;
      
      const lineNet = qty * price;
      const lineTax = lineNet * (taxPercent / 100);
      
      grandNet += lineNet;
      grandTax += lineTax;

      return {
        ...item,
        qty,
        price,
        taxPercent
      };
    });

    const grandGross = grandNet + grandTax;

    // 2. LOGICA "VEHICUL NOU DACĂ E MODIFICAT"
    let finalVehicleId = safeUUID(vehicleId);

    // Dacă avem detalii despre vehicul în request
    if (vehicle && (vehicle.vin || vehicle.plate_number)) {
        // Dacă avem un ID existent, verificăm dacă s-a schimbat ceva
        let needsNewVehicle = true;

        if (finalVehicleId) {
            const existingVehicle = await sql`
                SELECT vin, plate_number, brand, model 
                FROM vehicle WHERE id = ${finalVehicleId}
            `;
            
            if (existingVehicle.length > 0) {
                const v = existingVehicle[0];
                // Comparăm datele trimise cu cele din DB
                // (Poți extinde comparația și la an/model dacă dorești strictețe maximă)
                const isSame = 
                    (v.vin || "") === (vehicle.vin || "") &&
                    (v.plate_number || "") === (vehicle.plate_number || "") &&
                    (v.brand || "") === (vehicle.brand || "") &&
                    (v.model || "") === (vehicle.model || "");
                
                if (isSame) {
                    needsNewVehicle = false; // Datele sunt identice, păstrăm ID-ul vechi
                }
            }
        }

        // Dacă s-a modificat sau nu aveam ID, creăm un vehicul nou
        if (needsNewVehicle) {
            const newVehicle = await sql`
                INSERT INTO vehicle (vin, plate_number, brand, model, year)
                VALUES (
                    ${vehicle.vin || ""}, 
                    ${vehicle.plate_number || ""}, 
                    ${vehicle.brand || ""}, 
                    ${vehicle.model || ""}, 
                    ${Number(vehicle.year) || new Date().getFullYear()}
                )
                RETURNING id
            `;
            finalVehicleId = newVehicle[0].id;
        }
    }

    // 3. ACTUALIZARE DB (Tranzacție)
    const safeCustomerId = safeUUID(customerId);
    const safeValidUntil = validUntil ? new Date(validUntil).toISOString() : null;

    await sql`BEGIN`;

    // A. Update Oferta cu noile totale și ID-ul vehiculului (nou sau vechi)
    await sql`
      UPDATE offer 
      SET 
        customer_id = ${safeCustomerId},
        vehicle_id = ${finalVehicleId},
        notes = ${notes},
        valid_until = ${safeValidUntil},
        total_net = ${grandNet},     -- Update coloană total_net
        total_tax = ${grandTax},     -- Update coloană total_tax
        total_gross = ${grandGross}, -- Update coloană total_gross
        updated_at = NOW()
      WHERE id = ${id}
    `;

    // B. Șterge itemele vechi
    await sql`DELETE FROM offer_item WHERE offer_id = ${id}`;

    // C. Inserează itemele noi
    if (itemsToInsert.length > 0) {
      for (const item of itemsToInsert) {
        const pProductId = safeUUID(item.productId);
        const pName = item.name || "Produs";
        
        await sql`
          INSERT INTO offer_item (
            offer_id, product_id, name, quantity, unit_price, tax_percentage
          ) VALUES (
            ${id}, ${pProductId}, ${pName}, ${item.qty}, ${item.price}, ${item.taxPercent}
          )
        `;
      }
    }

    await sql`COMMIT`;

    return NextResponse.json({ 
        ok: true, 
        message: "Oferta a fost actualizată.",
        data: {
            total_net: grandNet,
            total_gross: grandGross,
            vehicle_id: finalVehicleId // Returnăm noul ID în caz că frontend-ul are nevoie
        }
    });

  } catch (err: any) {
    try { await sql`ROLLBACK`; } catch (e) {}
    console.error("PUT Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
